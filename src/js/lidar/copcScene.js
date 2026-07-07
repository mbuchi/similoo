// Giro3D scene for the building-detail popup: streams the swissSURFACE3D
// COPC point-cloud tile covering a building straight from the RES backend.
//
// A vanilla-JS port of lidaroo's PointCloudViewer.tsx wearing the old
// buildingScene factory shape, so the modal stays a thin shell:
//
//   const scene = createCopcScene({ container });
//   await scene.loadAt({ lat, lng, onProgress });
//   scene.setColorMode('elevation' | 'classification' | 'intensity');
//   scene.setPointSize(px);
//   scene.setDark(bool);
//   scene.resetView();
//   scene.dispose();
//
// Lifecycle: one Instance + one PointCloud entity per COPC url. When a
// loadAt resolves to a DIFFERENT tile, the whole scene is torn down and
// rebuilt (COPCSource is effectively a handle to one remote file; there is
// no supported "swap the URL in place" API). Same tile -> the beacon is
// re-planted at the new building and the camera re-framed, no rebuild.
// Color mode / point size / theme apply reactively without a rebuild.

import * as THREE from 'three';
import proj4 from 'proj4';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import COPCSource from '@giro3d/giro3d/sources/COPCSource.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import ColorMapMode from '@giro3d/giro3d/core/ColorMapMode.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';
import { ASPRS_CLASSIFICATIONS } from '@giro3d/giro3d/renderer/PointCloudMaterial.js';

import { getSwissCrs, EPSG_2056_ID } from './crs.js';
import { createCopcRangeGetter } from './copcGetter.js';
import { prepareTile, pollTileUntilSettled, PollCancelledError } from './lidarApi.js';
import { buildLocationBeacon, disposeObject3D } from './beacon.js';

// Canvas background per theme. Dark = a dark slate (not pure black) so the
// LiDAR points, which skew dark at low elevation, keep contrast; light = a
// cool pale slate that reads as "instrument paper" while the colored points
// stay legible. Switched at runtime via the engine's clearColor (see setDark).
const BG_DARK = 0x1a2433;
const BG_LIGHT = 0xe7ecf3;

// laz-perf's WASM decoder is fetched relative to this path (both the
// main-thread path and the LAZ worker pool read from the same configured
// location). Must be called before the first COPCSource is constructed,
// so this runs once at module load.
setLazPerfPath('/assets/wasm');

// Attribute name to activate on the PointCloud entity for each UI color mode.
// 'Classification' renders through the built-in ASPRS discrete palette;
// 'Z' and 'Intensity' both render through the entity's single shared
// elevationColorMap slot (see applyColorMode for why the colormap bounds must
// be re-synced on every switch).
const ATTRIBUTE_BY_MODE = {
    classification: 'Classification',
    elevation: 'Z',
    intensity: 'Intensity',
};

// Matches lidaroo's default point size (px).
const DEFAULT_POINT_SIZE = 2;

// The modal frames ONE building, not lidaroo's whole 1 km2 tile: an oblique
// 3/4 view orbiting the beacon at this radius reads as "the building and its
// immediate block".
const BUILDING_FRAME_RADIUS_M = 180;

// A perceptually smooth blue -> green -> yellow -> red ramp for the
// elevation/intensity colormap slot.
function buildRamp() {
    const stops = [
        [0.20, 0.42, 0.85], // bright blue (low)
        [0.10, 0.70, 0.85], // cyan
        [0.35, 0.85, 0.45], // green
        [0.97, 0.87, 0.28], // yellow
        [0.98, 0.40, 0.22], // red-orange (high)
    ];
    const colors = [];
    const steps = 64;
    for (let i = 0; i < steps; i++) {
        const t = (i / (steps - 1)) * (stops.length - 1);
        const idx = Math.min(Math.floor(t), stops.length - 2);
        const localT = t - idx;
        const [r0, g0, b0] = stops[idx];
        const [r1, g1, b1] = stops[idx + 1];
        colors.push(
            new THREE.Color(
                r0 + (r1 - r0) * localT,
                g0 + (g1 - g0) * localT,
                b0 + (b1 - b0) * localT,
            ),
        );
    }
    return colors;
}

