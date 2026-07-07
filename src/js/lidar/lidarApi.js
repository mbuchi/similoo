// Client for the RES lidar-tile backend (ported from lidaroo's lidarApi.ts).
//
// The flow is: POST /prepare with a WGS84 point -> either an immediately
// streamable tile ({status:'ready', copcUrl}) or a background conversion
// job ({status:'converting'}) that the caller should poll via
// GET /status/:tileId until it flips to 'ready' (or 'error'). A cold
// conversion takes ~45s; once cached, subsequent /prepare calls for the
// same tile return 'ready' instantly.
//
// Both endpoints return `copcUrl` as a path RELATIVE to RES_BASE (e.g.
// `/res_api/lidar/copc/<tileId>.copc.laz`); this module resolves it to an
// absolute URL so callers (copcScene's COPCSource) can fetch it directly
// regardless of where RES is hosted.

const RES_BASE = import.meta.env.VITE_RES_BASE ?? 'https://res.zeroo.ch';

// Resolves a RES-relative path (e.g. `/res_api/lidar/copc/foo.copc.laz`)
// to an absolute URL.
function toAbsoluteUrl(path) {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    return `${RES_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function readErrorMessage(response) {
    try {
        const body = await response.clone().json();
        if (body && typeof body.error === 'string') {
            return body.error;
        }
        if (body && typeof body.message === 'string') {
            return body.message;
        }
    } catch {
        // Body wasn't JSON (or was empty); fall through to the status text.
    }
    return `${response.status} ${response.statusText}`.trim();
}

// Requests conversion/streaming for the swissSURFACE3D tile covering
// `{lat, lng}`. Returns immediately with either a ready `copcUrl` or a
// `tileId` to poll via `pollStatus`.
export async function prepareTile(lat, lng) {
    const response = await fetch(`${RES_BASE}/res_api/lidar/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
    });

    if (!response.ok) {
        throw new Error(`Could not prepare this tile: ${await readErrorMessage(response)}`);
    }

    const data = await response.json();
    return { ...data, copcUrl: toAbsoluteUrl(data.copcUrl) };
}

// Polls the conversion status of a tile previously requested via `prepareTile`.
export async function pollStatus(tileId) {
    const response = await fetch(`${RES_BASE}/res_api/lidar/status/${encodeURIComponent(tileId)}`);

    if (!response.ok) {
        throw new Error(`Could not check tile status: ${await readErrorMessage(response)}`);
    }

    const data = await response.json();
    return { ...data, copcUrl: toAbsoluteUrl(data.copcUrl) };
}

// Thrown by pollTileUntilSettled when the caller cancels mid-poll.
export class PollCancelledError extends Error {
    constructor() {
        super('Tile polling cancelled');
        this.name = 'PollCancelledError';
    }
}

// Thrown by pollTileUntilSettled when a tile never settles in time.
export class PollTimeoutError extends Error {
    constructor() {
        super('This tile is taking longer than usual to prepare. Please try again in a moment.');
        this.name = 'PollTimeoutError';
    }
}

// Polls a tile's conversion status SEQUENTIALLY until it settles
// (`ready` / `error`), the caller cancels, or the timeout elapses.
//
// Sequential-by-await is the key robustness property: the next poll is only
// scheduled after the current one resolves, so a slow status response can never
// stack overlapping requests (a naive `setInterval` could). A hard timeout stops
// a perpetually-`converting` tile from polling forever.
export async function pollTileUntilSettled(
    tileId,
    {
        intervalMs = 2500,
        timeoutMs = 300_000,
        isCancelled = () => false,
        onUpdate,
        poll = pollStatus,
        sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now = Date.now,
    } = {},
) {
    const start = now();
    for (;;) {
        if (isCancelled()) throw new PollCancelledError();

        const status = await poll(tileId);
        if (isCancelled()) throw new PollCancelledError();
        onUpdate?.(status);

        if (status.status === 'ready' || status.status === 'error') {
            return status;
        }
        if (now() - start >= timeoutMs) {
            throw new PollTimeoutError();
        }
        await sleep(intervalMs);
    }
}
