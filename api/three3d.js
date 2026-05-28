// Vercel Node serverless function.
//
// Proxies POST /api/three3d/terrain    → CONTOOR /api/v1/pointcloud/glb
//         POST /api/three3d/building   → CONTOOR /api/v1/building-model
//         POST /api/three3d/footprints → Swiss WFS BBOX feature list
//
// We forward the request body, set the optional X-API-Key server-side
// (CONTOOR_3D_API_KEY env var), and stream the GLB binary back to the
// client. The metadata header (X-GLB-Metadata) is mirrored verbatim
// so the Three.js client can recover the request origin.
//
// One single handler routes all endpoints via the trailing path; this
// keeps Vercel function count low (only one function file).

export const config = { maxDuration: 60 };

const CONTOOR_BASE =
    process.env.CONTOOR_3D_API_BASE ||
    'https://contoor-api-contabo.gisjoe.com';

// Server-side default API key for the Contoor 3D upstream, matching the
// contoor sibling app (see contoor/api/glb.ts:12). This constant is only
// ever read inside a Vercel Node serverless function — it never reaches
// the browser. CONTOOR_3D_API_KEY (or the contoor-compatible aliases
// CONTOUR_API_KEY / GLB_API_KEY) override it when set in Vercel env vars.
const DEFAULT_CONTOOR_3D_API_KEY = '@d3YJbayNg@RxyanD!N.rXcLcq.Qrv_gR_FFw9z2';

const CONTOOR_API_KEY =
    process.env.CONTOOR_3D_API_KEY ||
    process.env.GLB_API_KEY ||
    process.env.CONTOUR_API_KEY ||
    DEFAULT_CONTOOR_3D_API_KEY;

// One-shot warning so Vercel logs flag missing env vars without spamming
// per-request output. The deploy still works (the hardcoded fallback
// matches the contoor sibling app's key), but the key should be rotated
// to an env-var-only value.
if (
    !process.env.CONTOOR_3D_API_KEY &&
    !process.env.GLB_API_KEY &&
    !process.env.CONTOUR_API_KEY
) {
    console.warn('[three3d] CONTOOR_3D_API_KEY env var is not set — using hardcoded default. Set it in Vercel for the production deploy.');
}

