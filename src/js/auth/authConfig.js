import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const ORIGIN = window.location.origin;
const PATH = window.location.pathname.replace(/[^/]*$/, '') || '/';
const APP_URL = `${ORIGIN}${PATH}`;

export const oidcSettings = {
    authority: 'https://swissnovo-ekqvxs.ch1.zitadel.cloud',
    client_id: '366334583324661156',
    redirect_uri: APP_URL,
    post_logout_redirect_uri: APP_URL,
    response_type: 'code',
    scope: 'openid profile email',
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    stateStore: new WebStorageStateStore({ store: window.localStorage }),
    loadUserInfo: true,
    automaticSilentRenew: false,
    monitorSession: false,
    revokeTokensOnSignout: true,
};

export const userManager = new UserManager(oidcSettings);

export const PROFILE_API_BASE = 'https://res.zeroo.ch';
export const DICEBEAR_URL = (seed) =>
    `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(seed || 'default')}`;
