import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre viewer for similoo — LOD 2.5 mode.
//
// similoo's left-hand pane is intentionally minimal: a sea of light grey
// "cubes" (flat-roof extruded building footprints) with the searched
// building painted red and the comparable buildings painted pink. We
// deliberately drop the basemap raster, the parcel polygons, and the
// terrain/vegetation — none are useful for the comparison task and they
// crowd the visual. Detailed 3D inspection lives in the building-detail
// popup (LAS point cloud / solid mesh), not on the overview map.
//
// initializeViewer resolves to the MapLibre Map once `load` has fired so
// caller code can synchronously add feature-state to layers.

const BUILDING_TILES_URL = 'https://res-mbtiles-footprint-x.gisjoe.com/footprint_cityjson';

const DEFAULT_CENTER = [8.54, 47.37]; // Zurich
const DEFAULT_ZOOM = 14;
const DEFAULT_PITCH = 50;
const DEFAULT_BEARING = -25;

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

function buildStyle() {
    return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            buildings: {
                type: 'vector',
                url: BUILDING_TILES_URL,
                promoteId: 'res_building_id',
            },
        },
        layers: [
            // A clean off-white background reads as "model space" rather
            // than a real map. Theme-flips to slate when the app's dark
            // mode is on, via the data-theme rules in map.css that swap
            // the canvas's CSS background — the background layer itself
            // is the resting state.
            { id: 'bg', type: 'background', paint: { 'background-color': '#f5f6f8' } },
            {
                id: 'buildings-extrusion',
                type: 'fill-extrusion',
                source: 'buildings',
                'source-layer': 'footprint_cityjson',
                minzoom: 12,
                paint: {
                    // target wins over comparable wins over hover; the
                    // resting cube colour is a flat slate so the
                    // highlights pop. No textures or roof detail —
                    // the LOD 2.5 look comes from the uniform fill.
                    'fill-extrusion-color': [
                        'case',
                        ['boolean', ['feature-state', 'target'], false], '#DC2626',
                        ['boolean', ['feature-state', 'comparable'], false], '#F472B6',
                        ['boolean', ['feature-state', 'hover'], false], '#60A5FA',
                        '#c8cdd4',
                    ],
                    // 70p roof reads more honestly than rf_h_roof_max
                    // which spikes on chimneys. Same expression room
                    // and the previous similoo viewer used.
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

// Helpers exposed so main.js can apply / clear feature-state without
// reaching into MapLibre layer names from outside.
export const BUILDING_SOURCE = 'buildings';
export const BUILDING_SOURCE_LAYER = 'footprint_cityjson';
export const BUILDING_LAYER = 'buildings-extrusion';

// Building opacity. LOD 2.5 is purely about the cube shapes — keep them
// near-opaque so the comparison reads as a solid-volume comparison.
export const BUILDING_OPACITY_DEFAULT = 0.92;