// Applies the active-attribute + colormap bounds for the requested color
// mode. Elevation and intensity share a single elevationColorMap slot on the
// entity, so the colormap's min/max must be re-synced to the newly active
// attribute's own range every time the mode changes; otherwise switching
// from elevation to intensity would keep rendering with the Z range applied
// to intensity values (or vice versa), which looks like a flat, wrong color.
function applyColorMode(pointCloud, colorMap, mode) {
    const attributeName = ATTRIBUTE_BY_MODE[mode];
    const supported = pointCloud.getSupportedAttributes();
    const attribute = supported.find((a) => a.name === attributeName);

    if (!attribute) {
        // Tile does not carry this dimension (e.g. no Intensity channel);
        // fall back to whatever is already active rather than throwing.
        return;
    }

    if (attribute.interpretation === 'unknown' && attribute.min !== undefined && attribute.max !== undefined) {
        colorMap.min = attribute.min;
        colorMap.max = attribute.max;
    }

    if (mode === 'classification') {
        // Giro3D initializes the per-attribute classification palette to a flat
        // default that is invisible on the dark background (classification is
        // NOT auto-applied in 2.0.3). Copy in the standard ASPRS colors
        // (ground = brown, vegetation = greens, building = blue, water, etc.)
        // so the view reads clearly.
        const classes = pointCloud.getAttributeClassifications(attributeName);
        for (let i = 0; i < classes.length && i < ASPRS_CLASSIFICATIONS.length; i++) {
            classes[i].color.copy(ASPRS_CLASSIFICATIONS[i].color);
            classes[i].visible = ASPRS_CLASSIFICATIONS[i].visible;
        }
    }

    pointCloud.setColoringMode('attribute');
    pointCloud.setActiveAttribute(attributeName);
}

