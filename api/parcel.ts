// Vercel Node serverless function.
//
// Proxies POST /api/parcel → RES /res_api/parcel_data so the client never
// needs the RES API token. Mirrors the scoore /api/overpass pattern.
//
// RES access rides the suite-wide TYPED client from @aireon/shared/api
// (openapi-fetch over the generated RES OpenAPI contract): path and body are
// compile-time checked and `X-RES-API-Version: 2` opts into the corrected
// error contract (real 4xx/5xx instead of the legacy plain-text HTTP 200).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createResApiClient, type components } from '@aireon/shared/api';

export const config = { maxDuration: 15 };

// RES parcel_data expects the token in a `token:` header as the RAW value.
// The suite-wide committed token keeps the function self-sufficient on any
// Vercel project without extra env vars (same constant as before).
const RES_API_TOKEN = 'DNfbHaqajFigz4jPX9B8vnatUduLKZXVwA83WKZG';
const UPSTREAM_TIMEOUT_MS = 12000;

// Unauthenticated at construction — the token is attached per request.
// `fetch` resolves at call time so test mocks and late-installed polyfills
// are honored (openapi-fetch captures fetch at construction otherwise).
const resApi = createResApiClient({
    fetch: (input, init) => globalThis.fetch(input, init),
});

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Client-Info, Apikey',
};

function send(res: VercelResponse, status: number, body: unknown): void {
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
    res.status(status).json(body);
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse,
): Promise<void> {
    if (req.method === 'OPTIONS') {
        for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
        res.status(204).end();
        return;
    }
    if (req.method !== 'POST') {
        send(res, 405, { error: 'Method not allowed' });
        return;
    }

    let body: { egrid?: unknown; lat?: unknown; lng?: unknown };
    if (typeof req.body === 'string') {
        try {
            body = JSON.parse(req.body);
        } catch {
            send(res, 400, { error: 'Invalid JSON body' });
            return;
        }
    } else {
        body = (req.body ?? {}) as { egrid?: unknown; lat?: unknown; lng?: unknown };
    }

    const egrid = typeof body?.egrid === 'string' ? body.egrid.trim() : null;
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!egrid && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
        send(res, 400, { error: "Provide either 'egrid' or 'lat'/'lng'" });
        return;
    }

    // The old inline fetch never sent `structure` (RES defaults it to
    // "default" server-side); the cast keeps the wire bytes identical while
    // the endpoint path + response stay contract-checked.
    const upstreamBody = (egrid ? { egrid } : { lat, lng }) as
        components['schemas']['ParcelLocationRequest'];

    try {
        // `parseAs: "text"` + manual JSON.parse keeps the old read-then-parse
        // tolerance for non-JSON 2xx bodies (openapi-fetch's own json parsing
        // would reject them instead of degrading gracefully).
        const { data, error, response } = await resApi.POST('/res_api/parcel_data', {
            headers: { token: RES_API_TOKEN },
            body: upstreamBody,
            parseAs: 'text',
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });

        if (!response.ok) {
            // On non-2xx the client yields `error`: the JSON-parsed body when
            // parseable, else the raw text — mirror the old text→parse→wrap flow.
            // (The contract declares only a 200 for this endpoint, so `error`
            // is typed `never`; widen it to inspect the runtime body.)
            const errBody: unknown = error;
            let parsed: unknown;
            if (typeof errBody === 'string') {
                parsed = errBody
                    ? { error: 'Non-JSON response from upstream', raw: errBody.slice(0, 200) }
                    : null;
            } else {
                parsed = errBody ?? null;
            }
            send(res, response.status >= 500 ? 502 : response.status, parsed);
            return;
        }

        const text = (data as unknown as string | undefined) ?? '';
        let parsed: unknown = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = { error: 'Non-JSON response from upstream', raw: text.slice(0, 200) };
        }
        res.setHeader(
            'Cache-Control',
            'public, s-maxage=3600, stale-while-revalidate=86400',
        );
        send(res, 200, parsed);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        send(res, 502, { error: 'parcel service unreachable', details: msg });
    }
}
