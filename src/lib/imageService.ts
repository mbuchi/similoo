import { userManager } from '@aireon/shared';

const API_BASE = 'https://res.zeroo.ch/image/swissnovo';
export const APP_SOURCE = 'similoo';

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

// Parse a 2xx response body as JSON, turning a malformed/empty body (a 204,
// an HTML error page served with status 200, a proxy/CORS edge) into a clean,
// friendly error instead of the raw "Unexpected end of JSON input" SyntaxError
// that callers would otherwise surface verbatim in a toast.
async function parseJson<T>(res: Response, label: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`${label}: the server returned an unexpected response.`);
  }
}

export async function uploadImage(blob: Blob, options: UploadOptions = {}): Promise<SavedImage> {
  const token = await getAuthToken();
  const fd = new FormData();
  fd.append('file', blob, options.filename || `screenshot-${Date.now()}.png`);
  fd.append('app_source', APP_SOURCE);
  if (options.prmId) fd.append('prm_id', options.prmId);
  if (options.customMetadata) fd.append('custom_metadata', JSON.stringify(options.customMetadata));

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not reach the image server. This is usually a CORS or network issue. (${msg})`
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Upload failed: ${res.status}`);
  }
  return parseJson<SavedImage>(res, 'Upload failed');
}

export async function listImages(filters: ListFilters = {}): Promise<SavedImage[]> {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  if (filters.appSource) params.set('app_source', filters.appSource);
  if (filters.prmId) params.set('prm_id', filters.prmId);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/list${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `List failed: ${res.status}`);
  }
  return parseJson<SavedImage[]>(res, 'Could not load saved images');
}

export async function deleteImage(id: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Delete failed: ${res.status}`);
  }
}