const UPSTREAM_TIMEOUT_MS = 45_000;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function setCors(res) {
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

function sendJson(res, status, body) {
    setCors(res);
    res.setHeader('Content-Type', 'application/json');
    res.status(status).end(JSON.stringify(body));
}

// Vercel passes the rest of the path under `req.query.path` (a string[]
// from the rewrite, or a "/"-joined string when called as
// /api/three3d?path=terrain). We normalise both shapes.
function readPath(req) {
    const raw = req.query?.path;
    if (Array.isArray(raw)) return raw.join('/');
    if (typeof raw === 'string') return raw;
    const u = req.url || '';
    const after = u.split('/api/three3d/')[1] || '';
    return after.split('?')[0];
}

const ROUTES = {
    terrain: '/api/v1/pointcloud/glb',
    building: '/api/v1/building-model',
    'height-volume': '/api/v1/building-height-volume',
};

// Routes whose response is JSON (not a GLB binary) so we forward the
// raw text instead of arrayBuffer()-ing it.
const JSON_ROUTES = new Set(['height-volume']);

// Swiss WFS used to enumerate building footprints inside a BBOX.
// This service is reachable from the Vercel function but not the
// browser (plain HTTP, no CORS), so the proxy fronts it for us.
const WFS_BASE_URL =
    process.env.SWISS_WFS_BASE_URL ||
    'http://109.205.181.241:8080/geoserver/project_res/ows';
const WFS_BUILDING_LAYER =
    process.env.SWISS_WFS_BUILDING_LAYER ||
    'project_res:bo_buildings_all_2025';
const WFS_BBOX_PAGE_SIZE = Number(process.env.SWISS_WFS_PAGE_SIZE || 200);

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        setCors(res);
        res.status(204).end();
        return;
    }
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    const op = readPath(req);

    let body;
    if (typeof req.body === 'string') {
        try { body = JSON.parse(req.body); } catch {
            sendJson(res, 400, { error: 'Invalid JSON body' });
            return;
        }
    } else {
        body = req.body || {};
    }

    if (op === 'footprints') {
        return await handleFootprints(body, res);
    }

    const upstreamPath = ROUTES[op];
    if (!upstreamPath) {
        sendJson(res, 404, { error: `Unknown 3D op '${op}'`, allowed: [...Object.keys(ROUTES), 'footprints'] });
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': CONTOOR_API_KEY,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
        let upstream = await fetchUpstreamWithBusyRetry(
            `${CONTOOR_BASE}${upstreamPath}`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            },
        );

        // The pointcloud/glb and building-model endpoints share the same
        // cache-read codepath upstream, which has a known bug: it raises
        // 500 "cannot access local variable 'glb_bytes'" / "'metadata'"
        // on cache hits because the cache-read branch is dead code. We
        // can't restart the upstream, but we can perturb lat/lng so the
        // cache key changes and the upstream falls back to fresh
        // generation. Each retry uses a different perturbation in case
        // the previous one is now also cached.
        if ((op === 'terrain' || op === 'building') && upstream && upstream.status >= 500) {
            const text = await upstream.text().catch(() => '');
            const isCacheBug =
                /cannot access local variable/i.test(text) ||
                /'glb_bytes'|'metadata'/i.test(text);

            if (isCacheBug) {
                const perturbations = [
                    [0.000001, 0.000001],
                    [-0.000001, 0.000001],
                    [0.000002, -0.000002],
                    // Last-resort jitter, near-guaranteed fresh key.
                    [Math.random() * 0.000005, Math.random() * 0.000005],
                ];
                for (const [dLat, dLng] of perturbations) {
                    const perturbed = {
                        ...body,
                        lat: Number(body.lat) + dLat,
                        lng: Number(body.lng) + dLng,
                    };
                    upstream = await fetchUpstreamWithBusyRetry(
                        `${CONTOOR_BASE}${upstreamPath}`,
                        {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(perturbed),
                            signal: controller.signal,
                        },
                    );
                    if (!upstream || upstream.status < 500) break;
                    // Keep trying if it's still the cache bug.
                    const rt = await upstream.clone().text().catch(() => '');
                    if (!/cannot access local variable|'glb_bytes'|'metadata'/i.test(rt)) {
                        break;
                    }
                }
            } else if (text) {
                // Not the cache-hit bug — surface the original error.
                sendJson(res, upstream.status >= 500 ? 502 : upstream.status, {
                    error: `Upstream ${upstream.status}`,
                    detail: text.slice(0, 400),
                });
                return;
            }
        }

        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            sendJson(res, upstream.status >= 500 ? 502 : upstream.status, {
                error: `Upstream ${upstream.status}`,
                detail: text.slice(0, 400),
            });
            return;
        }

        setCors(res);
        // Caching: derived from static raw data, safe to cache hard at
        // the CDN. Same key = same answer (the lat/lng+radius are in
        // the request body; we rely on body-aware client caching).
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

        if (JSON_ROUTES.has(op)) {
            res.setHeader('Content-Type', 'application/json');
            const text = await upstream.text();
            res.status(200).end(text);
            return;
        }

        const ct = upstream.headers.get('Content-Type') || 'model/gltf-binary';
        res.setHeader('Content-Type', ct);
        const meta = upstream.headers.get('X-GLB-Metadata');
        if (meta) res.setHeader('X-GLB-Metadata', meta);

        const buf = Buffer.from(await upstream.arrayBuffer());
        res.status(200).end(buf);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendJson(res, 502, { error: 'three3d upstream unreachable', detail: msg });
    } finally {
        clearTimeout(timer);
    }
}

// The upstream serialises heavy operations (one Roofer/CityJSON job at
// a time) and answers 503 "Server is busy" when the semaphore is full.
// Retry with jittered backoff so multi-building bursts succeed even
// when the upstream is saturated. We cap retries by both attempt count
// and elapsed time so we always answer before Vercel times the
// function out.
async function fetchUpstreamWithBusyRetry(url, init, opts = {}) {
    const maxAttempts = opts.maxAttempts ?? 6;
    const baseDelay = opts.baseDelayMs ?? 700;
    const deadline = Date.now() + (opts.maxElapsedMs ?? UPSTREAM_TIMEOUT_MS - 5_000);

    let lastResponse = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const res = await fetch(url, init);
        if (res.status !== 503) return res;
        // The upstream's busy response includes the
        // "Server is busy" detail. Treat any 503 as transient.
        lastResponse = res;
        if (attempt === maxAttempts - 1) break;
        const wait = baseDelay * Math.pow(1.4, attempt) + Math.random() * 200;
        if (Date.now() + wait > deadline) break;
        await new Promise((r) => setTimeout(r, wait));
    }
    return lastResponse;
}

// WGS84 → LV95 (EPSG:4326 → EPSG:2056). Approximate Swisstopo formula,
// good to ~1 m anywhere in Switzerland. Mirrors swissCoords.js on the
// client so the BBOX bounds we send to the WFS match the client's
// terrain origin.
function wgs84ToLV95(lng, lat) {
    const phi = (lat * 3600 - 169028.66) / 10000;
    const lam = (lng * 3600 - 26782.5) / 10000;
    const easting =
        2600072.37 +
        211455.93 * lam -
        10938.51 * lam * phi -
        0.36 * lam * phi * phi -
        44.54 * lam * lam * lam;
    const northing =
        1200147.07 +
        308807.95 * phi +
        3745.25 * lam * lam +
        76.63 * phi * phi -
        194.56 * lam * lam * phi +
        119.79 * phi * phi * phi;
    return { easting, northing };
}

