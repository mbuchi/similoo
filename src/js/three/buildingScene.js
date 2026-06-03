// Compact Three.js scene for the building-detail popup.
//
// A lighter sibling of similoo-three's full sceneViewer: no sky dome, no
// sun simulation, no compass. Everything lives in ONE view: a solid grey
// terrain mesh (built from the LAS ground class) is the always-visible
// ground base, and the user independently toggles two overlays on top of
// it — the raw coloured LAS point cloud and the Roofer building model.
// An optional basemap drape textures the terrain with a swisstopo aerial
// orthophoto. (This replaces the old two-tab "point cloud vs solid model"
// split, where the building was shown in both tabs and the two terrain
// forms were mutually exclusive.)

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { fetchTerrainGLB, fetchBuildingGLB, fetchFootprintsBBox } from './api3d.js';
import { wgs84ToLV95 } from './swissCoords.js';

// A quarter of the original 100 m so the point-cloud view loads a tight
// zone (≈50 m across) focused on the building, not a wide neighbourhood.
const SCENE_RADIUS_M = 25;

// An incoming lat/lng (e.g. a similoo comparable's coordinate) can sit a
// few metres off its building footprint — just outside the polygon — so
// the upstream building-model's INTERSECTS misses entirely ("No features
// returned from WFS", a 404). Snap to the nearest real footprint (its GWR
// reference point, which reliably falls inside the polygon) so the model
// resolves. We recenter the WHOLE scene on the snapped point so the
// terrain slice and the building stay co-located; if no footprint is
// found nearby, we keep the original coordinate and fall back gracefully
// to a terrain-only view.
async function resolveSceneCenter(lat, lng) {
    try {
        const fp = await fetchFootprintsBBox({ lat, lng, radius_m: 120 });
        const nearest = fp?.buildings?.[0];
        if (nearest && Number.isFinite(nearest.lat) && Number.isFinite(nearest.lng)) {
            return { lat: nearest.lat, lng: nearest.lng };
        }
    } catch (err) {
        console.warn('detail scene snap failed; using raw coordinate', err);
    }
    return { lat, lng };
}

