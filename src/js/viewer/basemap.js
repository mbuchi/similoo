// Basemap switching.
//
// The viewer carries two imagery layers — ArcGIS World Imagery (satellite,
// the default) and ArcGIS World Hillshade (terrain shading only, no baked
// solar shadows). The day-tour swaps to hillshade so the dynamic shadows we
// cast read cleanly against a neutral ground, and swaps back to imagery when
// it stops.
//
// We keep both layers in the imagery collection and just flip their `.show`
// flag — Cesium already has the tiles cached on the second swap, so the
// switch is instant and there's no fetch spike.

import { createHillshadeImageryProvider } from './providers.js';

const STATE_KEY = '_hoodBasemapState';

export async function setupBasemaps(viewer) {
    if (!viewer || viewer.isDestroyed?.()) return;

    // The first imagery layer (constructed in viewerConfig) is the satellite
    // imagery, and it's already visible. Add the hillshade alongside it as a
    // hidden layer so we can flash between them without re-fetching tiles.
    const layers = viewer.imageryLayers;
    const imageryLayer = layers.get(0);

    const hillshadeProvider = await createHillshadeImageryProvider();
    const hillshadeLayer = layers.addImageryProvider(hillshadeProvider);
    hillshadeLayer.show = false;

    viewer[STATE_KEY] = {
        imageryLayer,
        hillshadeLayer,
        current: 'imagery'
    };
}

function getState(viewer) {
    return viewer ? viewer[STATE_KEY] : null;
}

export function setHillshadeBasemap(viewer) {
    const state = getState(viewer);
    if (!state || state.current === 'hillshade') return;
    state.imageryLayer.show = false;
    state.hillshadeLayer.show = true;
    state.current = 'hillshade';
    viewer.scene.requestRender();
}

export function setImageryBasemap(viewer) {
    const state = getState(viewer);
    if (!state || state.current === 'imagery') return;
    state.hillshadeLayer.show = false;
    state.imageryLayer.show = true;
    state.current = 'imagery';
    viewer.scene.requestRender();
}
