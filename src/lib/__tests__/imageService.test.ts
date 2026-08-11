// imageService.test — behavior-parity checks for the shared-typed-client
// migration of the browser image service (`/image/swissnovo/*`).
//
// The suite runs in a plain Node environment, so the shared package (which
// pulls browser-only auth machinery) is replaced wholesale with a mock
// userManager; `@aireon/shared/api` itself stays REAL so the wire shape the
// typed client produces is what gets asserted.

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@aireon/shared', () => ({
  userManager: {
    getUser: vi.fn(),
  },
}));

import { userManager } from '@aireon/shared';
import { uploadImage, listImages, deleteImage, APP_SOURCE } from '../imageService';

const getUser = userManager.getUser as ReturnType<typeof vi.fn>;

const signedIn = { expired: false, id_token: 'jwt-id-token', access_token: 'opaque' };

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  getUser.mockReset();
});

describe('auth gate', () => {
  it('signed-out callers throw before any request is made', async () => {
    getUser.mockResolvedValue(null);
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(listImages()).rejects.toThrow('Not authenticated');
    expect(spy).not.toHaveBeenCalled();
  });

  it('an expired session throws before any request is made', async () => {
    getUser.mockResolvedValue({ ...signedIn, expired: true });
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(deleteImage('x')).rejects.toThrow('Not authenticated');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('uploadImage', () => {
  it('POSTs multipart form data with the Bearer id_token', async () => {
    getUser.mockResolvedValue(signedIn);
    const saved = { id: 'img-1', app_source: APP_SOURCE };
    const req = mockFetch(jsonResponse(saved));

    const out = await uploadImage(new Blob(['png-bytes']), {
      filename: 'shot.png',
      prmId: 'prm-9',
      customMetadata: { zoom: 17 },
    });

    expect(req().url).toBe('https://res.zeroo.ch/image/swissnovo/upload');
    expect(req().method).toBe('POST');
    expect(req().headers.get('authorization')).toBe('Bearer jwt-id-token');
    // FormData passes through the client untouched; the runtime sets the
    // multipart boundary. (Assert part presence + size, not instanceof — the
    // round-trip re-wraps blobs cross-realm.)
    expect(req().headers.get('content-type')).toMatch(/^multipart\/form-data/);
    const fd = await req().formData();
    const file = fd.get('file') as { size: number } | null;
    expect(file).not.toBeNull();
    expect(file!.size).toBe('png-bytes'.length);
    expect(fd.get('app_source')).toBe(APP_SOURCE);
    expect(fd.get('prm_id')).toBe('prm-9');
    expect(fd.get('custom_metadata')).toBe(JSON.stringify({ zoom: 17 }));
    expect(out).toEqual(saved);
  });

  it('throws the upstream error body text on failure', async () => {
    getUser.mockResolvedValue(signedIn);
    mockFetch(jsonResponse({ error: 'too large' }, 413));
    await expect(uploadImage(new Blob(['x']))).rejects.toThrow(
      JSON.stringify({ error: 'too large' }),
    );
  });

  it('falls back to a status message when the error body is empty', async () => {
    getUser.mockResolvedValue(signedIn);
    mockFetch(new Response('', { status: 500 }));
    await expect(uploadImage(new Blob(['x']))).rejects.toThrow('Upload failed: 500');
  });
});

describe('listImages', () => {
  it('GETs the list with only-when-set query filters', async () => {
    getUser.mockResolvedValue(signedIn);
    const req = mockFetch(jsonResponse([]));
    await listImages({ appSource: 'similoo' });
    const url = new URL(req().url);
    expect(url.origin + url.pathname).toBe('https://res.zeroo.ch/image/swissnovo/list');
    expect(url.searchParams.get('app_source')).toBe('similoo');
    expect(url.searchParams.has('prm_id')).toBe(false);
    expect(req().headers.get('authorization')).toBe('Bearer jwt-id-token');
  });
});

describe('deleteImage', () => {
  it('DELETEs by id with the Bearer id_token', async () => {
    getUser.mockResolvedValue(signedIn);
    const req = mockFetch(jsonResponse({ ok: true }));
    await deleteImage('img-7');
    expect(req().url).toBe('https://res.zeroo.ch/image/swissnovo/img-7');
    expect(req().method).toBe('DELETE');
    expect(req().headers.get('authorization')).toBe('Bearer jwt-id-token');
  });
});
