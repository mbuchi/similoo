// Building tilesets + paired terrain.
//
// hood ships three layer presets, swapped together from Settings → Display:
//
//   * Swiss (default) — SwissTLM3D ("SB3D") LOD-2 buildings (sloped roofs,
//     Swiss-specific accuracy) on the swisstopo high-resolution Swiss DEM.
//     Rendered with the baked SwissTLM3D textures (no customShader). The
//     baked textures are inconsistent across the dataset (yellow on some
//     walls, red roofs on some buildings, untextured-white roofs on others)
//     but the previous wall-grey + roof-red repaint was reading wrong on
//     screen, so it's removed for now.
//
//   * OSM — Cesium-curated OSM Buildings (Ion asset id 96188) on Cesium World
//     Terrain (Ion asset id 1). LOD-1 extruded footprints, planet-wide
//     coverage with OSM-native colors (`building:colour` tag if present, a
//     neutral default otherwise).
//
//   * Google — Google Photorealistic 3D Tiles. Global photogrammetric mesh
//     that brings its own terrain + imagery, so the basemap globe is hidden
//     while this preset is active.
//
// The Swiss tilesets load at startup; OSM building tileset loads at startup
// too but its terrain (Cesium World Terrain) and the Google tileset load
// lazily on first switch so the app boots without paying any non-Swiss
// round-trips. Swaps after the first are instant because Cesium has the
// tiles cached.

import {
    getCesiumTileset,
    createCesiumWorldTerrainProvider,
    createGooglePhotorealisticTileset
} from './providers.js';

const STATE_KEY = '_hoodBuildingsState';

// Preset-change listeners. Modules outside buildings.js (e.g. the building
// picker, which needs to disable itself on the Google mesh preset) can
// register a callback via onPresetChange() and get notified after every
// successful preset swap. Listeners receive the new preset name
// ('swiss' | 'osm' | 'google').
const presetChangeListeners = new Set();

function notifyPresetChange(viewer) {
    const preset = getActivePreset(viewer);
    presetChangeListeners.forEach((cb) => {
        try {
            cb(preset);
        } catch (err) {
            console.error('onPresetChange listener threw:', err);
        }
    });
}

export function onPresetChange(cb) {
    presetChangeListeners.add(cb);
    return () => presetChangeListeners.delete(cb);
}

// Web-Mercator-style "zoom level" inferred from the Cesium camera altitude.
// Cesium has no native zoom integer; we approximate it from the camera
// height so the user can think in familiar slippy-map units. The constant
// is tuned so a height of ~1.2 km maps to z=15 (street-level 3D buildings
// start to make sense around there).
export function cameraHeightToZoom(height) {
    if (!Number.isFinite(height) || height <= 0) return 0;
    return Math.log2(40075016 / height);
}

export const DEFAULT_BUILDINGS_MIN_ZOOM = 15;

function configureSwissTileset(tileset) {
    tileset.shadows = Cesium.ShadowMode.ENABLED;
    tileset.castShadows = true;
    tileset.receiveShadows = true;

    // No customShader — render the SB3D tileset with its baked SwissTLM3D
    // textures. The previous wall-grey + roof-red repaint (v0.3.8 → v0.3.12)
    // is removed for now because the clay-red roof override was reading
    // wrong on screen (every building came out the same saturated orange
    // regardless of the actual roof). The baked textures are inconsistent
    // across the dataset, but they're closer to the truth than a blanket
    // repaint — revisit when we have a real per-surface wall/roof signal.

    tileset.cullWithChildrenBounds = true;
    tileset.cullRequestsWhileMoving = true;
    tileset.preloadWhenHidden = false;
    tileset.skipLevelOfDetail = true;
}

function configureOsmTileset(tileset) {
    tileset.shadows = Cesium.ShadowMode.ENABLED;
    tileset.castShadows = true;
    tileset.receiveShadows = true;
    // Leave OSM coloring alone — Cesium-curated OSM Buildings already uses
    // the `building:colour` OSM tag where present and a neutral default
    // otherwise. The wall-grey shader is SB3D-specific (the yellow walls
    // were the problem); OSM walls already read fine.
}

function configureGoogleTileset(tileset) {
    // Google tiles ship with baked lighting / shadows in the photogrammetry;
    // don't double up with Cesium-cast shadows.
    tileset.shadows = Cesium.ShadowMode.DISABLED;
    tileset.castShadows = false;
    tileset.receiveShadows = false;
}

