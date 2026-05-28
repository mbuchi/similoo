// Compact Three.js scene for the building-detail popup.
//
// A lighter sibling of similoo-three's full sceneViewer: no sky dome, no
// sun simulation, no compass — just the terrain LAS point cloud + the
// picked building, rendered in either point-cloud mode (raw coloured
// LiDAR) or solid mode (Roofer building mesh + grey terrain mesh
// constructed from the ground-class points). The user toggles between
// the two from the popup's chrome.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { fetchTerrainGLB, fetchBuildingGLB } from './api3d.js';
import { wgs84ToLV95 } from './swissCoords.js';

const SCENE_RADIUS_M = 100;

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
    let disposed = false;
    let loadToken = 0;
    let resizeRaf = 0;
    let mode = 'pointcloud';
    let terrainPointObject = null;   // raw point cloud
    let terrainSolidObject = null;   // derived solid mesh
    let buildingObject = null;

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

    function setMode(next) {
        mode = next === 'solid' ? 'solid' : 'pointcloud';
        if (terrainPointObject) terrainPointObject.visible = mode === 'pointcloud';
        if (terrainSolidObject) terrainSolidObject.visible = mode === 'solid';
        if (buildingObject) buildingObject.visible = true; // both modes show building
    }

    async function loadAt({ lat, lng, label }) {
        const token = ++loadToken;
        clearGroup(sceneGroup);
        terrainPointObject = null;
        terrainSolidObject = null;
        buildingObject = null;

        const { easting: centerE, northing: centerN } = wgs84ToLV95(lng, lat);

        try {
            const { blob } = await fetchTerrainGLB({ lat, lng, radius_m: SCENE_RADIUS_M });
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
            const { blob } = await fetchBuildingGLB({ lat, lng });
            if (token !== loadToken) return;
            const gltf = await loadGLBBlob(blob);
            const building = gltf.scene;
            building.name = 'building';
            building.applyMatrix4(makeLV95ToLocalMatrix(centerE, centerN));
            applyBuildingSolidMaterial(building);
            sceneGroup.add(building);
            buildingObject = building;
        } catch (err) {
            console.warn('detail building load failed', err);
        }

        if (token !== loadToken) return;
        setMode(mode);
        frameOnContent(sceneGroup);
        return { label, lat, lng };
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
        setMode,
        getMode: () => mode,
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
