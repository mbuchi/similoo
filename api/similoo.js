// Vercel Node serverless function.
//
// Proxies POST /api/similoo → RES /score/similoo so the client never needs
// the RES API token. Mirrors the scoore /api/overpass pattern.

export const config = { maxDuration: 15 };

const RES_SIMILOO_URL = 'https://res.zeroo.ch/score/similoo';
const RES_API_TOKEN = 'DNfbHaqajFigz4jPX9B8vnatUduLKZXVwA83WKZG';
const UPSTREAM_TIMEOUT_MS = 12000;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Client-Info, Apikey',
};

function send(res, status, body) {
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
    res.status(status).json(body);
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
        res.status(204).end();
        return;
    }
    if (req.method !== 'POST') {
        send(res, 405, { error: 'Method not allowed' });
        return;
    }

    let body;
    if (typeof req.body === 'string') {
        try {
            body = JSON.parse(req.body);
        } catch {
            send(res, 400, { error: "Invalid JSON body" });
            return;
        }
    } else {
        body = req.body;
    }

    const egrid = typeof body?.egrid === 'string' ? body.egrid.trim() : '';
    if (!egrid) {
        send(res, 400, { error: "Missing 'egrid'" });
        return;
    }
    const years = Number.isFinite(Number(body?.years)) ? Number(body.years) : 10;
    const limit = Number.isFinite(Number(body?.limit)) ? Number(body.limit) : 12;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
        const upstream = await fetch(RES_SIMILOO_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                token: RES_API_TOKEN,
            },
            body: JSON.stringify({ egrid, years, limit }),
            signal: controller.signal,
        });
        const text = await upstream.text();
        let parsed = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = { error: 'Non-JSON response from upstream', raw: text.slice(0, 200) };
        }
        if (!upstream.ok) {
            send(res, upstream.status >= 500 ? 502 : upstream.status, parsed);
            return;
        }
        res.setHeader(
            'Cache-Control',
            'public, s-maxage=86400, stale-while-revalidate=604800',
        );
        send(res, 200, parsed);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        send(res, 502, { error: 'similoo service unreachable', details: msg });
    } finally {
        clearTimeout(timer);
    }
}
