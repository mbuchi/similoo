// Client for the Contoor 3D API, fronted by /api/three3d (Vercel proxy).
//
// Three operations the scene viewer needs:
//
//   * fetchTerrainGLB({ lat, lng, radius_m }) — sync GLB of the local
//     terrain mesh, vertices in local meters with origin at the request
//     center. See project_res_3D_api/app/services/pointcloud.py — the
//     export uses (X=east, Y=up, -Z=north) order so Three.js can render
//     it directly.
//
//   * fetchBuildingGLB({ lat, lng }) — sync GLB of the building whose
//     footprint contains the point. Vertices are absolute LV95
//     (X=easting, Y=northing, Z=elevation); the scene viewer applies
//     a single LV95→Three.js transform to place it on the terrain.
//
//   * fetchFootprintsBBox({ lat, lng, radius_m }) — list every
//     building footprint inside the BBOX, with its WGS84 centroid and
//     LV95 reference point. Used to drive multi-building rendering.
//
// All endpoints are proxied to keep the optional X-API-Key server-side.

import { getCached, setCached, TTL } from '../cache.js';

const TERRAIN_ENDPOINT = '/api/three3d/terrain';
const BUILDING_ENDPOINT = '/api/three3d/building';
const FOOTPRINTS_ENDPOINT = '/api/three3d/footprints';
const HEIGHT_VOLUME_ENDPOINT = '/api/three3d/height-volume';

async function fetchGLBWithMeta(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`three3d ${res.status}: ${text.slice(0, 200)}`);
    }
    const ct = res.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
        // Upstream answered with the link JSON rather than the binary —
        // can happen if return_data is silently dropped. Surface it as
        // an explicit error rather than handing the loader a JSON blob.
        const text = await res.text().catch(() => '');
        throw new Error(`three3d expected GLB binary, got JSON: ${text.slice(0, 200)}`);
    }
    const blob = await res.blob();
    const metaHeader = res.headers.get('X-GLB-Metadata');
    let metadata = null;
    if (metaHeader) {
        try { metadata = JSON.parse(metaHeader); }
        catch (e) { console.warn('three3d: malformed X-GLB-Metadata header', e); }
    }
    return { blob, metadata };
}

export function fetchTerrainGLB({ lat, lng, radius_m = 100, classes = null }) {
    const body = {
        lat,
        lng,
        bbox_radius_m: radius_m,
        return_data: true,
    };
    // Filter the LAS point cloud by classification before generating
    // the GLB. Supported classes (per Contoor docs): 'ground',
    // 'vegetation', 'tree', 'trees', 'buildings'. Pass null/[] to get
    // the full unfiltered cloud (the default).
    if (Array.isArray(classes) && classes.length) {
        body.selected_pointcloud_class = classes;
    }
    return fetchGLBWithMeta(TERRAIN_ENDPOINT, body);
}

export function fetchBuildingGLB({ lat, lng }) {
    // return_data=true + a single format makes the upstream stream the
    // GLB binary back; without it the upstream returns a JSON link
    // response and our loader fails.
    return fetchGLBWithMeta(BUILDING_ENDPOINT, {
        lat,
        lng,
        formats: ['glb'],
        package: false,
        return_data: true,
    });
}

export async function fetchFootprintsBBox({ lat, lng, radius_m = 100 }) {
    const res = await fetch(FOOTPRINTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, radius_m }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`footprints ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}

// Combined height + volume metrics for the building footprint at
// (lat, lng). Returns the Contoor BuildingHeightVolumeResponse shape:
//   { input, coordinate2056, status:{height,volume}, height:{...}, volume:{...}, errors, meta }
// Either or both of `height` / `volume` may be null if upstream failed
// to compute one component; the `status` flags indicate which worked.
export async function fetchBuildingHeightVolume({ lat, lng, radiusMeters = null }) {
    const body = { lat, lng };
    if (radiusMeters != null) body.radiusMeters = radiusMeters;
    // ~1 m precision is overkill for caching: two clicks near the same
    // footprint should hit the same cache entry. Rounding to 5 decimals
    // is fine because Contoor matches building footprints by spatial
    // intersection upstream.
    const cacheKey = `hv:${lat.toFixed(5)},${lng.toFixed(5)}${radiusMeters != null ? `:r${radiusMeters}` : ''}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const res = await fetch(HEIGHT_VOLUME_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`height-volume ${res.status}: ${text.slice(0, 200)}`);
    }
    const payload = await res.json();
    // Cache only when at least one component succeeded — partial
    // failures might be transient (e.g. tile not yet downloaded).
    if (payload?.status?.height || payload?.status?.volume) {
        setCached(cacheKey, payload, TTL.heightVolume);
    }
    return payload;
}
