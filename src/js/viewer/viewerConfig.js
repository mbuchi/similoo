import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre viewer for similoo. Replaces the Cesium foundation inherited
// from hood with a much lighter 2D-with-3D-extrusions setup:
//
//   * Parcel polygons come from the suite's shared Martin tileset hosted at
//     res-mbtiles-x.gisjoe.com (same source room uses). Click → feature has
//     bldg_constr_year / cz_local / parcel_area / ratio_v / bldg_id etc.
//     EGRID isn't in the tile so we resolve it server-side via /api/parcel.
//   * Building footprints come from res-mbtiles-footprint-x.gisjoe.com and
//     are extruded with `fill-extrusion-height = rf_h_roof_70p - rf_h_ground`
//     (same expression room uses; 70th-percentile roof reads more honestly
//     than rf_h_roof_max which spikes on chimneys).
//   * A Carto Positron raster underlay provides geographic context without
//     pulling in Cesium-grade terrain/imagery.
//
// initializeViewer resolves to the MapLibre Map once `load` has fired so
// caller code can synchronously add feature-state to layers.

const PARCEL_TILES_URL = 'https://res-mbtiles-x.gisjoe.com/parcel_2025_07_z12_16';
const BUILDING_TILES_URL = 'https://res-mbtiles-footprint-x.gisjoe.com/footprint_cityjson';

const DEFAULT_CENTER = [8.54, 47.37]; // Zurich
const DEFAULT_ZOOM = 14;
const DEFAULT_PITCH = 45;
const DEFAULT_BEARING = -20;

export async function initializeViewer(containerId) {
    const map = new maplibregl.Map({
        container: containerId,
        style: buildStyle(),
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: DEFAULT_PITCH,
        bearing: DEFAULT_BEARING,
        hash: true,
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
            // Map can emit error before load on transient network blips;
            // only reject if load hasn't fired yet.
            if (!settled) {
                settled = true;
                reject(e?.error || new Error('MapLibre failed to load'));
            }
        });
    });

    return map;
}

function buildStyle() {
    return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            positron: {
                type: 'raster',
                tiles: [
                    'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                    'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                ],
                tileSize: 256,
                maxzoom: 19,
                attribution: '© OpenStreetMap, © CARTO',
            },
            parcels: {
                type: 'vector',
                url: PARCEL_TILES_URL,
                // bldg_id is the only identifier present in the tile schema
                // that is stable per feature; the EGRID we surface in the
                // sidebar is resolved server-side from lat/lng.
                promoteId: 'bldg_id',
            },
            buildings: {
                type: 'vector',
                url: BUILDING_TILES_URL,
                promoteId: 'res_building_id',
            },
        },
        layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#f3f4f6' } },
            {
                id: 'positron',
                type: 'raster',
                source: 'positron',
                paint: { 'raster-opacity': 0.85 },
            },
            {
                id: 'parcels-outline',
                type: 'line',
                source: 'parcels',
                'source-layer': 'parcel_2025_07',
                minzoom: 13,
                paint: {
                    'line-color': '#9ca3af',
                    'line-width': 0.6,
                    'line-opacity': 0.5,
                },
            },
            {
                id: 'parcels-fill',
                type: 'fill',
                source: 'parcels',
                'source-layer': 'parcel_2025_07',
                paint: {
                    // Transparent default so positron shows through; the click
                    // handler swaps a parcel into `target` / `comparable`
                    // feature-state to paint it red / pink. Hover gets a
                    // soft amber overlay so users feel the click target.
                    'fill-color': [
                        'case',
                        ['boolean', ['feature-state', 'target'], false], '#DC2626',
                        ['boolean', ['feature-state', 'comparable'], false], '#F87171',
                        ['boolean', ['feature-state', 'hover'], false], '#fbbf24',
                        'rgba(0,0,0,0)',
                    ],
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'target'], false], 0.45,
                        ['boolean', ['feature-state', 'comparable'], false], 0.35,
                        ['boolean', ['feature-state', 'hover'], false], 0.25,
                        0,
                    ],
                },
            },
            {
                id: 'buildings-extrusion',
                type: 'fill-extrusion',
                source: 'buildings',
                'source-layer': 'footprint_cityjson',
                minzoom: 14,
                paint: {
                    'fill-extrusion-color': [
                        'case',
                        ['boolean', ['feature-state', 'target'], false], '#DC2626',
                        ['boolean', ['feature-state', 'comparable'], false], '#F87171',
                        '#cbd5e1',
                    ],
                    // 70p reads more honestly than rf_h_roof_max which
                    // includes chimney peaks; identical to the room app's
                    // expression so the suite has one canonical answer.
                    'fill-extrusion-height': [
                        'max',
                        ['-',
                            ['coalesce', ['get', 'rf_h_roof_70p'], 0],
                            ['coalesce', ['get', 'rf_h_ground'], 0],
                        ],
                        0,
                    ],
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 0.85,
                },
            },
        ],
    };
}

// Helpers exposed so main.js can apply / clear feature-state without
// reaching into MapLibre layer names from outside.
export const PARCEL_SOURCE = 'parcels';
export const PARCEL_SOURCE_LAYER = 'parcel_2025_07';
export const BUILDING_SOURCE = 'buildings';
export const BUILDING_SOURCE_LAYER = 'footprint_cityjson';