export function createCopcScene({ container }) {
    if (!container) throw new Error('createCopcScene: container is required');

    let disposed = false;
    let loadSeq = 0;

    // Live scene handles — all null until the first loadAt builds a scene.
    let instance = null;
    let pointCloud = null;
    let controls = null;
    let colorMap = null;
    let beacon = null;
    let afterRenderHandler = null;
    let kickTimer = 0;
    let currentCopcUrl = null;
    let currentMarker = null; // { lat, lng } of the framed building (WGS84)

    // User-facing settings, kept across rebuilds. Dark defaults to the page
    // theme at creation time; the modal keeps it live via setDark.
    let colorMode = 'elevation';
    let pointSize = DEFAULT_POINT_SIZE;
    let dark = document.documentElement.classList.contains('dark');
    // Flips true once the entity has painted its first points, so color-mode /
    // point-size changes are re-applied against a fully live material.
    // Applying them only right after add() resolves is not enough: the first
    // octree nodes stream in after add() resolves, and a setActiveAttribute
    // issued before any geometry exists does not stick.
    let ready = false;

    // Instance does not auto-observe container resizes on its own in all
    // embedding contexts (the modal is hidden/shown and flex-sized), so keep
    // the renderer/camera aspect in sync explicitly.
    const resizeObserver = new ResizeObserver(() => {
        instance?.notifyChange(undefined, { immediate: true });
    });
    resizeObserver.observe(container);

    // Projects the current marker to LV95, clamped into the tile footprint
    // (same clamping as the beacon, so camera and pin agree). Returns null
    // when there is no marker or the projection fails.
    function markerLV95(bbox) {
        const marker = currentMarker;
        if (!marker || !Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) return null;
        let projected;
        try {
            projected = proj4('EPSG:4326', EPSG_2056_ID, [marker.lng, marker.lat]);
        } catch {
            return null;
        }
        const [easting, northing] = projected;
        if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
        return {
            x: THREE.MathUtils.clamp(easting, bbox.min.x, bbox.max.x),
            y: THREE.MathUtils.clamp(northing, bbox.min.y, bbox.max.y),
        };
    }

    // Frames the camera on a target point with an oblique 3/4 vantage at the
    // given radius. Giro3D uses a Z-up world for projected CRSs (LV95 here);
    // three.js MapControls default to Y-up, which leaves the camera looking
    // at empty space beside the tile — force Z-up so orbit/pan and framing
    // line up. The X/Y offset + Z lift keeps the orbit controls out of the
    // degenerate straight-down gimbal position.
    function frameCameraAt(target, radius) {
        if (!instance || !controls) return;
        const camera = instance.view.camera;
        camera.up.set(0, 0, 1);
        camera.position.set(
            target.x + radius * 0.85,
            target.y - radius * 0.85,
            target.z + radius * 0.9,
        );
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.near = Math.max(radius / 1000, 0.5);
            camera.far = radius * 100;
            camera.updateProjectionMatrix();
        }
        camera.lookAt(target.x, target.y, target.z);
        controls.target.set(target.x, target.y, target.z);
        controls.update();
        instance.notifyChange();
    }

    // Frames the building: camera orbits the beacon location at ~180 m, at
    // ground height (the bbox floor is a good-enough ground approximation for
    // a 1 km2 tile). Falls back to framing the whole tile bounding box when
    // the marker is missing or unprojectable.
    function frameCamera() {
        if (!instance || !controls || !pointCloud) return;
        const bbox = pointCloud.getBoundingBox();
        if (!bbox || bbox.isEmpty()) return;

        const point = markerLV95(bbox);
        if (point) {
            frameCameraAt({ x: point.x, y: point.y, z: bbox.min.z }, BUILDING_FRAME_RADIUS_M);
        } else {
            const center = bbox.getCenter(new THREE.Vector3());
            const size = bbox.getSize(new THREE.Vector3());
            frameCameraAt(center, Math.max(size.x, size.y, size.z, 1));
        }
    }

    // (Re-)plants the red pin beacon at the current marker.
    function replantBeacon() {
        if (!instance || !pointCloud) return;
        if (beacon) {
            instance.threeObjects.remove(beacon);
            disposeObject3D(beacon);
            beacon = null;
        }
        const marker = currentMarker;
        const next = buildLocationBeacon(marker?.lat, marker?.lng, pointCloud.getBoundingBox());
        if (next) {
            instance.threeObjects.add(next);
            beacon = next;
            instance.notifyChange();
        }
    }

    // Kick the first paint. Giro3D's on-demand render loop does not flush the
    // initial frame from notifyChange alone in this mount sequence (the scene
    // stays blank until the first user interaction), but its window-resize
    // handler does force a full re-render. Dispatching a resize (across a few
    // frames, to survive layout settling) reliably paints the framed, colored
    // scene on load. Repeated ~8x at 500 ms, matching lidaroo.
    function startRenderKick() {
        if (kickTimer) window.clearInterval(kickTimer);
        const kick = () => {
            instance?.notifyChange?.(undefined, { immediate: true });
            // Force a synchronous render directly (Instance.render), which
            // paints the current scene without waiting for the on-demand loop
            // to schedule one.
            instance?.render?.();
            window.dispatchEvent(new Event('resize'));
        };
        kick();
        let count = 0;
        kickTimer = window.setInterval(() => {
            kick();
            count += 1;
            if (count >= 8) {
                window.clearInterval(kickTimer);
                kickTimer = 0;
            }
        }, 500);
    }

    // Full teardown of the live scene (the port of PointCloudViewer's effect
    // cleanup) so a different tile can be built from scratch.
    function teardownScene() {
        if (kickTimer) {
            window.clearInterval(kickTimer);
            kickTimer = 0;
        }
        if (instance && afterRenderHandler) {
            instance.removeEventListener('after-render', afterRenderHandler);
        }
        afterRenderHandler = null;
        controls?.dispose();
        controls = null;
        colorMap?.dispose();
        colorMap = null;
        if (beacon) {
            instance?.threeObjects.remove(beacon);
            disposeObject3D(beacon);
            beacon = null;
        }
        pointCloud = null;
        instance?.dispose();
        instance = null;
        currentCopcUrl = null;
        ready = false;
    }

    // Builds the Instance + PointCloud for one COPC url and resolves once the
    // entity is added and framed. Throws when the source cannot be added
    // (network / parse failure) so the modal can show its error state.
    async function buildScene(copcUrl, seq) {
        ready = false;

        instance = new Instance({
            target: container,
            crs: getSwissCrs(),
            // Theme-matched background (see BG_DARK / BG_LIGHT). Switched at
            // runtime by setDark without tearing down the scene.
            backgroundColor: dark ? BG_DARK : BG_LIGHT,
            // preserveDrawingBuffer keeps the last painted frame readable after
            // the browser composites it, so a canvas capture can toBlob() the
            // canvas asynchronously (a WebGL canvas without it reads back blank).
            renderer: { preserveDrawingBuffer: true, antialias: true },
        });
        currentCopcUrl = copcUrl;

        colorMap = new ColorMap({
            colors: buildRamp(),
            min: 0,
            max: 1,
            mode: ColorMapMode.Elevation,
        });

        // Pass a validating byte-range getter rather than the URL string so
        // that a response which ignores the Range header (the RES backend
        // intermittently returns the whole file, defeating the range read) is
        // sliced back down to the requested window instead of being mis-parsed
        // as a corrupt LAS/EVLR header — the `Invalid EVLR header length (must
        // be 60): <full-length>` crash. A genuinely broken response now
        // rejects add() cleanly and lands in the caller's catch.
        const source = new COPCSource({ url: createCopcRangeGetter(copcUrl) });
        const entity = new PointCloud({ source });
        entity.elevationColorMap = colorMap;

        // Keep the material settings re-applied as the octree streams in more
        // detail. Once the first nodes have painted, mark ready and re-apply
        // the current color mode / point size against the now-live material
        // (idempotent: only the first transition does work).
        afterRenderHandler = () => {
            const pc = pointCloud;
            if (!pc || ready) return;
            const shown = pc.displayedPointCount || 0;
            if (shown > 0) {
                ready = true;
                if (colorMap) applyColorMode(pc, colorMap, colorMode);
                pc.pointSize = pointSize;
                instance?.notifyChange();
            }
        };
        instance.addEventListener('after-render', afterRenderHandler);

        await instance.add(entity);
        // A newer loadAt (or dispose) superseded this build while the source
        // was loading its headers; its teardown already ran or will run on the
        // handles it owns, so just stop here.
        if (disposed || seq !== loadSeq) return;

        pointCloud = entity;

        // Default color mode = elevation; classification is NOT auto-applied
        // in Giro3D 2.0.3. This first application happens before any points
        // have painted; the after-render handler above re-applies it once the
        // first octree nodes are live so it actually sticks.
        applyColorMode(pointCloud, colorMap, colorMode);
        pointCloud.pointSize = pointSize;

        // Camera: perspective + MapControls (pan/orbit/zoom). Damping needs a
        // per-frame controls.update(), which Giro3D's on-demand render loop
        // does not provide; with it enabled the camera stays mid-transition
        // (pointed at empty space) until the first user interaction nudges it,
        // so the scene loads blank. Keep it off so the camera snaps straight
        // to the framed view on load.
        const camera = instance.view.camera;
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.near = 1;
            camera.far = 1_000_000;
            camera.updateProjectionMatrix();
        }
        controls = new MapControls(camera, instance.domElement);
        controls.enableDamping = false;
        instance.view.setControls(controls);
        controls.addEventListener('change', () => instance?.notifyChange());

        frameCamera();
        replantBeacon();
        startRenderKick();
    }

    // Resolves the COPC tile covering {lat, lng} (preparing/converting it on
    // the RES box if needed, reporting progress via onProgress(percent, phase))
    // and shows it. Same tile as the one already on screen -> no rebuild, the
    // beacon just moves to the new building and the camera re-frames there.
    // Overlapping calls are sequence-guarded: a newer loadAt cancels the older
    // one's polling and wins the scene.
    async function loadAt({ lat, lng, onProgress }) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error('createCopcScene.loadAt: lat/lng are required');
        }
        const seq = ++loadSeq;
        const isCancelled = () => disposed || seq !== loadSeq;

        const prepared = await prepareTile(lat, lng);
        if (isCancelled()) return;

        let copcUrl = prepared.copcUrl;
        if (prepared.status !== 'ready') {
            // Cold tile: the box is converting LAS -> COPC (~45 s). Surface the
            // backend's progress so the modal can narrate the wait.
            onProgress?.(0, prepared.status);
            let settled;
            try {
                settled = await pollTileUntilSettled(prepared.tileId, {
                    isCancelled,
                    onUpdate: (status) => {
                        if (isCancelled()) return;
                        const percent = Number.isFinite(status.progress)
                            ? Math.max(0, Math.min(100, Math.round(status.progress)))
                            : 0;
                        onProgress?.(percent, status.phase || status.status);
                    },
                });
            } catch (err) {
                // A superseding loadAt cancelled us; the newer call owns the
                // scene and the modal status. Not an error to surface.
                if (err instanceof PollCancelledError) return;
                throw err;
            }
            if (isCancelled()) return;
            if (settled.status === 'error') {
                throw new Error(settled.error || 'Tile conversion failed');
            }
            copcUrl = settled.copcUrl;
        }

        currentMarker = { lat, lng };

        // Same tile already streaming: just move the pin and re-frame. This is
        // the common case when the user walks a list of comparables inside one
        // neighborhood.
        if (instance && pointCloud && copcUrl === currentCopcUrl) {
            replantBeacon();
            frameCamera();
            startRenderKick();
            return;
        }

        teardownScene();
        await buildScene(copcUrl, seq);
    }

    function setColorMode(mode) {
        if (!(mode in ATTRIBUTE_BY_MODE)) return;
        colorMode = mode;
        if (pointCloud && colorMap && instance) {
            applyColorMode(pointCloud, colorMap, colorMode);
            instance.notifyChange();
        }
    }

    function setPointSize(px) {
        if (!Number.isFinite(px) || px <= 0) return;
        pointSize = px;
        if (pointCloud && instance) {
            pointCloud.pointSize = pointSize;
            instance.notifyChange();
        }
    }

    // Theme flip. The engine re-applies its stored `clearColor` on every
    // clear, so updating that field (rather than the renderer's transient
    // clear color) makes the change stick.
    function setDark(next) {
        dark = !!next;
        if (instance) {
            instance.engine.clearColor = new THREE.Color(dark ? BG_DARK : BG_LIGHT);
            instance.notifyChange(undefined, { immediate: true });
        }
    }

    function resetView() {
        frameCamera();
    }

    function dispose() {
        disposed = true;
        loadSeq++;
        resizeObserver.disconnect();
        teardownScene();
    }

    return {
        loadAt,
        setColorMode,
        getColorMode: () => colorMode,
        setPointSize,
        setDark,
        resetView,
        dispose,
    };
}
