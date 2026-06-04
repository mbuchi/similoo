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
import { cachedArrayBuffer } from './blobCache.js';

const TERRAIN_ENDPOINT = '/api/three3d/terrain';
const BUILDING_ENDPOINT = '/api/three3d/building';
const FOOTPRINTS_ENDPOINT = '/api/three3d/footprints';
const HEIGHT_VOLUME_ENDPOINT = '/api/three3d/height-volume';

const META_HEADER = 'X-GLB-Metadata';

// The terrain/building GLBs are the heaviest, most deterministic payloads the
// app fetches (static per coordinate, already coordinate-keyed upstream), so
// we front them with a dedicated IndexedDB blob cache. On a fresh hit this is
// zero-network and re-opening a parcel is instant; on a miss it fetches, caches
// the bytes, and returns them. The cache degrades silently to a plain fetch on
// any IDB error (incognito/quota), so behaviour is identical when it's
// unavailable. We keep the original { blob, metadata } return shape so the
// GLTFLoader call-sites in buildingScene.js are unchanged.
async function fetchGLBWithMeta(url, body) {
    const init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };

    const result = await cachedArrayBuffer(url, init, {
        extraHeaders: [META_HEADER],
        // Only persist genuine GLB binaries. The upstream occasionally returns
        // a small JSON "link" response instead of the mesh; caching that would
        // poison the coordinate for the full TTL and replay the error on every
        // future open. Such responses are returned but never stored.
        shouldCache: (buffer) => hasGLBMagic(buffer),
    });

    // Non-2xx from the network leg — surface the same error as before.
    if (result.ok === false) {
        const res = result.res;
        const text = await res.text().catch(() => '');
        throw new Error(`three3d ${res.status}: ${text.slice(0, 200)}`);
    }

    // Upstream answered with the link JSON rather than the binary — can happen
    // if return_data is silently dropped. The metadata sidecar header is GLB-
    // only, and a JSON link response is small, so detect it by sniffing the GLB
    // magic ('glTF') at the start of the buffer rather than relying on a
    // Content-Type we no longer hold on a cache hit.
    const { buffer, headers } = result;
    if (!hasGLBMagic(buffer)) {
        const text = decodeUtf8(buffer).slice(0, 200);
        throw new Error(`three3d expected GLB binary, got non-GLB: ${text}`);
    }

    let metadata = null;
    const metaHeader = headers?.[META_HEADER];
    if (metaHeader) {
        try { metadata = JSON.parse(metaHeader); }
        catch (e) { console.warn('three3d: malformed X-GLB-Metadata header', e); }
    }
    return { blob: new Blob([buffer]), metadata };
}

// Binary glTF (.glb) files start with the 4-byte magic 'glTF' (0x46546C67 LE).
function hasGLBMagic(buffer) {
    if (!buffer || buffer.byteLength < 4) return false;
    const b = new Uint8Array(buffer, 0, 4);
    return b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46;
}

function decodeUtf8(buffer) {
    try { return new TextDecoder().decode(buffer); }
    catch { return ''; }
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
