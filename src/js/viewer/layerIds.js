// Source / layer ids for similoo's MapLibre style — plain strings, nothing else.
//
// WHY THIS FILE IS SEPARATE FROM viewerConfig.js:
// viewerConfig.js imports `maplibre-gl` at module scope, so anything that
// imports it drags the whole ~220 KB (brotli) library along. overlayOpacity.js
// only needs three layer-id STRINGS, and it is imported by the React shell
// (App.tsx reads overlayOpacityUrlValue() for its `?opacity=` URL sync
// provider) — which is on the eager first-load path. That single string import
// was enough to pin MapLibre to the critical path even after the engine itself
// moved behind a dynamic import.
//
// So the ids live here, with no dependencies at all. viewerConfig.js re-exports
// every one of them, so its public API is unchanged and existing importers do
// not care where the values are declared.
//
// Adding a new layer? Put the id here and re-export it from viewerConfig.js.

export const BUILDING_SOURCE = 'buildings';
export const BUILDING_SOURCE_LAYER = 'footprint_cityjson';
export const BUILDING_LAYER = 'buildings-extrusion';

export const PARCEL_SOURCE = 'parcels';
export const PARCEL_SOURCE_LAYER = 'parcel_2025_07';
export const PARCEL_FILL_LAYER = 'parcels-zone-fill';
export const PARCEL_OUTLINE_LAYER = 'parcels-outline';

// Hovered-comparable parcel spotlight. A dedicated GeoJSON source fed by
// main.js when a comparable card is hovered: the match's parcel polygon is
// traced with an animated amber glow (a soft fill wash + a blurred glow line
// under a crisp core line) that "grows in" and gently pulses. Amber is the
// suite's hover accent. Empty at rest.
export const CMP_HOVER_SOURCE = 'cmp-hover';
export const CMP_HOVER_FILL_LAYER = 'cmp-hover-fill';
export const CMP_HOVER_GLOW_LAYER = 'cmp-hover-glow';
export const CMP_HOVER_LINE_LAYER = 'cmp-hover-line';
export const CMP_HOVER_COLOR = '#F59E0B';      // amber — glow + fill
export const CMP_HOVER_CORE_COLOR = '#FDE68A'; // bright amber-white — core line
