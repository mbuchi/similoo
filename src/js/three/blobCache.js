// Dedicated client-side IndexedDB blob cache for the heavy 3D binaries.
//
// The building-detail viewer streams two large, deterministic GLB meshes per
// parcel from the Contoor 3D API (via the /api/three3d proxy):
//
//   * /api/three3d/terrain  — a coloured LAS point-cloud GLB (hundreds of KB
//     to a few MB depending on the LiDAR density at that coordinate)
//   * /api/three3d/building — the Roofer building-model GLB
//
// Both are static per (rounded) coordinate: the terrain LiDAR and the building
// footprint don't change between two visits, and the upstream already caches
// each GLB under an exact coordinate key. Re-opening the same parcel — or a
// comparable that snaps to the same footprint — should therefore be a
// zero-network hit, and every cached open is one fewer expensive
// point-cloud/GLB generation hitting the Contoor 3D API.
//
// Why a DEDICATED store and not @swissnovo/shared's IndexedDBCache:
// that primitive byte-accounts its LRU budget with
// `TextEncoder().encode(JSON.stringify(data)).length` — an ArrayBuffer or Blob
// JSON-stringifies to `{}` (size 0), so its byte-budget eviction is blind to
// binary payloads and would never evict. This store accounts the real
// `byteLength` of the buffer instead, so the LRU budget is meaningful for
// multi-MB meshes.
//
// Suite convention (matching IndexedDBCache): EVERY failure path is silent.
// Incognito mode, a disabled/blocked IndexedDB, a quota error mid-write — all
// degrade transparently to a plain network fetch. The cache is a hot-path
// accelerator, never a dependency: it must never throw and never block the 3D
// viewer.

const DB_NAME = 'similoo-three:blobs';
const STORE_NAME = 'glb';
const DB_VERSION = 1;

// Byte budget for the whole store. ~150 MB comfortably holds dozens of
// terrain+building mesh pairs while staying well within the browser's
// per-origin IDB quota. On write, once the total exceeds this we evict the
// least-recently-used records until back under budget.
const MAX_BYTES = 150 * 1024 * 1024;

// Terrain/building meshes are static per coordinate, so a long TTL is safe.
// 14 days bounds staleness if the upstream regenerates a mesh, while still
// surviving across many browsing sessions.
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        let request;
        try {
            request = indexedDB.open(DB_NAME, DB_VERSION);
        } catch (err) {
            reject(err);
            return;
        }
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // keyPath 'key' — the stable request key (URL + method + body).
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                // Index on lastAccessed so LRU eviction can walk records
                // oldest-first without loading every value.
                store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = () => reject(request.error);
    }).catch((err) => {
        // Reset so a later call can retry (e.g. storage re-enabled). Surfacing
        // null lets every caller fall back to the network.
        dbPromise = null;
        throw err;
    });
    return dbPromise;
}

// Build a stable cache key from a request. The 3D endpoints are POSTs whose
// body fully determines the response, so the body is part of the key.
export function blobCacheKey(url, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    let body = '';
    if (typeof init.body === 'string') body = init.body;
    else if (init.body != null) {
        try { body = JSON.stringify(init.body); } catch { body = String(init.body); }
    }
    return `${method} ${url} ${body}`;
}

function txStore(db, mode) {
    const tx = db.transaction(STORE_NAME, mode);
    return { tx, store: tx.objectStore(STORE_NAME) };
}