async function handleFootprints(body, res) {
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const radius = Math.min(500, Math.max(10, Number(body?.radius_m) || 100));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        sendJson(res, 400, { error: 'lat and lng are required numbers' });
        return;
    }

    const { easting, northing } = wgs84ToLV95(lng, lat);
    const minE = easting - radius;
    const maxE = easting + radius;
    const minN = northing - radius;
    const maxN = northing + radius;

    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: WFS_BUILDING_LAYER,
        outputFormat: 'application/json',
        maxFeatures: String(WFS_BBOX_PAGE_SIZE),
        srsName: 'EPSG:4326',
        CQL_FILTER: `BBOX(geom, ${minE}, ${minN}, ${maxE}, ${maxN}, 'EPSG:2056')`,
    });

    const url = `${WFS_BASE_URL}?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
        const upstream = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
        });
        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            sendJson(res, 502, { error: `WFS ${upstream.status}`, detail: text.slice(0, 200) });
            return;
        }
        const payload = await upstream.json();
        const features = Array.isArray(payload?.features) ? payload.features : [];

        const buildings = [];
        const seen = new Set();
        for (const f of features) {
            const props = f?.properties || {};
            const e = Number(props.gwr_bldg_ecoord);
            const n = Number(props.gwr_bldg_ncoord);
            // The GWR coords are the canonical building reference point.
            // Fall back to the polygon centroid only if they're missing.
            let centroidE = Number.isFinite(e) ? e : null;
            let centroidN = Number.isFinite(n) ? n : null;
            if ((centroidE == null || centroidN == null) && f?.geometry?.type === 'Polygon') {
                const ring = f.geometry.coordinates?.[0] || [];
                if (ring.length) {
                    let sx = 0, sy = 0;
                    for (const [lo, la] of ring) { sx += lo; sy += la; }
                    const cLng = sx / ring.length;
                    const cLat = sy / ring.length;
                    const c = wgs84ToLV95(cLng, cLat);
                    centroidE = c.easting;
                    centroidN = c.northing;
                }
            }
            if (centroidE == null || centroidN == null) continue;

            // Building-model uses INTERSECTS, so we need a point that
            // lands inside the footprint. The GWR centroid is the
            // building's published reference point and reliably falls
            // inside the geometry. Convert LV95 → WGS84 (approximate)
            // for the upstream call.
            const wgs = lv95ToWGS84(centroidE, centroidN);

            const id =
                props.gwr_bldg_id ??
                props.res_building_id ??
                f?.id ??
                `c${centroidE.toFixed(0)}_${centroidN.toFixed(0)}`;
            const key = String(id);
            if (seen.has(key)) continue;
            seen.add(key);

            buildings.push({
                id: key,
                gwr_bldg_id: props.gwr_bldg_id ?? null,
                res_building_id: props.res_building_id ?? null,
                address: props.gwr_address ?? null,
                lat: wgs.lat,
                lng: wgs.lng,
                easting: centroidE,
                northing: centroidN,
                floors: props.gwr_bldg_floors ?? null,
                const_year: props.gwr_const_year ?? null,
            });
        }

        // Order by distance to the centre so the closest buildings are
        // fetched first (good UX: the building you clicked appears
        // before the periphery).
        buildings.sort((a, b) => {
            const da = (a.easting - easting) ** 2 + (a.northing - northing) ** 2;
            const db = (b.easting - easting) ** 2 + (b.northing - northing) ** 2;
            return da - db;
        });

        setCors(res);
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        sendJson(res, 200, {
            center_lv95: { easting, northing },
            radius_m: radius,
            count: buildings.length,
            buildings,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendJson(res, 502, { error: 'WFS unreachable', detail: msg });
    } finally {
        clearTimeout(timer);
    }
}

// LV95 → WGS84 (approximate). Inverse of NAVREF-05.013. Good to ~0.5 m
// anywhere in Switzerland.
function lv95ToWGS84(easting, northing) {
    const y = (easting - 2600000) / 1000000;
    const x = (northing - 1200000) / 1000000;
    const lng =
        2.6779094 +
        4.728982 * y +
        0.791484 * y * x +
        0.1306 * y * x * x -
        0.0436 * y * y * y;
    const lat =
        16.9023892 +
        3.238272 * x -
        0.270978 * y * y -
        0.002528 * x * x -
        0.0447 * y * y * x -
        0.014 * x * x * x;
    return {
        lng: (lng * 100) / 36,
        lat: (lat * 100) / 36,
    };
}
