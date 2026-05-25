// URL <-> map-state sync.
// `zoom` here is the camera altitude in meters (Cesium has no native zoom level).
export const DEFAULT_LNG = 8.67;
export const DEFAULT_LAT = 46.72;
export const DEFAULT_ZOOM = 4500;

function parseNumber(value) {
    if (value == null || value === '') return NaN;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

export function getInitialMapState() {
    let params;
    try {
        params = new URLSearchParams(window.location.search);
    } catch (_) {
        return {
            center: [DEFAULT_LNG, DEFAULT_LAT],
            zoom: DEFAULT_ZOOM,
            hasUrlCoords: false
        };
    }

    const lat = parseNumber(params.get('lat'));
    const lng = parseNumber(params.get('lng'));
    const zoom = parseNumber(params.get('zoom'));

    const hasUrlCoords = Number.isFinite(lat) && Number.isFinite(lng);

    return {
        center: hasUrlCoords ? [lng, lat] : [DEFAULT_LNG, DEFAULT_LAT],
        zoom: Number.isFinite(zoom) ? zoom : DEFAULT_ZOOM,
        hasUrlCoords
    };
}

export function updateUrlParams(lat, lng, zoom) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return;

    const url = new URL(window.location.href);
    url.searchParams.set('lat', lat.toFixed(6));
    url.searchParams.set('lng', lng.toFixed(6));
    url.searchParams.set('zoom', zoom.toFixed(2));

    window.history.replaceState(null, '', url.toString());
}
