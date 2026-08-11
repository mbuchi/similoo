// Typed client for the suite-wide `/image/swissnovo/*` upload/list/delete
// endpoints on res.zeroo.ch, built on the shared RES API client
// (@aireon/shared/api — openapi-fetch over the generated OpenAPI contract).
//
// Auth is the user's Zitadel JWT (id_token), not the access_token —
// project_RES decodes the JWT payload to read `sub` and the access_token may
// be opaque depending on token-type configuration. The token is attached
// PER REQUEST (never at client construction): it rotates with the session,
// and signed-out callers must keep failing in `getAuthToken` before any
// request is made.

import { userManager } from '@aireon/shared';
import { createResApiClient } from '@aireon/shared/api';

export const APP_SOURCE = 'similoo';

// Unauthenticated client against the production RES host (the client's
// default base URL); every call adds its own Authorization header.
const api = createResApiClient({
  // Resolve fetch at call time (not module-load time) so test mocks and
  // late-installed fetch polyfills are honored.
  fetch: (input, init) => globalThis.fetch(input, init),
});

export interface SavedImage {
  id: string;
  user_id: string;
  prm_id: string | null;
  app_source: string;
  original_filename: string;
  file_path: string;
  public_url: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  custom_metadata: ScreenshotMetadata | null;
  created_at: string;
  updated_at: string;
}

// Shared metadata schema across every app that integrates this feature.
// Extra fields are allowed so apps can store flexible context without a
// schema change — display logic falls back to a generic key/value list.
export interface ScreenshotMetadata {
  url?: string;
  viewport?: { width: number; height: number };
  captured_at?: string;
  central_lat?: number;
  central_lng?: number;
  central_parcel_id?: string | null;
  tilt_degree?: number;
  bearing_degree?: number;
  zoom?: number;
  address?: string | null;
  basemap?: string;
  is_3d_mode?: boolean;
  [key: string]: unknown;
}

// Human-readable labels for each app_source value. Add new apps here as the
// screenshot feature rolls out.
export const APP_LABELS: Record<string, string> = {
  roofs: 'Roofs',
  valoo: 'Valoo',
  geopool: 'GeoPool',
  similoo: 'Similoo',
};

export interface UploadOptions {
  filename?: string;
  prmId?: string;
  customMetadata?: ScreenshotMetadata;
}

export interface ListFilters {
  appSource?: string;
  prmId?: string;
}

// project_RES decodes the bearer token's payload to read `sub` — it requires
// a JWT. Zitadel's access_token can be opaque depending on the app's Auth
// Token Type, but the id_token is always a JWT (RFC 7519) under the
// openid+profile+email scope.
async function getAuthToken(): Promise<string> {
  const user = await userManager.getUser();
  if (!user || user.expired) {
    throw new Error('Not authenticated');
  }
  const token = user.id_token || user.access_token;
  if (!token) {
    throw new Error('Not authenticated');
  }
  return token;
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** The error body as message text — mirrors the old `res.text()` throw. */
function errorText(error: unknown): string {
  if (error === undefined || error === null) return '';
  return typeof error === 'string' ? error : JSON.stringify(error);
}

export async function uploadImage(blob: Blob, options: UploadOptions = {}): Promise<SavedImage> {
  const token = await getAuthToken();
  const fd = new FormData();
  fd.append('file', blob, options.filename || `screenshot-${Date.now()}.png`);
  fd.append('app_source', APP_SOURCE);
  if (options.prmId) fd.append('prm_id', options.prmId);
  if (options.customMetadata) fd.append('custom_metadata', JSON.stringify(options.customMetadata));

  const result = await api
    .POST('/image/swissnovo/upload', {
      headers: authHeader(token),
      // The endpoint takes multipart/form-data; openapi-fetch's default body
      // serializer passes a FormData instance through untouched (and lets the
      // browser set the boundary), so the cast only bridges the generated
      // schema type, not the wire format.
      body: fd as unknown as { file: string; app_source: string },
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not reach the image server. This is usually a CORS or network issue. (${msg})`
      );
    });
  const { data, error, response } = result;
  if (!response.ok || data === undefined) {
    throw new Error(errorText(error) || `Upload failed: ${response.status}`);
  }
  return data as SavedImage;
}

export async function listImages(filters: ListFilters = {}): Promise<SavedImage[]> {
  const token = await getAuthToken();
  const { data, error, response } = await api.GET('/image/swissnovo/list', {
    headers: authHeader(token),
    params: {
      query: {
        // `undefined` values are dropped by the query serializer, matching
        // the old "append only when set" behavior.
        app_source: filters.appSource || undefined,
        prm_id: filters.prmId || undefined,
      },
    },
  });
  if (!response.ok || data === undefined) {
    throw new Error(errorText(error) || `List failed: ${response.status}`);
  }
  return data as SavedImage[];
}

export async function deleteImage(id: string): Promise<void> {
  const token = await getAuthToken();
  const { error, response } = await api.DELETE('/image/swissnovo/{id}', {
    headers: authHeader(token),
    params: { path: { id } },
  });
  if (!response.ok) {
    throw new Error(errorText(error) || `Delete failed: ${response.status}`);
  }
}
