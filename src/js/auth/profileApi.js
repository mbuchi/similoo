import { PROFILE_API_BASE } from './authConfig.js';
import { getAccessToken } from './authManager.js';

const PROFILE_PATH = '/res_api/swissnovo_user/profile';

async function authHeaders(extra = {}) {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...extra,
    };
}

export async function getProfile() {
    const res = await fetch(`${PROFILE_API_BASE}${PROFILE_PATH}`, {
        method: 'GET',
        headers: await authHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
    return res.json();
}

export async function updateProfile(payload) {
    const res = await fetch(`${PROFILE_API_BASE}${PROFILE_PATH}`, {
        method: 'PUT',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Profile update failed: ${res.status}`);
    return res.json().catch(() => ({}));
}
