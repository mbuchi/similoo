// Vercel Node serverless function.
//
// Proxies POST /api/similoo → RES /score/similoo so the client never needs
// the RES API token. Mirrors the scoore /api/overpass pattern.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { RES_API_BASE_URL } from '@aireon/shared/api';

export const config = { maxDuration: 15 };

// SCHEMA GAP: POST /score/similoo is not in the shared OpenAPI contract yet
// (recorded in docs/plans/harmonization-a2-res-client-recipe.md), so this
// proxy stays on a raw fetch — only the base URL derives from the shared
// constant. Move it onto the typed client once the contract covers it.
const RES_SIMILOO_URL = `${RES_API_BASE_URL}/score/similoo`;
const RES_API_TOKEN = 'DNfbHaqajFigz4jPX9B8vnatUduLKZXVwA83WKZG';
const UPSTREAM_TIMEOUT_MS = 12000;

// The construction-year window RES accepts: a bounded integer, or the
// unrestricted window spelled 'all' (0 is the accepted numeric synonym). This
// mirrors src/js/yearsWindow.js; the two cannot share a module because api/
// compiles under its own node tsconfig and ships as a serverless function.
//
// Validation is deliberately NOT just permissive: the old
// `Number.isFinite(Number(body.years)) ? Number(body.years) : 10` turned 'all'
// into a silent 10-year window AND forwarded -5, 3.7 and 1e9 upstream. A value
// outside the contract is garbage, so it falls back to the default rather than
// being clamped into a different question.
const DEFAULT_YEARS = 10;
const MIN_YEARS = 1;
const MAX_YEARS = 100;
const ALL_YEARS = 'all';

function isAllYears(raw: unknown): boolean {
    // Strictly `0`, never `Number(raw) === 0` - null, '' and false all coerce
    // to 0 and none of them means "every year".
    if (raw === 0) return true;
    if (typeof raw !== 'string') return false;
    const v = raw.trim().toLowerCase();
    return v === 'all' || v === '0';
}

function coerceYearsWindow(raw: unknown): number | typeof ALL_YEARS {
    if (isAllYears(raw)) return ALL_YEARS;
    if (typeof raw === 'string') {
        if (raw.trim() === '') return DEFAULT_YEARS;
    } else if (typeof raw !== 'number') {
        return DEFAULT_YEARS;
    }
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < MIN_YEARS || n > MAX_YEARS) return DEFAULT_YEARS;
    return n;
}

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

    let body: { egrid?: unknown; years?: unknown; limit?: unknown };
    if (typeof req.body === 'string') {
        try {
            body = JSON.parse(req.body);
        } catch {
            send(res, 400, { error: 'Invalid JSON body' });
            return;
        }
    } else {
        body = (req.body ?? {}) as { egrid?: unknown; years?: unknown; limit?: unknown };
    }

    const egrid = typeof body?.egrid === 'string' ? body.egrid.trim() : '';
    if (!egrid) {
        send(res, 400, { error: "Missing 'egrid'" });
        return;
    }
    const years = coerceYearsWindow(body?.years);
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
        let parsed: unknown = null;
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
