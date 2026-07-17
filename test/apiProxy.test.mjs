// Real invocations of the Vercel serverless handlers in api/, with the
// upstream fetch mocked. These are the two proxies every similoo lookup
// flows through: /api/similoo (comparables) and /api/parcel (EGRID resolve).

import assert from 'node:assert/strict';
import test from 'node:test';

import similooHandler from '../api/similoo.js';
import parcelHandler from '../api/parcel.js';

function createResponse() {
    return {
        body: undefined,
        ended: false,
        headers: new Map(),
        statusCode: 200,
        setHeader(name, value) {
            this.headers.set(name, value);
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        end() {
            this.ended = true;
            return this;
        },
    };
}

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

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

test('api/similoo: OPTIONS preflight ends with 204 and CORS headers', async () => {
    const res = createResponse();
    await similooHandler({ method: 'OPTIONS' }, res);
    assert.equal(res.statusCode, 204);
    assert.equal(res.ended, true);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
});

test('api/similoo: non-POST methods are rejected with 405', async () => {
    const res = createResponse();
    await similooHandler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.body, { error: 'Method not allowed' });
});

test('api/similoo: a POST without an egrid is a 400', async () => {
    const res = createResponse();
    await similooHandler({ method: 'POST', body: { years: 10 } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Missing 'egrid'" });
});

test('api/similoo: an unparseable string body is a 400, not a crash', async () => {
    const res = createResponse();
    await similooHandler({ method: 'POST', body: '{not json' }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid JSON body' });
});

test('api/similoo: forwards trimmed egrid plus default years/limit to RES', async (t) => {
    const upstreamPayload = { target: { egrid: 'CH111111111111' }, comparables: [] };
    const calls = mockFetch(t, () => jsonResponse(upstreamPayload));

    const res = createResponse();
    await similooHandler(
        { method: 'POST', body: { egrid: '  CH111111111111  ' } },
        res,
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://res.zeroo.ch/score/similoo');
    assert.ok(calls[0].init.headers.token, 'RES token header must be attached server-side');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
        egrid: 'CH111111111111',
        years: 10,
        limit: 12,
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, upstreamPayload);
    assert.equal(
        res.headers.get('Cache-Control'),
        'public, s-maxage=86400, stale-while-revalidate=604800',
    );
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
});

test('api/similoo: numeric strings for years/limit are coerced and forwarded', async (t) => {
    const calls = mockFetch(t, () => jsonResponse({ comparables: [] }));
    const res = createResponse();
    await similooHandler(
        { method: 'POST', body: { egrid: 'CH222222222222', years: '7', limit: '5' } },
        res,
    );
    assert.deepEqual(JSON.parse(calls[0].init.body), {
        egrid: 'CH222222222222',
        years: 7,
        limit: 5,
    });
});

test('api/similoo: upstream 5xx is masked as 502, upstream 4xx keeps its status', async (t) => {
    mockFetch(t, () => jsonResponse({ error: 'boom' }, 500));
    const res5xx = createResponse();
    await similooHandler({ method: 'POST', body: { egrid: 'CH333333333333' } }, res5xx);
    assert.equal(res5xx.statusCode, 502);
    assert.deepEqual(res5xx.body, { error: 'boom' });

    mockFetch(t, () => jsonResponse({ error: 'no match' }, 404));
    const res4xx = createResponse();
    await similooHandler({ method: 'POST', body: { egrid: 'CH333333333333' } }, res4xx);
    assert.equal(res4xx.statusCode, 404);
    assert.deepEqual(res4xx.body, { error: 'no match' });
});

test('api/similoo: an unreachable upstream becomes a 502 with details', async (t) => {
    mockFetch(t, () => {
        throw new Error('getaddrinfo ENOTFOUND');
    });
    const res = createResponse();
    await similooHandler({ method: 'POST', body: { egrid: 'CH444444444444' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'similoo service unreachable');
    assert.match(res.body.details, /ENOTFOUND/);
});

test('api/parcel: requires either egrid or a finite lat/lng pair', async () => {
    const res = createResponse();
    await parcelHandler({ method: 'POST', body: { lat: 'x', lng: 8.5 } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Provide either 'egrid' or 'lat'/'lng'" });
});

test('api/parcel: lat/lng lookups forward only coordinates upstream', async (t) => {
    const calls = mockFetch(t, () => jsonResponse({ features: [] }));
    const res = createResponse();
    await parcelHandler({ method: 'POST', body: { lat: 47.05, lng: 8.31 } }, res);
    assert.equal(calls[0].url, 'https://res.zeroo.ch/res_api/parcel_data');
    assert.deepEqual(JSON.parse(calls[0].init.body), { lat: 47.05, lng: 8.31 });
    assert.equal(res.statusCode, 200);
    assert.equal(
        res.headers.get('Cache-Control'),
        'public, s-maxage=3600, stale-while-revalidate=86400',
    );
});

test('api/parcel: egrid wins over coordinates when both are supplied', async (t) => {
    const calls = mockFetch(t, () => jsonResponse({ features: [] }));
    const res = createResponse();
    await parcelHandler(
        { method: 'POST', body: { egrid: 'CH555555555555', lat: 47.05, lng: 8.31 } },
        res,
    );
    assert.deepEqual(JSON.parse(calls[0].init.body), { egrid: 'CH555555555555' });
});