export async function setupBuildings(viewer) {
    if (!viewer || viewer.isDestroyed?.()) return;

    const swissTileset = await getCesiumTileset();
    viewer.scene.primitives.add(swissTileset);
    configureSwissTileset(swissTileset);

    let osmTileset = null;
    if (hasCesiumIonToken()) {
        try {
            osmTileset = await Cesium.createOsmBuildingsAsync();
            osmTileset.show = false;
            viewer.scene.primitives.add(osmTileset);
            configureOsmTileset(osmTileset);
        } catch (err) {
            // Non-fatal: if Cesium Ion can't serve OSM Buildings (quota,
            // network, expired key) we just don't expose the toggle. The
            // Swiss tileset is unaffected.
            console.error('OSM Buildings tileset failed to load:', err);
        }
    }
    // If the token isn't set we skip the network call entirely and leave
    // osmTileset null — settingsMenu reads hasOsmBuildings() to disable
    // the toggle without firing a 401.

    viewer[STATE_KEY] = {
        swissTileset,
        osmTileset,
        googleTileset: null,
        swissTerrain: viewer.terrainProvider,
        cesiumTerrain: null,
        // EllipsoidTerrainProvider returns height 0 everywhere — used while
        // the Google preset is active so terrain-sampling code (geocoder
        // fly-to, camera-info readout) doesn't hand back Switzerland-only
        // swisstopo heights for global locations and float pins/markers.
        // The actual visible surface under Google is sampled via the scene
        // depth pick — see sampleSurfaceHeight().
        ellipsoidTerrain: new Cesium.EllipsoidTerrainProvider(),
        current: 'swiss',
        minZoom: DEFAULT_BUILDINGS_MIN_ZOOM,
        inRange: true,
    };

    attachZoomVisibility(viewer);
    applyZoomVisibility(viewer);
}

// Show/hide the Swiss/OSM building tilesets based on the camera's current
// "zoom level". Far-away views (z < minZoom) hide the active building
// tileset so Cesium stops streaming tiles; we also call trimLoadedTiles()
// to free the already-fetched cache. As soon as the user zooms back in we
// flip `show=true` and Cesium re-requests whatever tiles the view needs.
//
// Google Photorealistic 3D is intentionally NOT zoom-gated — it supplies
// the entire visible scene (terrain + imagery + buildings combined), so
// hiding it at low zoom would leave a blank globe.
function attachZoomVisibility(viewer) {
    const onChange = () => applyZoomVisibility(viewer);
    viewer.camera.changed.addEventListener(onChange);
    viewer.camera.moveEnd.addEventListener(onChange);
}

function applyZoomVisibility(viewer) {
    const s = getState(viewer);
    if (!s) return;
    const height = viewer.camera.positionCartographic?.height;
    if (!Number.isFinite(height)) return;
    const zoom = cameraHeightToZoom(height);
    const inRange = zoom >= s.minZoom;
    if (inRange === s.inRange) return;
    s.inRange = inRange;
    syncTilesetVisibility(viewer);
    viewer.scene.requestRender();
}

// Recomputes inRange from the current camera height and applies it,
// even if the cached value matches — used after the user adjusts the
// threshold so the next camera-driven re-evaluation isn't skipped.
function reapplyZoomVisibility(viewer) {
    const s = getState(viewer);
    if (!s) return;
    const height = viewer.camera.positionCartographic?.height;
    if (!Number.isFinite(height)) return;
    const zoom = cameraHeightToZoom(height);
    s.inRange = zoom >= s.minZoom;
    syncTilesetVisibility(viewer);
    viewer.scene.requestRender();
}

function syncTilesetVisibility(viewer) {
    const s = getState(viewer);
    if (!s) return;
    // Swiss/OSM are building tilesets — gated by zoom so far-out views skip
    // streaming detailed building geometry.
    const swissShouldShow = s.inRange && s.current === 'swiss';
    const osmShouldShow = s.inRange && s.current === 'osm';
    // Google is the global photogrammetric scene; show whenever it's the
    // active preset, regardless of zoom.
    const googleShouldShow = s.current === 'google';
    setTilesetShow(s.swissTileset, swissShouldShow);
    setTilesetShow(s.osmTileset, osmShouldShow);
    setTilesetShow(s.googleTileset, googleShouldShow);
}

function setTilesetShow(tileset, shouldShow) {
    if (!tileset) return;
    const wasShown = tileset.show;
    tileset.show = shouldShow;
    if (wasShown && !shouldShow) trimTiles(tileset);
}

function trimTiles(tileset) {
    try {
        tileset.trimLoadedTiles?.();
    } catch {}
}

export function setBuildingsMinZoom(viewer, zoom) {
    const s = getState(viewer);
    if (!s) return;
    const next = Number(zoom);
    if (!Number.isFinite(next)) return;
    s.minZoom = next;
    reapplyZoomVisibility(viewer);
}

export function getBuildingsMinZoom(viewer) {
    const s = getState(viewer);
    return s ? s.minZoom : DEFAULT_BUILDINGS_MIN_ZOOM;
}

function getState(viewer) {
    return viewer ? viewer[STATE_KEY] : null;
}

export function hasOsmBuildings(viewer) {
    const s = getState(viewer);
    return !!(s && s.osmTileset);
}

