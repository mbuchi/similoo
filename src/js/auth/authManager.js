import { userManager } from './authConfig.js';

const AUTO_LOGIN_FLAG = 'auth.autoLoginAttempted';
const SIGNED_OUT_FLAG = 'auth.signedOut';

const listeners = new Set();
let currentUser = null;
let currentState = 'loading';

// oidc-client-ts network calls (OIDC metadata fetch, token exchange) have no
// timeout. If Zitadel is slow or its discovery endpoint is blocked, initAuth()
// never reaches a terminal state and the auth UI sits on 'loading' forever.
const DEATH_SWITCH_MS = 8000;
let deathSwitch = null;

function clearDeathSwitch() {
    if (deathSwitch !== null) {
        clearTimeout(deathSwitch);
        deathSwitch = null;
    }
}

function emit() {
    const payload = { state: currentState, user: currentUser };
    listeners.forEach((cb) => {
        try {
            cb(payload);
        } catch (e) {
            console.error('Auth listener error:', e);
        }
    });
}

function setAuthState(state, user = null) {
    if (state !== 'loading') clearDeathSwitch();
    currentState = state;
    currentUser = user;
    emit();
}

export function onAuthChange(cb) {
    listeners.add(cb);
    cb({ state: currentState, user: currentUser });
    return () => listeners.delete(cb);
}

export function getCurrentUser() {
    return currentUser;
}

export function getAuthState() {
    return currentState;
}

export function isAuthenticated() {
    return currentState === 'authenticated';
}

export async function getAccessToken() {
    const user = await userManager.getUser();
    if (!user || user.expired) return null;
    return user.access_token;
}

function isCallbackUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.has('code') && params.has('state');
}

function isErrorCallback() {
    const params = new URLSearchParams(window.location.search);
    return params.has('error');
}

function cleanUrl() {
    const cleanHref = window.location.origin + window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanHref);
}

export async function login() {
    sessionStorage.setItem(AUTO_LOGIN_FLAG, 'true');
    localStorage.removeItem(SIGNED_OUT_FLAG);
    try {
        await userManager.signinRedirect();
    } catch (e) {
        console.error('Login redirect failed:', e);
        setAuthState('unauthenticated', null);
    }
}

export async function logout() {
    localStorage.setItem(SIGNED_OUT_FLAG, 'true');
    sessionStorage.setItem(AUTO_LOGIN_FLAG, 'true');
    try {
        await userManager.signoutRedirect();
    } catch (e) {
        console.warn('Signout redirect failed, clearing local session:', e);
        try {
            await userManager.removeUser();
        } catch {}
        setAuthState('unauthenticated', null);
    }
}

export async function initAuth() {
    setAuthState('loading');

    // Guarantee the loading state always resolves: if no terminal state is
    // reached within 8 s (a hung metadata fetch or token exchange), release
    // the UI to 'unauthenticated' so the sign-in button appears. A late
    // success still self-corrects via the addUserLoaded listener below.
    clearDeathSwitch();
    deathSwitch = setTimeout(() => {
        deathSwitch = null;
        if (currentState === 'loading') {
            console.warn('Auth init exceeded 8 s — releasing loading state.');
            setAuthState('unauthenticated', null);
        }
    }, DEATH_SWITCH_MS);

    userManager.events.addUserLoaded((u) => setAuthState('authenticated', u));
    userManager.events.addUserUnloaded(() => setAuthState('unauthenticated', null));
    userManager.events.addAccessTokenExpired(async () => {
        try {
            await userManager.removeUser();
        } catch {}
        setAuthState('unauthenticated', null);
    });

    try {
        if (isCallbackUrl()) {
            try {
                const user = await userManager.signinRedirectCallback();
                cleanUrl();
                setAuthState('authenticated', user);
            } catch (e) {
                console.error('OIDC callback failed:', e);
                cleanUrl();
                setAuthState('unauthenticated', null);
            }
            return;
        }

        if (isErrorCallback()) {
            cleanUrl();
            setAuthState('unauthenticated', null);
            return;
        }

        const existing = await userManager.getUser();
        if (existing && !existing.expired) {
            setAuthState('authenticated', existing);
            return;
        }

        if (existing && existing.expired) {
            try {
                await userManager.removeUser();
            } catch {}
        }

        const autoTried = sessionStorage.getItem(AUTO_LOGIN_FLAG) === 'true';
        const signedOut = localStorage.getItem(SIGNED_OUT_FLAG) === 'true';

        if (!autoTried && !signedOut) {
            sessionStorage.setItem(AUTO_LOGIN_FLAG, 'true');
            try {
                await userManager.signinRedirect();
                return;
            } catch (e) {
                console.error('Auto-login redirect failed:', e);
            }
        }

        setAuthState('unauthenticated', null);
    } catch (e) {
        console.error('Auth init failed:', e);
        setAuthState('unauthenticated', null);
    }
}
