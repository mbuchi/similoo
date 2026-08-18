import { DEFAULT_MAP_ZOOM } from '@aireon/shared/map-defaults';
// ⚠ NAMESPACE import, not a default one: MapLibre GL v6 is ESM-only and ships no
// default export, so `import maplibregl from 'maplibre-gl'` resolves to
// undefined and `new maplibregl.Map(...)` below throws at runtime.
import * as maplibregl from 'maplibre-gl';
import { applyMapWorkerUrl } from '@aireon/shared/map-worker';

// ⚠ WORKER SEAM — must stay at module scope, before the first `new
// maplibregl.Map(...)`. v6 derives its tile-worker URL from its own
// `import.meta.url`, which is meaningless once Vite has rewritten the engine
// into the `maplibre` chunk: the worker never starts, no vector tile parses and
// the canvas stays blank. `vite dev` hides this — it only reproduces in a
// production build, so a clean `npm run dev` is not evidence.
//
// This call belongs HERE and not in an eager module: viewerConfig.js is reached
// only through App.tsx's dynamic `import('./js/main.js')`, so the static
// `maplibre-gl` import above stays inside the lazy chunk. Hoisting either the
// import or this call into src/main.tsx or App.tsx would silently undo the
// code-split that keeps ~220 KB off the first paint. applyMapWorkerUrl is
// idempotent and no-ops on a module without setWorkerUrl.
applyMapWorkerUrl(maplibregl);

// ⚠ `maplibre-gl/dist/maplibre-gl.css` is imported from src/main.tsx, NOT here.
// This module now lives in a DYNAMIC chunk (App.tsx loads the engine on demand),
// and a dynamic chunk's stylesheet is appended to <head> AFTER the entry
// stylesheet at runtime. `maplibre-gl.css` declares
// `.maplibregl-map { position: relative }` at (0,1,0) — the same specificity as
// the app's own `.comparison-map { position: relative }` on the very same
// element — so letting it land last inverts the cascade the container depends
// on. Keeping the import eager keeps every stylesheet in the entry bundle, in
// main.tsx import order. See the matching comments in main.tsx, vite.config.ts
// and the `#mapContainer` block in src/css/map.css.

// MapLibre viewer for similoo.
//
// Layer stack (bottom → top):
//   1. swisstopo SWISSIMAGE raster — the suite-standard satellite basemap.
//      Switzerland-only coverage, which is fine here: every input to this
//      viewer (EGRID parcels, GWR buildings, the geo.admin.ch geocoder) is
//      Swiss, so the map never travels outside the imagery footprint.
//   2. Parcel vector tiles painted by municipal zone type (`cz_local`, the key
//      the /score/similoo comparables cohort is defined on; read raw here as an
//      analytics key, while the sidebar's zone pill prints the same municipal
//      designation via @aireon/shared/parcel-zone):
//        - red    parcel matching the searched address
//        - green  every other parcel sharing the same `cz_local`
//        - white  everything else (low-opacity wash so the imagery still reads)
//   3. Building footprint vector tiles extruded as LOD 2.5 cubes — the target
//      building stays red, ranked comparables pink, hover blue.
//
// The previous revision deliberately dropped the basemap and the parcel layer
// for a "model space" look; the product direction is now to surface the zone
// context so users see *which* buildings counted as comparable and *why*
// (same zone), so the basemap + parcel zone painting are back.

// --- Source URLs / layer ids ------------------------------------------------

const BUILDING_TILES_URL = 'https://res-mbtiles-footprint-x.gisjoe.com/footprint_cityjson';
const PARCEL_TILES_URL = 'https://res-mbtiles-x.gisjoe.com/parcel_2025_07_z12_16';

// swisstopo SWISSIMAGE — the official Swiss orthophoto mosaic, served as
// WMTS/pseudo-Mercator (EPSG:3857) tiles, no API key required.
//
// NOTE the axis order: swisstopo's WMTS path is {z}/{x}/{y}, NOT the {z}/{y}/{x}
// used by the ArcGIS REST tile endpoint this replaced. Swapping the two
// transposes the map (and mostly 400s), so do not "fix" this to match other
// tile providers.
//
// Coverage is Switzerland only; requests outside the country 404. The `bg`
// background layer below is what shows through in that case.
const SWISSIMAGE_TILE =
    'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg';
const SWISSIMAGE_ATTRIBUTION =
    '&copy; <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener">swisstopo</a>';

// The ids themselves are declared in ./layerIds.js, a dependency-free module,
// and re-exported here so this file stays the single import site for everything
// map-related. The split exists so overlayOpacity.js can read three layer ids
// without importing maplibre-gl through this module — see layerIds.js.
// (Imported as well as re-exported: `export … from` alone would not put the
// names in this module's own scope, and the style builders below use them.)
import {
    BUILDING_SOURCE,
    BUILDING_SOURCE_LAYER,
    BUILDING_LAYER,
    PARCEL_SOURCE,
    PARCEL_SOURCE_LAYER,
    PARCEL_FILL_LAYER,
    PARCEL_OUTLINE_LAYER,
    CMP_HOVER_SOURCE,
    CMP_HOVER_FILL_LAYER,
    CMP_HOVER_GLOW_LAYER,
    CMP_HOVER_LINE_LAYER,
    CMP_HOVER_COLOR,
    CMP_HOVER_CORE_COLOR,
} from './layerIds.js';

