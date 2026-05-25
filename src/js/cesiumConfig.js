// Cesium configuration
window.CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.105.1/Build/Cesium/';

// The Cesium Ion token is build-time injected from VITE_CESIUM_ION_TOKEN
// (set in Vercel / your .env). When it isn't set, Ion-backed assets — the
// "3D OSM + Cesium terrain" preset (OSM Buildings + World Terrain) — are
// disabled in the UI rather than firing 401s; the Swiss and Google presets
// don't touch Ion and keep working.
const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken;
} else {
    console.warn(
        'VITE_CESIUM_ION_TOKEN is not set — the "3D OSM + Cesium terrain" preset will be disabled.'
    );
}