function reqAsync(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Bump lastAccessed on a fresh hit so LRU reflects real usage. Best-effort:
// failures are swallowed (the read already succeeded).
async function touch(db, key) {
    try {
        const { tx, store } = txStore(db, 'readwrite');
        const entry = await reqAsync(store.get(key));
        if (entry) {
            entry.lastAccessed = Date.now();
            store.put(entry);
        }
        await new Promise((resolve) => {
            tx.oncomplete = resolve;
            tx.onerror = resolve;
            tx.onabort = resolve;
        });
    } catch {
        // ignore — touch is purely an LRU hint
    }
}

// Evict least-recently-used records until the store's total bytes are within
// MAX_BYTES. Walks the lastAccessed index oldest-first.
async function enforceBudget(db) {
    try {
        const { tx, store } = txStore(db, 'readwrite');
        // Sum sizes first.
        const all = await reqAsync(store.getAll());
        let total = 0;
        for (const e of all) total += e.bytes || 0;
        if (total <= MAX_BYTES) return;

        const ordered = all
            .slice()
            .sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
        for (const e of ordered) {
            if (total <= MAX_BYTES) break;
            store.delete(e.key);
            total -= e.bytes || 0;
        }
        await new Promise((resolve) => {
            tx.oncomplete = resolve;
            tx.onerror = resolve;
            tx.onabort = resolve;
        });
    } catch {
        // ignore — over-budget is tolerable; the browser quota is the backstop
    }
}

async function readEntry(key) {
    const db = await openDB();
    const { store } = txStore(db, 'readonly');
    const entry = await reqAsync(store.get(key));
    if (!entry) return null;
    if (entry.ts && Date.now() - entry.ts > TTL_MS) {
        // Stale — drop it and miss.
        deleteEntry(key).catch(() => {});
        return null;
    }
    // Refresh LRU in the background; don't block the hit on it.
    touch(db, key).catch(() => {});
    return entry;
}

// Persist the bytes plus a small header sidecar (e.g. X-GLB-Metadata) so a
// later cache hit can reconstruct the same metadata the network path produced.
// Stores a copy of the ArrayBuffer (slice) so the caller stays free to
// transfer/neuter theirs (e.g. hand it to a worker).
async function writeEntry(key, body, headers) {
    const db = await openDB();
    const buffer = body.slice(0);
    const now = Date.now();
    const entry = {
        key,
        body: buffer,
        headers: headers || {},
        bytes: buffer.byteLength,
        ts: now,
        lastAccessed: now,
    };
    const { tx, store } = txStore(db, 'readwrite');
    store.put(entry);
    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
    // Keep the store under budget after the new write.
    await enforceBudget(db);
}

export async function deleteEntry(key) {
    try {
        const db = await openDB();
        const { tx, store } = txStore(db, 'readwrite');
        store.delete(key);
        await new Promise((resolve) => {
            tx.oncomplete = resolve;
            tx.onerror = resolve;
            tx.onabort = resolve;
        });
    } catch {
        // ignore
    }
}

// Fetch an ArrayBuffer, transparently fronted by the IDB blob cache.
//
// On a fresh hit: returns the cached ArrayBuffer (and bumps its LRU time).
// On a miss/stale entry: fetches over the network, stores the bytes, returns
// them. Returns the parsed response headers from the network leg so callers
// that need them (e.g. an X-GLB-Metadata sidecar) still get them on the cold
// path; on a cache hit the optional `headers` map is also restored.
//
// Options:
//   * extraHeaders — response header names to persist alongside the body so a
//     cache hit can reconstruct the same metadata the network produced.
//   * shouldCache(buffer, res) — predicate gating whether the fetched bytes get
//     written. Lets callers refuse to cache an error/wrong-shape payload (e.g.
//     a small JSON "link" response that the upstream sometimes returns instead
//     of the GLB binary) so a transient miss never poisons the entry for the
//     full TTL. The bytes are still RETURNED either way.
//
// Any cache error (open/read/write) is swallowed and we fall back to a plain
// fetch — the binary the viewer needs is always returned (or the fetch error
// propagates, exactly as it would without the cache).
export async function cachedArrayBuffer(url, init = {}, { extraHeaders = [], shouldCache } = {}) {
    const key = blobCacheKey(url, init);

    // 1) Try the cache.
    try {
        const entry = await readEntry(key);
        if (entry && entry.body) {
            return { buffer: entry.body, headers: entry.headers || {}, cached: true };
        }
    } catch {
        // fall through to network
    }

    // 2) Network leg.
    const res = await fetch(url, init);
    if (!res.ok) {
        // Let the caller handle non-2xx exactly as before — surface enough to
        // build the same error message the loaders already produce.
        return { res, ok: false };
    }
    const buffer = await res.arrayBuffer();

    // Capture any header sidecars the caller asked us to preserve across hits.
    const headers = {};
    for (const name of extraHeaders) {
        const v = res.headers.get(name);
        if (v != null) headers[name] = v;
    }

    // 3) Store best-effort, gated by the optional predicate. Never let a cache
    // write failure break the return.
    const cacheable = typeof shouldCache === 'function' ? !!shouldCache(buffer, res) : true;
    if (cacheable) {
        try {
            await writeEntry(key, buffer, headers);
        } catch {
            // ignore — quota/incognito/etc.
        }
    }

    return { buffer, headers, cached: false };
}

export const __testing = { DB_NAME, STORE_NAME, MAX_BYTES, TTL_MS, writeEntry };
