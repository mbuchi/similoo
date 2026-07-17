// Client-side comparables logic: the /api/similoo fetch wrapper with its
// deterministic mock fallback, the EGRID normaliser that gates every
// parcel click, and the TTL localStorage cache all lookups flow through.

import assert from 'node:assert/strict';
import test from 'node:test';

// cache.js touches localStorage only inside its functions, but stub it
// before import so every code path sees the same fake store.
function makeLocalStorage() {
    const store = new Map();
    return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => {
            store.set(k, String(v));
        },
        removeItem: (k) => {
            store.delete(k);
        },
        key: (i) => [...store.keys()][i] ?? null,
        get length() {
            return store.size;
        },
    };
}
globalThis.localStorage = makeLocalStorage();

const { fetchSimilooComparables } = await import('../src/js/api/similoo.js');
const { normaliseEgrid } = await import('../src/js/comparison/parcelLookup.js');
const { getCached, setCached, cacheable } = await import('../src/js/cache.js');

function mockFetch(t, impl) {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => {
        calls.push({ url, init });
        return impl(url, init);
    };
    t.after(() => {
        globalThis.fetch = original;
    });
    return calls;
}

const round2 = (n) => Math.round(n * 100) / 100;

test('fetchSimilooComparables rejects when no egrid is given', async () => {
    await assert.rejects(() => fetchSimilooComparables(''), /egrid is required/);
});

test('fetchSimilooComparables passes the live backend payload through untouched', async (t) => {
    const payload = { target: { egrid: 'CH999999999999' }, comparables: [], meta: { source: 'res' } };
    const calls = mockFetch(t, () =>
        new Response(JSON.stringify(payload), { status: 200 }),
    );
    const result = await fetchSimilooComparables('CH999999999999');
    assert.equal(calls[0].url, '/api/similoo');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
        egrid: 'CH999999999999',
        years: 10,
        limit: 12,
    });
    assert.deepEqual(result, payload);
});

test('a 404 backend falls back to the deterministic mock contract', async (t) => {
    mockFetch(t, () => new Response('not found', { status: 404 }));
    const years = 8;
    const limit = 5;
    const result = await fetchSimilooComparables('CH123456789012', { years, limit });

    assert.equal(result.meta.source, 'mock');
    assert.equal(result.target.egrid, 'CH123456789012');
    assert.equal(result.comparables.length, limit);

    const thisYear = new Date().getFullYear();
    for (const c of result.comparables) {
        assert.match(c.egrid, /^CH\d{12}$/);
        assert.ok(c.similarity_score >= 0 && c.similarity_score <= 1);
        assert.equal(c.ratioV, round2(c.building_volume_m3 / c.parcel_area_m2));
        assert.ok(
            c.construction_year >= thisYear - years && c.construction_year <= thisYear,
            `construction_year ${c.construction_year} outside the ${years}-year window`,
        );
    }
});

test('mock comparables arrive sorted by similarity, best first', async (t) => {
    mockFetch(t, () => new Response('', { status: 404 }));
    const { comparables } = await fetchSimilooComparables('CH777777777777');
    assert.ok(comparables.length > 1);
    for (let i = 1; i < comparables.length; i++) {
        assert.ok(comparables[i - 1].similarity_score >= comparables[i].similarity_score);
    }
});

test('the mock is seeded by the egrid: same input, same comparables', async (t) => {
    mockFetch(t, () => new Response('', { status: 404 }));
    const a = await fetchSimilooComparables('CH123456789012');
    const b = await fetchSimilooComparables('CH123456789012');
    const c = await fetchSimilooComparables('CH210987654321');
    assert.deepEqual(a.target, b.target);
    assert.deepEqual(a.comparables, b.comparables);
    assert.notDeepEqual(a.comparables, c.comparables);
});

test('normaliseEgrid accepts only the canonical CH + 12 alphanumeric shape', () => {
    assert.equal(normaliseEgrid('CH123456789012'), 'CH123456789012');
    assert.equal(normaliseEgrid('  ch1234567890ab  '), 'CH1234567890AB');
    assert.equal(normaliseEgrid('CH12345678901'), null); // 11 chars: too short
    assert.equal(normaliseEgrid('DE123456789012'), null); // wrong country prefix
    assert.equal(normaliseEgrid('123456789012'), null); // bare numeric parcel id
    assert.equal(normaliseEgrid(null), null);
});

test('cache roundtrips a value and drops it after the TTL expires', () => {
    setCached('spec-key', { hello: 'world' }, 60_000);
    assert.deepEqual(getCached('spec-key'), { hello: 'world' });

    setCached('spec-expired', 'stale', -1);
    assert.equal(getCached('spec-expired'), null);
    // The expired entry is swept from storage, not just hidden.
    assert.equal(localStorage.getItem('similoo-three:cache:spec-expired'), null);
});

test('cacheable() calls the fetcher once, then serves the cache', async () => {
    let hits = 0;
    const fetcher = cacheable(
        async (egrid) => {
            hits += 1;
            return { egrid, hits };
        },
        { keyFn: (egrid) => `spec-cacheable:${egrid}`, ttlMs: 60_000 },
    );
    const first = await fetcher('CH000000000001');
    const second = await fetcher('CH000000000001');
    assert.equal(hits, 1);
    assert.deepEqual(first, second);

    // A different key misses the cache and fetches again.
    await fetcher('CH000000000002');
    assert.equal(hits, 2);
});