export {
    BUILDING_SOURCE,
    BUILDING_SOURCE_LAYER,
    BUILDING_LAYER,
    PARCEL_SOURCE,
    PARCEL_SOURCE_LAYER,
    PARCEL_FILL_LAYER,
    PARCEL_OUTLINE_LAYER,
    CMP_HOVER_SOURCE,
    CMP_HOVER_FILL_LAYER,
    CMP_HOVER_GLOW_LAYER,
    CMP_HOVER_LINE_LAYER,
    CMP_HOVER_COLOR,
    CMP_HOVER_CORE_COLOR,
} from './layerIds.js';

// --- View defaults ----------------------------------------------------------

const DEFAULT_CENTER = [8.54, 47.37]; // Zurich
const DEFAULT_ZOOM = DEFAULT_MAP_ZOOM;
const DEFAULT_PITCH = 50;
const DEFAULT_BEARING = -25;

// Building opacity. The suite-wide default for 3D mode across the Aireon apps:
// solid enough that LOD 2.5 still reads as a solid-volume comparison, while the
// parcel colours underneath stay legible.
export const BUILDING_OPACITY_DEFAULT = 0.75;

// Zone palette. Mild opacity so the satellite imagery stays readable;
// the selected parcel is rendered first in the case-expression so it
// always wins, then same-zone, then everything else.
const PARCEL_SELECTED_COLOR = '#DC2626'; // red — the searched address
const PARCEL_SAME_ZONE_COLOR = '#16a34a'; // green — same `cz_local` (municipal zone type)
const PARCEL_OTHER_COLOR = '#ffffff';     // white wash — everything else

const PARCEL_SELECTED_OPACITY = 0.6;
const PARCEL_SAME_ZONE_OPACITY = 0.45;
const PARCEL_OTHER_OPACITY = 0.08;

// --- Public API -------------------------------------------------------------

export async function initializeViewer(containerId, initialCamera = {}) {
    const {
        center = DEFAULT_CENTER,
        zoom = DEFAULT_ZOOM,
        pitch = DEFAULT_PITCH,
        bearing = DEFAULT_BEARING,
    } = initialCamera;
    const map = new maplibregl.Map({
        container: containerId,
        style: buildStyle(),
        center,
        zoom,
        pitch,
        bearing,
        hash: false,
        // No on-map attribution control — suite policy keeps the map canvas
        // clean. The required basemap credit (swisstopo SWISSIMAGE) is surfaced
        // in the About panel instead (see App.tsx <AboutModal> credits).
        attributionControl: false,
    });

    // Zoom / bearing is the shared suite glass <ZoomControl> (React, mounted
    // bottom-right over the map in ComparisonView), so no maplibre
    // NavigationControl here. Keep the metric scale bar bottom-left.
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    await new Promise((resolve, reject) => {
        let settled = false;
        map.once('load', () => {
            if (!settled) {
                settled = true;
                resolve();
            }
        });
        map.once('error', (e) => {
            if (!settled) {
                settled = true;
                reject(e?.error || new Error('MapLibre failed to load'));
            }
        });
    });

    return map;
}

// Apply the zone-based parcel coloring once the searched parcel's
// `cz_local` is known (from the tile pick, else the /score/similoo response).
// Pass `null` to clear the highlight. `cz_local` is the municipal zone type
// the comparables cohort is keyed on — an analytics key, kept on purpose and
// read raw off the tile; the zone LABEL users read comes from the shared
// resolver (PARCEL_ZONE_STANDARD.md), which since v1.177.0 prints this same
// municipal designation.
//
// Implementation note: we use a paint expression that reads `cz_local`
// straight off each tile feature, rather than per-feature setFeatureState.
// MapLibre can only setFeatureState on features that live in a *loaded*
// tile — parcels in the same zone can sit far outside the viewport, so a
// paint expression is the only way to colour them consistently across the
// entire dataset.
export function applyZoneHighlight(map, { targetParcelId = null, czLocal = null } = {}) {
    if (!map || !map.getLayer(PARCEL_FILL_LAYER)) return;

    const hasTarget = targetParcelId != null;
    const hasZone = !!czLocal;

    // Nothing to show — reset to the invisible resting state.
    if (!hasTarget && !hasZone) {
        map.setPaintProperty(PARCEL_FILL_LAYER, 'fill-color', PARCEL_OTHER_COLOR);
        map.setPaintProperty(PARCEL_FILL_LAYER, 'fill-opacity', 0);
        return;
    }

    const selectedExpr = hasTarget ? ['==', ['id'], targetParcelId] : ['boolean', false];
    const sameZoneExpr = hasZone ? ['==', ['get', 'cz_local'], czLocal] : ['boolean', false];

    map.setPaintProperty(PARCEL_FILL_LAYER, 'fill-color', [
        'case',
        selectedExpr, PARCEL_SELECTED_COLOR,
        sameZoneExpr, PARCEL_SAME_ZONE_COLOR,
        PARCEL_OTHER_COLOR,
    ]);
    map.setPaintProperty(PARCEL_FILL_LAYER, 'fill-opacity', [
        'case',
        selectedExpr, PARCEL_SELECTED_OPACITY,
        sameZoneExpr, PARCEL_SAME_ZONE_OPACITY,
        // When the zone is known we wash everything else faintly so the
        // mosaic still reads; when only the target is known, hide the rest.
        hasZone ? PARCEL_OTHER_OPACITY : 0,
    ]);
}

