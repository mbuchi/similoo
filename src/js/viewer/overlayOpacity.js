// Overlay opacity — the suite-wide `?opacity=0..100` deep-link parameter.
// Authority: aireon-shared/docs/URL_PARAMS_STANDARD.md.
//
// One factor over the layers similoo draws ON TOP of the swisstopo SWISSIMAGE
// basemap. 100 (the default) leaves every layer at its authored opacity and the
// parameter is omitted from links; 0 makes the overlay fully transparent. The
// imagery underneath is never faded — that is the whole point of the parameter.
//
// WHY THIS MODULE EXISTS: similoo is split in two. The MapLibre map lives in
// the vanilla-JS engine (src/js/main.js + viewer/viewerConfig.js) while
// registerUrlSyncProviders lives in the React shell (src/App.tsx). Both sides
// need the value, and neither may own a second copy of it, so this module is
// the single owner: the engine drives the controller, the shell reads the
// getter for its sync provider.
//
// similoo renders no BasemapPicker (one hardcoded swisstopo raster, no picker
// and no registry id), so per the standard it honors the inbound parameter
// without shipping a slider. The percent is therefore read once at module load
// and never changes for the life of the page.

import { getOverlayOpacityOverride } from '@aireon/shared/url-params';
import {
    createOverlayOpacityController,
    OVERLAY_OPACITY_DEFAULT,
} from '@aireon/shared/map-overlay-opacity';
import {
    BUILDING_LAYER,
    PARCEL_FILL_LAYER,
    PARCEL_OUTLINE_LAYER,
} from './viewerConfig.js';

const percent = getOverlayOpacityOverride() ?? OVERLAY_OPACITY_DEFAULT;

// similoo's OWN data layers.
//
// Deliberately EXCLUDED:
//   'basemap' / 'bg'  — the swisstopo imagery and the backdrop painted outside
//                       Swiss coverage. Fading the basemap is exactly what this
//                       parameter must never do.
//   'cmp-hover-fill'  \
//   'cmp-hover-glow'   > the hover affordance for the hovered comparable card.
//   'cmp-hover-line'  /  main.js animates their opacity imperatively every
//                       frame, so the controller and the animation would fight
//                       over the same paint property.
const OVERLAY_LAYER_IDS = [PARCEL_FILL_LAYER, PARCEL_OUTLINE_LAYER, BUILDING_LAYER];

let controller = null;

/**
 * Create the controller. Takes a GETTER, never a map instance: the map is
 * created asynchronously by initializeViewer().
 *
 * @param {() => import('maplibre-gl').Map | null} getMap
 */
export function initOverlayOpacity(getMap) {
    if (!controller) {
        controller = createOverlayOpacityController(getMap, percent);
    }
    return controller;
}

/**
 * Bring similoo's data layers onto the current factor. Call it once the map
 * exists, and again after any code path that re-authors one of their opacity
 * paint properties (applyZoneHighlight rewrites the zone fill's fill-opacity
 * from scratch, which would otherwise wipe the factor). Layer ids that do not
 * exist yet are skipped silently, and the controller remembers what it wrote,
 * so repeated calls cannot compound the fade.
 *
 * similoo never calls setStyle, so there is no basemap-swap re-add path.
 */
export function registerOverlayLayers() {
    controller?.register(OVERLAY_LAYER_IDS);
}

/** Current factor, 0–100. */
export function getOverlayOpacityPercent() {
    return percent;
}

/**
 * The value the `opacity` URL sync provider should write: null at the default,
 * so an ordinary view never carries `?opacity=100` and only a dialed-back
 * overlay shows up in a copied link.
 */
export function overlayOpacityUrlValue() {
    return percent === OVERLAY_OPACITY_DEFAULT ? null : percent;
}
