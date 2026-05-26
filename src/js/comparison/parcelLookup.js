// Resolve a parcel EGRID from a MapLibre click.
//
// The Swiss vector tiles in `res-mbtiles-x.gisjoe.com` don't carry EGRID
// per parcel (the tile schema has bldg_id / parcel_id but not egrid).
// The canonical resolver lives on the shared RES API at
// POST /res_api/parcel_data — given lat/lng it returns the GeoJSON parcel
// feature whose `properties.egrid` we extract. We hit it through the
// same-origin /api/parcel Vercel proxy so the client doesn't carry the
// RES API token.
//
// Falls back to a deterministic synthetic EGRID built from the click
// coordinates (or the feature properties, if available) when the network
// is down or the lat/lng falls outside the Swiss parcel layer. The
// synthetic EGRID still drives a real-shape mock response from
// fetchSimilooComparables so the demo flow keeps working before the
// backend goes live.

const PARCEL_ENDPOINT = '/api/parcel';

export async function resolveEgridFromLngLat(lngLat, fallbackFeature) {
    const ll = normaliseLngLat(lngLat);
    if (!ll) return synthesisedEgrid(fallbackFeature);

    try {
        const res = await fetch(PARCEL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

function normaliseLngLat(input) {
    if (!input) return null;
    // MapLibre's LngLat instance, or a plain {lng,lat} object.
    const lng = Number(input.lng ?? input.longitude ?? input[0]);
    const lat = Number(input.lat ?? input.latitude ?? input[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
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
    // Deterministic fake EGRID — stable per building/parcel so the mock
    // backend returns the same comparables every time the same one is
    // picked. Real EGRIDs look like "CH123456789012"; the synthetic ones
    // share that 14-char shape so card rendering doesn't blow up on layout.
    let seedSource = '';
    if (feature?.properties) {
        const fid = feature.properties.bldg_id
            ?? feature.properties.parcel_id
            ?? feature.id
            ?? null;
        if (fid !== null && fid !== undefined) seedSource = `f-${fid}`;
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