// --- Style builder ----------------------------------------------------------

function buildStyle() {
    return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            basemap: {
                type: 'raster',
                tiles: [SWISSIMAGE_TILE],
                tileSize: 256,
                maxzoom: 19,
                attribution: SWISSIMAGE_ATTRIBUTION,
            },
            [PARCEL_SOURCE]: {
                type: 'vector',
                url: PARCEL_TILES_URL,
                promoteId: 'parcel_id',
            },
            [BUILDING_SOURCE]: {
                type: 'vector',
                url: BUILDING_TILES_URL,
                promoteId: 'res_building_id',
            },
            // Hovered-comparable parcel outline — driven imperatively by
            // main.js (setData + animated paint widths). Empty at rest.
            [CMP_HOVER_SOURCE]: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            },
        },
        layers: [
            // Deep-slate background shows through wherever the raster has no
            // coverage, i.e. anywhere outside Switzerland. Every code path that
            // moves this map is driven by Swiss parcel/building data, so in
            // practice this only paints the sliver beyond the border.
            { id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } },
            { id: 'basemap', type: 'raster', source: 'basemap', minzoom: 0, maxzoom: 22 },
            // Parcel zone fill — invisible until applyZoneHighlight() runs
            // with a target `cz_local`, then this layer paints red/green/white
            // according to the case expression.
            {
                id: PARCEL_FILL_LAYER,
                type: 'fill',
                source: PARCEL_SOURCE,
                'source-layer': PARCEL_SOURCE_LAYER,
                minzoom: 12,
                paint: {
                    'fill-color': PARCEL_OTHER_COLOR,
                    'fill-opacity': 0,
                },
            },
            // Suite-standard parcel outline so the parcel mosaic is legible
            // before any zone is selected. Subtle white-ish line that reads
            // against satellite imagery.
            {
                id: PARCEL_OUTLINE_LAYER,
                type: 'line',
                source: PARCEL_SOURCE,
                'source-layer': PARCEL_SOURCE_LAYER,
                minzoom: 13,
                paint: {
                    'line-color': 'rgba(255,255,255,0.55)',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 17, 1.2],
                },
            },
            // Hovered-comparable parcel spotlight (below the buildings so the
            // outline reads as a ground border, not a line over rooftops).
            // All three start invisible; main.js animates the widths/opacity
            // for the grow-in + breathing pulse when a comparable is hovered.
            {
                id: CMP_HOVER_FILL_LAYER,
                type: 'fill',
                source: CMP_HOVER_SOURCE,
                paint: {
                    'fill-color': CMP_HOVER_COLOR,
                    'fill-opacity': 0,
                },
            },
            {
                id: CMP_HOVER_GLOW_LAYER,
                type: 'line',
                source: CMP_HOVER_SOURCE,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': CMP_HOVER_COLOR,
                    'line-width': 0,
                    'line-blur': 6,
                    'line-opacity': 0,
                },
            },
            {
                id: CMP_HOVER_LINE_LAYER,
                type: 'line',
                source: CMP_HOVER_SOURCE,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': CMP_HOVER_CORE_COLOR,
                    'line-width': 0,
                    'line-opacity': 0.95,
                },
            },
            {
                id: BUILDING_LAYER,
                type: 'fill-extrusion',
                source: BUILDING_SOURCE,
                'source-layer': BUILDING_SOURCE_LAYER,
                minzoom: 12,
                paint: {
                    // target wins over comparable wins over hover; the
                    // resting cube colour is a flat slate so the
                    // highlights pop.
                    'fill-extrusion-color': [
                        'case',
                        ['boolean', ['feature-state', 'target'], false], '#DC2626',
                        ['boolean', ['feature-state', 'comparable'], false], '#F472B6',
                        ['boolean', ['feature-state', 'hover'], false], '#60A5FA',
                        '#c8cdd4',
                    ],
                    'fill-extrusion-height': [
                        'max',
                        ['-',
                            ['coalesce', ['get', 'rf_h_roof_70p'], 0],
                            ['coalesce', ['get', 'rf_h_ground'], 0],
                        ],
                        0,
                    ],
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': BUILDING_OPACITY_DEFAULT,
                },
            },
        ],
    };
}
