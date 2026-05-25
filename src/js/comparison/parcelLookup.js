import { getAccessToken } from '../auth/index.js';

// Resolve a parcel EGRID from a Cesium click world-position.
//
// The Swiss TLM3D and OSM Building tilesets don't expose EGRID on the
// picked feature. The canonical resolver lives on the shared RES API at
// POST /res_api/parcel_data — given lat/lng it returns the GeoJSON parcel
// feature whose `properties.egrid` we extract.
//
// Falls back to a deterministic synthetic EGRID built from the click
// coordinates (or the feature ID, if available) when the network is down
// or the lat/lng falls outside the Swiss parcel layer. The synthetic
// EGRID still drives a real-shape mock response from fetchSimilooComparables
// so the demo flow keeps working before the backend goes live.

const RES_BASE = (import.meta.env.VITE_RES_API_BASE_URL || 'https://res.zeroo.ch').replace(/\/$/, '');
const PARCEL_ENDPOINT = `${RES_BASE}/res_api/parcel_data`;

export async function resolveEgridFromWorldPos(clickWorldPosition, fallbackFeature) {
    const ll = worldPositionToLatLng(clickWorldPosition);
    if (!ll) return synthesisedEgrid(fallbackFeature);

    try {
        const headers = { 'Content-Type': 'application/json' };
        const token = await safeGetToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(PARCEL_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({ lat: ll.lat, lng: ll.lng }),
        });
        if (!res.ok) {
            return synthesisedEgrid(fallbackFeature, ll);
        }
        const data = await res.json();
        const egrid = extractEgrid(data);
        if (egrid) return { egrid, lat: ll.lat, lng: ll.lng, synthetic: false };
        return synthesisedEgrid(fallbackFeature, ll);
    } catch (err) {
        console.warn('parcel_data lookup failed; using synthetic EGRID:', err?.message);
        return synthesisedEgrid(fallbackFeature, ll);
    }
}

async function safeGetToken() {
    try {
        return await getAccessToken();
    } catch {
        return null;
    }
}

function worldPositionToLatLng(worldPos) {
    if (!worldPos) return null;
    try {
        const carto = Cesium.Cartographic.fromCartesian(worldPos);
        if (!carto) return null;
        return {
            lat: Cesium.Math.toDegrees(carto.latitude),
            lng: Cesium.Math.toDegrees(carto.longitude),
        };
    } catch {
        return null;
    }
}

function extractEgrid(payload) {
    if (!payload) return null;
    const features = payload?.features || payload?.data?.features;
    if (Array.isArray(features) && features.length) {
        const props = features[0]?.properties || {};
        return props.egrid || props.EGRID || null;
    }
    if (typeof payload === 'object' && payload.egrid) return payload.egrid;
    return null;
}

function synthesisedEgrid(feature, ll) {
    // Deterministic fake EGRID — stable per building so the mock backend
    // returns the same comparables every time the same building is picked.
    // Real EGRIDs look like "CH123456789012"; the synthetic ones share that
    // 14-char shape so card rendering doesn't blow up on layout.
    let seedSource = '';
    if (feature) {
        const fid = feature.featureId ?? feature._batchId ?? null;
        if (fid !== null) seedSource = `f-${fid}`;
    }
    if (!seedSource && ll) {
        seedSource = `ll-${ll.lat.toFixed(5)},${ll.lng.toFixed(5)}`;
    }
    if (!seedSource) seedSource = `r-${Math.random().toString(36).slice(2, 10)}`;

    let h = 0x811c9dc5;
    for (let i = 0; i < seedSource.length; i++) {
        h ^= seedSource.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    const digits = (h >>> 0).toString().padStart(12, '0').slice(0, 12);
    return {
        egrid: `CH${digits}`,
        lat: ll?.lat ?? null,
        lng: ll?.lng ?? null,
        synthetic: true,
    };
}
