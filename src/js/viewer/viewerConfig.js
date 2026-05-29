import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre viewer for similoo.
//
// Layer stack (bottom → top):
//   1. ArcGIS World Imagery raster — the suite-standard satellite basemap
//      (same source the Cesium-based apps + project_RES legacy frontend
//      default to via "Basemap Satellite").
//   2. Parcel vector tiles painted by zoning (`cz_local`):
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

// ArcGIS World Imagery — global satellite mosaic, no API key required.
const ARCGIS_IMAGERY_TILE =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ARCGIS_ATTRIBUTION =
    'Imagery &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, ' +
    'Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, GIS User Community';

export const BUILDING_SOURCE = 'buildings';
export const BUILDING_SOURCE_LAYER = 'footprint_cityjson';
export const BUILDING_LAYER = 'buildings-extrusion';

export const PARCEL_SOURCE = 'parcels';
export const PARCEL_SOURCE_LAYER = 'parcel_2025_07';
export const PARCEL_FILL_LAYER = 'parcels-zone-fill';
export const PARCEL_OUTLINE_LAYER = 'parcels-outline';

// --- View defaults ----------------------------------------------------------

const DEFAULT_CENTER = [8.54, 47.37]; // Zurich
const DEFAULT_ZOOM = 14;
const DEFAULT_PITCH = 50;
const DEFAULT_BEARING = -25;

// Building opacity. LOD 2.5 is purely about the cube shapes — keep them
// near-opaque so the comparison reads as a solid-volume comparison.
export const BUILDING_OPACITY_DEFAULT = 0.92;

// Zone palette. Mild opacity so the satellite imagery stays readable;
// the selected parcel is rendered first in the case-expression so it
// always wins, then same-zone, then everything else.
const PARCEL_SELECTED_COLOR = '#DC2626'; // red — the searched address
const PARCEL_SAME_ZONE_COLOR = '#16a34a'; // green — same `cz_local`
const PARCEL_OTHER_COLOR = '#ffffff';     // white wash — everything else

const PARCEL_SELECTED_OPACITY = 0.6;
const PARCEL_SAME_ZONE_OPACITY = 0.45;
const PARCEL_OTHER_OPACITY = 0.08;

// --- Public API -------------------------------------------------------------

export async function initializeViewer(containerId) {
    const map = new maplibregl.Map({
        container: containerId,
        style: buildStyle(),
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: DEFAULT_PITCH,
        bearing: DEFAULT_BEARING,
        hash: false,
        attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
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
// `cz_local` is known (from the /score/similoo response). Pass `null` to
// clear the highlight.
//
// Implementation note: we use a paint expression that reads `cz_local`
// straight off each tile feature, rather than per-feature setFeatureState.
// MapLibre can only setFeatureState on features that live in a *loaded*
// tile — parcels in the same zone can sit far outside the viewport, so a
// paint expression is the only way to colour them consistently across the
// entire dataset.
export function applyZoneHighlight(map, { targetParcelId = null, czLocal = null } = {}) {
    if (!map || !map.getLayer(PARCEL_FILL_LAYER)) return;

    if (!czLocal) {
        map.setPaintProperty(PARCEL_FILL_LAYER, 'fill-color', PARCEL_OTHER_COLOR);
        map.setPaintProperty(PARCEL_FILL_LAYER, 'fill-opacity', 0);
        return;
    }

    const selectedExpr = targetParcelId != null
        ? ['==', ['id'], targetParcelId]
        : ['boolean', false];

    map.setPaintProperty(PARCEL_FILL_LAYER, 'fill-color', [
        'case',
        selectedExpr, PARCEL_SELECTED_COLOR,
        ['==', ['get', 'cz_local'], czLocal], PARCEL_SAME_ZONE_COLOR,
        PARCEL_OTHER_COLOR,
    ]);
    map.setPaintProperty(PARCEL_FILL_LAYER, 'fill-opacity', [
        'case',
        selectedExpr, PARCEL_SELECTED_OPACITY,
        ['==', ['get', 'cz_local'], czLocal], PARCEL_SAME_ZONE_OPACITY,
        PARCEL_OTHER_OPACITY,
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
                tiles: [ARCGIS_IMAGERY_TILE],
                tileSize: 256,
                maxzoom: 19,
                attribution: ARCGIS_ATTRIBUTION,
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
        },
        layers: [
            // Deep-slate background only shows through where the raster
            // has no coverage (very rare globally; effectively a fallback).
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