// Cesium Ion-backed assets (OSM Buildings + World Terrain) need a token
// in VITE_CESIUM_ION_TOKEN. Vite inlines the env access at build time, so
// this is effectively a compile-time constant in the bundle.
export function hasCesiumIonToken() {
    return !!import.meta.env.VITE_CESIUM_ION_TOKEN;
}

// Google 3D tiles require a Google Maps API key; if the env var is missing
// we surface that as "unavailable" so the toggle can be disabled.
export function hasGoogleApiKey() {
    return !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
}

export function setSwissLayers(viewer) {
    const s = getState(viewer);
    if (!s || s.current === 'swiss') return true;
    s.current = 'swiss';
    viewer.scene.globe.show = true;
    viewer.terrainProvider = s.swissTerrain;
    syncTilesetVisibility(viewer);
    viewer.scene.requestRender();
    notifyPresetChange(viewer);
    return true;
}

export async function setOsmLayers(viewer) {
    const s = getState(viewer);
    if (!s || s.current === 'osm') return true;
    if (!hasCesiumIonToken()) {
        console.warn(
            'Cannot switch to OSM preset: VITE_CESIUM_ION_TOKEN is not set.'
        );
        return false;
    }
    if (!s.osmTileset) {
        console.warn('OSM Buildings tileset is unavailable — staying on current preset');
        return false;
    }
    if (!s.cesiumTerrain) {
        try {
            s.cesiumTerrain = await createCesiumWorldTerrainProvider();
        } catch (err) {
            console.error('Cesium World Terrain failed to load:', err);
            return false;
        }
    }
    s.current = 'osm';
    viewer.scene.globe.show = true;
    viewer.terrainProvider = s.cesiumTerrain;
    syncTilesetVisibility(viewer);
    viewer.scene.requestRender();
    notifyPresetChange(viewer);
    return true;
}

export async function setGoogleLayers(viewer) {
    const s = getState(viewer);
    if (!s || s.current === 'google') return true;
    if (!hasGoogleApiKey()) {
        console.warn(
            'Cannot switch to Google preset: VITE_GOOGLE_MAPS_API_KEY is not set.'
        );
        return false;
    }
    if (!s.googleTileset) {
        try {
            s.googleTileset = await createGooglePhotorealisticTileset();
            viewer.scene.primitives.add(s.googleTileset);
            configureGoogleTileset(s.googleTileset);
        } catch (err) {
            console.error('Google Photorealistic 3D Tiles failed to load:', err);
            return false;
        }
    }
    s.current = 'google';
    // Google tiles bring their own terrain + imagery — hiding the imagery
    // globe avoids z-fighting and lets the photogrammetry show through.
    // Swap the terrain provider to ellipsoid so terrain-sampling calls
    // don't return stale swisstopo / Cesium-World heights that wouldn't
    // match the Google photogrammetric surface.
    viewer.scene.globe.show = false;
    viewer.terrainProvider = s.ellipsoidTerrain;
    syncTilesetVisibility(viewer);
    viewer.scene.requestRender();
    notifyPresetChange(viewer);
    return true;
}

// Returns whichever building tileset is currently visible — used by anything
// that needs to apply per-tileset settings (shadow toggle, day-tour) so it
// hits the active tileset, not whichever happens to sit at primitives[0].
export function getActiveBuildingsTileset(viewer) {
    const s = getState(viewer);
    if (!s) return null;
    if (s.current === 'osm') return s.osmTileset;
    if (s.current === 'google') return s.googleTileset;
    return s.swissTileset;
}

// Name of the active preset: 'swiss' | 'osm' | 'google' (or null pre-setup).
export function getActivePreset(viewer) {
    const s = getState(viewer);
    return s ? s.current : null;
}

// Height of the visible ground at (longitude, latitude) — what callers like
// the geocoder fly-to and the camera-info HUD need so things land on the
// surface instead of hovering above or punching through it.
//
// Picks the strategy per preset:
//   * Swiss / OSM — sample the terrain provider directly (fast, matches the
//     terrain each building tileset was authored against).
//   * Google — the photogrammetric mesh isn't exposed as a terrain provider,
//     so depth-pick the scene via sampleHeightMostDetailed, which reads the
//     actual rendered Google surface.
export async function sampleSurfaceHeight(viewer, longitude, latitude) {
    const cartographic = Cesium.Cartographic.fromDegrees(longitude, latitude);
    if (getActivePreset(viewer) === 'google') {
        try {
            await viewer.scene.sampleHeightMostDetailed([cartographic]);
            return cartographic.height || 0;
        } catch (err) {
            console.warn('sampleHeightMostDetailed (Google) failed:', err);
            return 0;
        }
    }
    const updated = await Cesium.sampleTerrainMostDetailed(
        viewer.scene.terrainProvider,
        [cartographic]
    );
    return updated[0].height || 0;
}