export function createBuildingScene({ container }) {
    if (!container) throw new Error('createBuildingScene: container is required');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 0.85);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(120, 200, 80);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / Math.max(1, container.clientHeight),
        0.5,
        2000,
    );
    camera.position.set(140, 140, 140);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.minDistance = 20;
    controls.maxDistance = 600;
    controls.maxPolarAngle = Math.PI * 0.49;

    const grid = new THREE.GridHelper(SCENE_RADIUS_M * 2, 20, 0x1e293b, 0x0b1220);
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    scene.add(grid);

    const sceneGroup = new THREE.Group();
    scene.add(sceneGroup);

    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    let disposed = false;
    let loadToken = 0;
    let resizeRaf = 0;
    // Independent layer visibility. The solid terrain mesh is the always-on
    // base — "the terrain is always visualized" — while the point cloud and
    // the building are overlays the user toggles on top of it. (The old
    // two-tab "point cloud vs solid" mode is gone: both terrain forms and
    // the building now live in one scene, switched per-layer.)
    const layers = { pointcloud: true, building: true };
    let basemapEnabled = false;
    let basemapToken = 0;            // guards async drape against load races
    let terrainPointObject = null;   // raw LAS point cloud overlay
    let terrainSolidObject = null;   // always-on solid ground mesh
    let buildingObject = null;
    let sceneCenter = null;          // { E, N } LV95 of the loaded scene

    function setStatus() { /* status surfacing is owned by the modal */ }

    function disposeNode(child) {
        child.traverse?.((node) => {
            if (node.isMesh || node.isPoints) {
                node.geometry?.dispose?.();
                if (Array.isArray(node.material)) {
                    node.material.forEach((m) => m.dispose?.());
                } else {
                    node.material?.dispose?.();
                }
            }
        });
    }

    function clearGroup(group) {
        while (group.children.length) {
            const child = group.children.pop();
            disposeNode(child);
        }
    }

    async function loadGLBBlob(blob) {
        const buf = await blob.arrayBuffer();
        return new Promise((resolve, reject) => {
            loader.parse(buf, '', resolve, reject);
        });
    }

    function makeLV95ToLocalMatrix(centerE, centerN) {
        const m = new THREE.Matrix4();
        m.set(
            1,  0, 0, -centerE,
            0,  0, 1,  0,
            0, -1, 0,  centerN,
            0,  0, 0,  1,
        );
        return m;
    }

    function applyPointCloudMaterial(root) {
        root.traverse((node) => {
            if (node.isPoints) {
                node.material = new THREE.PointsMaterial({
                    size: 0.45,
                    vertexColors: true,
                    sizeAttenuation: true,
                });
            }
        });
    }

    // Build a low-fi solid-terrain mesh from the LAS ground points so the
    // "solid model" toggle has a base under the building. We sample the
    // point cloud onto a coarse grid (3 m cells) of median Z, then
    // triangulate it as a height-map. Cheap and visually adequate at the
    // scene's 100 m radius.
    function buildSolidTerrainFromPoints(pointsObject) {
        const cells = new Map(); // key = "ix,iz", val = array of Y
        const v = new THREE.Vector3();
        const CELL = 3.0;
        pointsObject.updateWorldMatrix(true, true);
        pointsObject.traverse((node) => {
            const geo = node.geometry;
            const posAttr = geo?.attributes?.position;
            const colAttr = geo?.attributes?.color;
            if (!posAttr) return;
            for (let i = 0; i < posAttr.count; i++) {
                if (colAttr) {
                    const r = colAttr.getX(i) * 255;
                    const g = colAttr.getY(i) * 255;
                    const b = colAttr.getZ(i) * 255;
                    const isGround =
                        Math.abs(r - 165) <= 8 &&
                        Math.abs(g - 42) <= 8 &&
                        Math.abs(b - 42) <= 8;
                    if (!isGround) continue;
                }
                v.fromBufferAttribute(posAttr, i);
                v.applyMatrix4(node.matrixWorld);
                const ix = Math.round(v.x / CELL);
                const iz = Math.round(v.z / CELL);
                const key = `${ix},${iz}`;
                let arr = cells.get(key);
                if (!arr) { arr = []; cells.set(key, arr); }
                arr.push(v.y);
            }
        });
        if (cells.size < 4) return null;

        // Find grid bounds.
        let ixMin = Infinity, ixMax = -Infinity, izMin = Infinity, izMax = -Infinity;
        for (const key of cells.keys()) {
            const [ixs, izs] = key.split(',');
            const ix = Number(ixs), iz = Number(izs);
            if (ix < ixMin) ixMin = ix; if (ix > ixMax) ixMax = ix;
            if (iz < izMin) izMin = iz; if (iz > izMax) izMax = iz;
        }
        const cols = ixMax - ixMin + 1;
        const rows = izMax - izMin + 1;
        if (cols < 2 || rows < 2) return null;

        // Median Y per cell, with hole fill from nearest neighbours.
        const grid = new Float32Array(cols * rows);
        const filled = new Uint8Array(cols * rows);
        for (const [key, ys] of cells) {
            const [ixs, izs] = key.split(',');
            const c = Number(ixs) - ixMin;
            const r = Number(izs) - izMin;
            ys.sort((a, b) => a - b);
            grid[r * cols + c] = ys[Math.floor(ys.length / 2)];
            filled[r * cols + c] = 1;
        }
        for (let r = 0; r < rows; r++) {
            let lastY = null;
            for (let c = 0; c < cols; c++) {
                if (filled[r * cols + c]) lastY = grid[r * cols + c];
                else if (lastY != null) grid[r * cols + c] = lastY;
            }
            lastY = null;
            for (let c = cols - 1; c >= 0; c--) {
                if (filled[r * cols + c]) lastY = grid[r * cols + c];
                else if (lastY != null && !filled[r * cols + c]) grid[r * cols + c] = lastY;
            }
        }

        // Build PlaneGeometry and lift its Y vertices into our grid.
        const geom = new THREE.PlaneGeometry(
            (cols - 1) * CELL,
            (rows - 1) * CELL,
            cols - 1,
            rows - 1,
        );
        // PlaneGeometry is XY by default; rotate to XZ so Y becomes height.
        geom.rotateX(-Math.PI / 2);
        const pos = geom.attributes.position;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                pos.setY(idx, grid[idx]);
            }
        }
        geom.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
            color: 0x9ba9a3,
            roughness: 1.0,
            flatShading: true,
        });
        const mesh = new THREE.Mesh(geom, mat);
        // Center the mesh on the same XZ origin as the points.
        mesh.position.set(
            (ixMin + (cols - 1) / 2) * CELL,
            0,
            (izMin + (rows - 1) / 2) * CELL,
        );
        return mesh;
    }

    function applyBuildingSolidMaterial(root) {
        root.traverse((node) => {
            if (node.isMesh) {
                node.material = new THREE.MeshStandardMaterial({
                    color: 0xdc2626,
                    roughness: 0.55,
                    metalness: 0.05,
                });
            }
        });
    }

    // Find the terrain GROUND Y near a given (x, z) point.
    //
    // The terrain GLB is a coloured point cloud where each vertex carries
    // its LAS classification colour. The building GLB arrives at absolute
    // LV95 elevation (hundreds of metres) while the terrain export rebases
    // its Z so the scene's lowest point sits at Y≈0 — so without seating
    // the building floats high above the terrain. We sample the LAS
    // "ground" class (brown ≈ rgb(165,42,42)) under the footprint and pick
    // its 80th-percentile Y as the local ground level, robust to a few
    // stray sub-surface points. The filtered ground array is cached on the
    // terrain object so the linear scan only runs once.
    function buildGroundIndex(terrainObject) {
        const grounds = [];
        terrainObject.updateWorldMatrix(true, true);
        const v = new THREE.Vector3();
        terrainObject.traverse((node) => {
            const geo = node.geometry;
            const posAttr = geo?.attributes?.position;
            const colAttr = geo?.attributes?.color;
            if (!posAttr) return;
            const out = [];
            for (let i = 0; i < posAttr.count; i++) {
                if (colAttr) {
                    const r = colAttr.getX(i) * 255;
                    const g = colAttr.getY(i) * 255;
                    const b = colAttr.getZ(i) * 255;
                    const isGround =
                        Math.abs(r - 165) <= 8 &&
                        Math.abs(g - 42) <= 8 &&
                        Math.abs(b - 42) <= 8;
                    if (!isGround) continue;
                }
                v.fromBufferAttribute(posAttr, i);
                v.applyMatrix4(node.matrixWorld);
                out.push(v.x, v.y, v.z);
            }
            if (out.length) grounds.push(new Float32Array(out));
        });
        return grounds;
    }

    function getGroundHeightAt(terrainObject, x, z, radius = 3.0) {
        if (!terrainObject) return null;
        if (!terrainObject.userData.__groundArrays) {
            terrainObject.userData.__groundArrays = buildGroundIndex(terrainObject);
        }
        const arrays = terrainObject.userData.__groundArrays;
        const r2 = radius * radius;
        const hits = [];
        for (const arr of arrays) {
            for (let i = 0; i < arr.length; i += 3) {
                const dx = arr[i] - x;
                const dz = arr[i + 2] - z;
                if (dx * dx + dz * dz <= r2) hits.push(arr[i + 1]);
            }
        }
        if (!hits.length) return null;
        hits.sort((a, b) => a - b);
        const idx = Math.min(hits.length - 1, Math.floor(hits.length * 0.8));
        return hits[idx];
    }

    // Drop the building so its lowest vertex sits on the local ground level
    // sampled from the terrain point cloud. Steps the sample radius outward
    // because dense footprints can have a ground gap right under the centre.
    function seatOnTerrain(buildingNode, terrainObject) {
        if (!buildingNode || !terrainObject) return false;
        const box = new THREE.Box3().setFromObject(buildingNode);
        if (!isFinite(box.min.x) || !isFinite(box.max.x)) return false;
        const center = box.getCenter(new THREE.Vector3());

        let groundY = null;
        for (const r of [2.0, 4.0, 8.0, 16.0]) {
            groundY = getGroundHeightAt(terrainObject, center.x, center.z, r);
            if (groundY != null) break;
        }
        if (groundY == null) return false;

        // Sink ~10 cm below grade so the base reads as planted, not floating.
        buildingNode.position.y += groundY - box.min.y - 0.1;
        return true;
    }

    // Apply the current layer flags to whatever objects exist. The solid
    // terrain mesh is the ground base and stays visible in every state.
    function applyVisibility() {
        if (terrainSolidObject) terrainSolidObject.visible = true;
        if (terrainPointObject) terrainPointObject.visible = layers.pointcloud;
        if (buildingObject) buildingObject.visible = layers.building;
    }

    function setLayer(name, visible) {
        if (name in layers) layers[name] = !!visible;
        applyVisibility();
    }

    // ---- Basemap drape -----------------------------------------------------
    // Drape a swisstopo SWISSIMAGE orthophoto onto the solid terrain mesh so
    // the ground reads as the real place, not a grey blob. The mesh is a flat
    // height-map (PlaneGeometry) with default 0..1 UVs, so a single north-up
    // WMS image covering the mesh's exact LV95 bbox aligns pixel-for-pixel:
    // local +X = east, local +Z = south (so N = centerN − z), and the default
    // texture flipY puts the image's north edge at the mesh's north edge.
    const BASEMAP_WMS = 'https://wms.geo.admin.ch/';
    const BASEMAP_LAYER = 'ch.swisstopo.swissimage';

    function basemapURLForMesh() {
        if (!terrainSolidObject || !sceneCenter) return null;
        const box = new THREE.Box3().setFromObject(terrainSolidObject);
        if (!isFinite(box.min.x) || !isFinite(box.max.x)) return null;
        const minE = box.min.x + sceneCenter.E;
        const maxE = box.max.x + sceneCenter.E;
        // world +Z points south, so northing decreases as z grows.
        const minN = sceneCenter.N - box.max.z;
        const maxN = sceneCenter.N - box.min.z;
        if (maxE <= minE || maxN <= minN) return null;
        const params = new URLSearchParams({
            SERVICE: 'WMS',
            VERSION: '1.1.1',
            REQUEST: 'GetMap',
            LAYERS: BASEMAP_LAYER,
            STYLES: '',
            SRS: 'EPSG:2056',
            BBOX: `${minE.toFixed(2)},${minN.toFixed(2)},${maxE.toFixed(2)},${maxN.toFixed(2)}`,
            WIDTH: '768',
            HEIGHT: '768',
            FORMAT: 'image/jpeg',
        });
        return `${BASEMAP_WMS}?${params.toString()}`;
    }

    function revertBasemap() {
        if (!terrainSolidObject) return;
        const grey = terrainSolidObject.userData.__greyMaterial;
        if (grey && terrainSolidObject.material !== grey) {
            const draped = terrainSolidObject.material;
            terrainSolidObject.material = grey;
            draped.map?.dispose?.();
            draped.dispose?.();
        }
    }

    async function applyBasemap() {
        const token = ++basemapToken;
        const url = basemapURLForMesh();
        if (!url || !terrainSolidObject) return;
        let texture;
        try {
            texture = await new Promise((resolve, reject) => {
                textureLoader.load(url, resolve, undefined, reject);
            });
        } catch (err) {
            console.warn('basemap drape failed', err);
            return;
        }
        // Bail if a newer load/toggle superseded this fetch.
        if (token !== basemapToken || !basemapEnabled || disposed || !terrainSolidObject) {
            texture.dispose?.();
            return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        const maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 1;
        texture.anisotropy = Math.min(8, maxAniso);
        if (!terrainSolidObject.userData.__greyMaterial) {
            terrainSolidObject.userData.__greyMaterial = terrainSolidObject.material;
        }
        terrainSolidObject.material = new THREE.MeshStandardMaterial({
            map: texture,
            color: 0xffffff,
            roughness: 0.95,
            metalness: 0.0,
        });
    }

    function setBasemap(enabled) {
        basemapEnabled = !!enabled;
        if (basemapEnabled) {
            applyBasemap();
        } else {
            basemapToken++; // cancel any in-flight drape
            revertBasemap();
        }
    }

    async function loadAt({ lat, lng, label }) {
        const token = ++loadToken;
        basemapToken++; // invalidate any drape in flight for the old scene
        clearGroup(sceneGroup);
        terrainPointObject = null;
        terrainSolidObject = null;
        buildingObject = null;
        sceneCenter = null;

        // Snap to the nearest footprint so the building resolves and the
        // terrain/building stay co-located on one real building.
        const { lat: clat, lng: clng } = await resolveSceneCenter(lat, lng);
        if (token !== loadToken) return;

        const { easting: centerE, northing: centerN } = wgs84ToLV95(clng, clat);
        sceneCenter = { E: centerE, N: centerN };

        try {
            const { blob } = await fetchTerrainGLB({ lat: clat, lng: clng, radius_m: SCENE_RADIUS_M });
            if (token !== loadToken) return;
            const gltf = await loadGLBBlob(blob);
            const terrain = gltf.scene;
            terrain.name = 'terrain-points';
            applyPointCloudMaterial(terrain);
            sceneGroup.add(terrain);
            terrainPointObject = terrain;
            // Pre-build a solid mesh from the ground points so the toggle
            // is instant when the user flips to solid mode.
            terrainSolidObject = buildSolidTerrainFromPoints(terrain);
            if (terrainSolidObject) {
                terrainSolidObject.visible = false;
                sceneGroup.add(terrainSolidObject);
            }
        } catch (err) {
            console.warn('detail terrain load failed', err);
        }

        try {
            const { blob } = await fetchBuildingGLB({ lat: clat, lng: clng });
            if (token !== loadToken) return;
            const gltf = await loadGLBBlob(blob);
            const building = gltf.scene;
            building.name = 'building';
            building.applyMatrix4(makeLV95ToLocalMatrix(centerE, centerN));
            applyBuildingSolidMaterial(building);
            sceneGroup.add(building);
            buildingObject = building;
            // The building arrives at absolute LV95 elevation; drop it onto
            // the terrain point cloud so it sits on the ground (not floating)
            // whether or not the point-cloud overlay is shown.
            seatOnTerrain(building, terrainPointObject);
        } catch (err) {
            console.warn('detail building load failed', err);
        }

        if (token !== loadToken) return;
        applyVisibility();
        if (basemapEnabled) applyBasemap();
        frameOnContent(sceneGroup);
        return { label, lat: clat, lng: clng };
    }

    function frameOnContent(group) {
        const box = new THREE.Box3().setFromObject(group);
        if (!isFinite(box.min.x) || !isFinite(box.max.x)) return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const reach = Math.max(SCENE_RADIUS_M, size.x, size.z, size.y * 1.6);
        controls.target.set(center.x, center.y * 0.6, center.z);
        camera.position.set(
            center.x + reach * 1.1,
            center.y + reach * 0.9,
            center.z + reach * 1.1,
        );
        controls.update();
    }

    function onResize() {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w === 0 || h === 0) return;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        });
    }
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    function tick() {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
    }
    tick();

    return {
        loadAt,
        setLayer,
        getLayers: () => ({ ...layers }),
        setBasemap,
        getBasemap: () => basemapEnabled,
        dispose() {
            disposed = true;
            resizeObserver.disconnect();
            controls.dispose();
            clearGroup(sceneGroup);
            renderer.dispose();
            if (renderer.domElement.parentNode === container) {
                container.removeChild(renderer.domElement);
            }
        },
    };
}
