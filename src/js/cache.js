// Tiny TTL-aware localStorage cache.
//
// We make N redundant trips to /api/parcel, /api/similoo, and
// /api/three3d/height-volume across a single browsing session — the same
// EGRID resolves the same comparables, the same building gives the same
// volume. localStorage is a good fit: same-origin, persists across
// reloads, easy to bound by namespace.
//
// Each entry is stored as `{ v: value, e: epochMs }`. Reads check
// expiry and evict on the fly; writes overwrite atomically.

const NAMESPACE = 'similoo-three:cache:';

// Lightweight write-quota guard. localStorage is ~5 MB per origin; we
// don't want a runaway cache (e.g. dozens of large similoo comparable
// arrays) to push the suite's `theme` / `locale` keys out. A soft cap
// of 64 entries per namespace, evicted by oldest expiry, keeps us well
// under that even with 100 KB payloads.
const MAX_ENTRIES_PER_KEYSPACE = 64;

export function getCached(key) {
    try {
        const raw = localStorage.getItem(NAMESPACE + key);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || typeof entry.e !== 'number' || entry.e < Date.now()) {
            // Expired — sweep it.
            localStorage.removeItem(NAMESPACE + key);
            return null;
        }
        return entry.v;
    } catch {
        return null;
    }
}

export function setCached(key, value, ttlMs) {
    try {
        const entry = { v: value, e: Date.now() + ttlMs };
        localStorage.setItem(NAMESPACE + key, JSON.stringify(entry));
        // After every write, opportunistically evict the oldest entries
        // if we're over the soft cap. localStorage is sync so the worst
        // case is a small CPU spike on the cap-hit write.
        maybeEvict();
    } catch (e) {
        // Quota-exceeded or storage disabled. We don't surface this —
        // the network path is still authoritative.
        try {
            localStorage.removeItem(NAMESPACE + key);
        } catch {}
    }
}

// Wrap an async fetcher so the (cache-hit | network) decision lives in
// one place. `keyFn` returns a string cache key from the same args
// `fetcher` accepts; `ttlMs` controls the freshness window.
export function cacheable(fetcher, { keyFn, ttlMs }) {
    return async function cached(...args) {
        const key = keyFn(...args);
        if (key) {
            const hit = getCached(key);
            if (hit !== null) return hit;
        }
        const result = await fetcher(...args);
        if (key && result != null) setCached(key, result, ttlMs);
        return result;
    };
}

function maybeEvict() {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(NAMESPACE)) continue;
        try {
            const raw = localStorage.getItem(k);
            const e = raw ? JSON.parse(raw)?.e ?? 0 : 0;
            entries.push({ k, e });
        } catch {
            entries.push({ k, e: 0 });
        }
    }
    const overflow = entries.length - MAX_ENTRIES_PER_KEYSPACE;
    if (overflow <= 0) return;
    // Oldest-expiring first; drop the surplus.
    entries.sort((a, b) => a.e - b.e);
    for (let i = 0; i < overflow; i++) {
        try { localStorage.removeItem(entries[i].k); } catch {}
    }
}

// Standard freshness windows used across the app. Tuned to match
// upstream backend TTLs where they're documented.
export const TTL = {
    parcel: 24 * 60 * 60 * 1000,            // 24 h — parcel/EGRID is essentially static
    similoo: 7 * 24 * 60 * 60 * 1000,       // 7 d — matches the RES /score/similoo Redis TTL
    heightVolume: 7 * 24 * 60 * 60 * 1000,  // 7 d — derived from static LIDAR
    footprints: 7 * 24 * 60 * 60 * 1000,    // 7 d — building footprints are static per bbox
};
