import { userManager } from '../auth/authConfig.js';

const API_BASE = 'https://res.zeroo.ch/image/swissnovo';
export const APP_SOURCE = 'similoo';

// Human-readable labels for each app_source value. Add new apps here as
// the screenshot feature rolls out.
export const APP_LABELS = {
    roofs: 'Roofs',
    geopool: 'GeoPool',
    taxoo: 'Taxoo',
    hood: 'Hood',
    roots: 'Roots',
    similoo: 'Similoo',
};

// Mirrors the ScreenshotMetadata schema written by roofs so screenshots
// from every app share the same shape. Extra fields are allowed — the
// display logic falls back to a generic key/value list for anything it
// doesn't recognise.

async function getAuthToken() {
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

export async function uploadImage(blob, options = {}) {
    const token = await getAuthToken();
    const fd = new FormData();
    fd.append('file', blob, options.filename || `screenshot-${Date.now()}.png`);
    fd.append('app_source', APP_SOURCE);
    if (options.prmId) fd.append('prm_id', options.prmId);
    if (options.customMetadata) fd.append('custom_metadata', JSON.stringify(options.customMetadata));

    let res;
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
    return res.json();
}

export async function listImages(filters = {}) {
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
    return res.json();
}

export async function deleteImage(id) {
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
