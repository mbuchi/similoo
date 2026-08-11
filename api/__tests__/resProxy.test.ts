// resProxy.test — behavior-parity checks for the shared-typed-client
// migration of similoo's Vercel functions.
//
// The old hand-rolled inline fetches hit `https://res.zeroo.ch` with a
// `token` header; these tests pin the SAME request shape out of the migrated
// proxies (base URL from the shared constant, verb, token,
// `X-RES-API-Version: 2` where the typed client is used) plus each handler's
// outward status mapping.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RES_API_BASE_URL } from '@aireon/shared/api';
import parcelHandler from '../parcel';
import similooHandler from '../similoo';

const SUITE_TOKEN = 'DNfbHaqajFigz4jPX9B8vnatUduLKZXVwA83WKZG';

/** Install a fetch mock and return a getter for the captured Request.
 * The typed client passes a Request object; raw call sites pass (url, init) —
 * normalize both into a Request so assertions read one shape. */
function mockFetch(response: Response): () => Request {
  let captured: Request | undefined;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    captured = input instanceof Request ? input : new Request(input, init);
    return response;
  });
  return () => {
    if (!captured) throw new Error('fetch was not called');
    return captured;
  };
}

/** Minimal recorder for the Vercel (req, res) Node handler signature. */
function mockRes() {
  const headers: Record<string, string> = {};
  const out = {
    statusCode: 0,
    body: undefined as unknown,
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return out;
    },
    status(code: number) {
      out.statusCode = code;
      return out;
    },
    json(body: unknown) {
      out.body = body;
      return out;
    },
    send(body: unknown) {
      out.body = body;
      return out;
    },
    end() {
      return out;
    },
  };
  return out;
}

type Handler = (req: unknown, res: unknown) => Promise<void> | void;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('client base URL', () => {
  it('the shared constant is the production RES host the old proxies hardcoded', () => {
    expect(RES_API_BASE_URL).toBe('https://res.zeroo.ch');
  });
});

describe('api/parcel (typed client)', () => {
  it('POSTs lat/lng with token + version headers and forwards the JSON', async () => {
    const req = mockFetch(
      new Response('{"features":[]}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = mockRes();
    await (parcelHandler as Handler)(
      { method: 'POST', body: { lat: 47.37, lng: 8.54 } },
      res,
    );
    expect(req().url).toBe(`${RES_API_BASE_URL}/res_api/parcel_data`);
    expect(req().method).toBe('POST');
    expect(req().headers.get('token')).toBe(SUITE_TOKEN);
    expect(req().headers.get('x-res-api-version')).toBe('2');
    // The old proxy never sent `structure`; the wire bytes must stay identical.
    expect(await req().text()).toBe(JSON.stringify({ lat: 47.37, lng: 8.54 }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ features: [] });
    expect(res.headers['cache-control']).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
  });

  it('POSTs an egrid-only body when egrid is provided', async () => {
    const req = mockFetch(
      new Response('{"features":[]}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = mockRes();
    await (parcelHandler as Handler)(
      { method: 'POST', body: { egrid: ' CH1234 ' } },
      res,
    );
    expect(await req().text()).toBe(JSON.stringify({ egrid: 'CH1234' }));
  });

  it('resolves fetch at call time, so runtime fetch swaps are honored', async () => {
    const stub = vi.fn(async () =>
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', stub);
    try {
      const res = mockRes();
      await (parcelHandler as Handler)(
        { method: 'POST', body: { lat: 1, lng: 2 } },
        res,
      );
      expect(stub).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('forwards a non-5xx upstream error status with its JSON body', async () => {
    mockFetch(
      new Response('{"error":"no parcel"}', {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = mockRes();
    await (parcelHandler as Handler)(
      { method: 'POST', body: { lat: 47.37, lng: 8.54 } },
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'no parcel' });
  });

  it('maps a 5xx upstream failure to the same 502 shape as before', async () => {
    mockFetch(new Response('boom', { status: 500 }));
    const res = mockRes();
    await (parcelHandler as Handler)(
      { method: 'POST', body: { lat: 47.37, lng: 8.54 } },
      res,
    );
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      error: 'Non-JSON response from upstream',
      raw: 'boom',
    });
  });

  it('rejects a body with neither egrid nor coordinates without calling RES', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const res = mockRes();
    await (parcelHandler as Handler)({ method: 'POST', body: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('api/similoo (schema-gap raw fetch)', () => {
  it('POSTs /score/similoo off the shared base with the suite token', async () => {
    const req = mockFetch(
      new Response('{"results":[]}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = mockRes();
    await (similooHandler as Handler)(
      { method: 'POST', body: { egrid: 'CH1234', years: 5, limit: 3 } },
      res,
    );
    expect(req().url).toBe(`${RES_API_BASE_URL}/score/similoo`);
    expect(req().method).toBe('POST');
    expect(req().headers.get('token')).toBe(SUITE_TOKEN);
    expect(await req().text()).toBe(
      JSON.stringify({ egrid: 'CH1234', years: 5, limit: 3 }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ results: [] });
  });

  it('defaults years/limit and rejects a missing egrid without calling RES', async () => {
    const req = mockFetch(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = mockRes();
    await (similooHandler as Handler)({ method: 'POST', body: { egrid: 'CH1' } }, res);
    expect(await req().text()).toBe(
      JSON.stringify({ egrid: 'CH1', years: 10, limit: 12 }),
    );

    vi.restoreAllMocks();
    const spy = vi.spyOn(globalThis, 'fetch');
    const res2 = mockRes();
    await (similooHandler as Handler)({ method: 'POST', body: {} }, res2);
    expect(res2.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});
