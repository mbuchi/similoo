// Track Parcel — wires the comparison sidebar's target parcel to the
// suite PRM (Parcel Registry Management) backend.
//
// Ported from similoo-three's `src/js/three/saveParcelButton.js`, upgraded
// to the suite's track/untrack TOGGLE: clicking "Track" creates a PRM
// record (it then shows in proom + every app's saved-parcels list), and
// clicking again while "Tracked" deletes that record. All three PRM
// helpers come from `@aireon/shared` and hit res.zeroo.ch.
//
// Auth: PRM endpoints require a Zitadel token. similoo's engine no longer
// runs the imperative cesium-app auth (the React shell owns sign-in via
// the shared <AuthProvider>), but both read the SAME oidc-client-ts
// `userManager` store, so the vanilla `getAuthToken()` helper resolves the
// signed-in user's token here without any React coupling. Signed-out
// users see the button as a "Sign in to track" CTA; clicking dispatches
// `similoo:login`, which App.tsx forwards to the shared login modal —
// the same window-event bridge the search box uses.

import {
    fetchPrmByParcel,
    createPrmRecord,
    deletePrmRecord,
    getAuthToken,
    userManager,
} from '@aireon/shared';
import { t, onLocaleChange } from '../i18n.js';

export function createSaveParcelButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmp-track';
    btn.innerHTML = `
        <span class="cmp-track-icon"></span>
        <span class="cmp-track-label"></span>
    `;

    const iconEl = btn.querySelector('.cmp-track-icon');
    const labelEl = btn.querySelector('.cmp-track-label');

    // parcel = { id, label, municipality, area, lng, lat } — id is the EGRID.
    let currentParcel = null;
    let currentRecord = null; // PrmRecord when tracked (its id drives untrack)
    let currentState = 'idle'; // idle | checking | saving | unsaving | saved | auth | error
    let refreshSeq = 0;

    render();
    btn.addEventListener('click', handleClick);

    const unlinkLocale = onLocaleChange(render);

    // Re-resolve the tracked state when the OIDC session changes. The shared
    // userManager events fire on sign-in callback completion and sign-out —
    // the vanilla equivalent of similoo-three's onAuthChange subscription.
    const onUserChange = () => {
        if (currentParcel) refreshState();
        else setState('idle');
    };
    userManager.events.addUserLoaded(onUserChange);
    userManager.events.addUserUnloaded(onUserChange);

    function setState(next) {
        currentState = next;
        render();
    }

    function render() {
        btn.dataset.state = currentState;
        btn.hidden = !currentParcel;
        const saved = currentState === 'saved';
        const busy = currentState === 'saving' || currentState === 'unsaving' || currentState === 'checking';
        btn.disabled = busy;
        btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
        if (iconEl) iconEl.innerHTML = saved ? bookmarkCheckIcon() : bookmarkIcon();
        let key = 'comparison.track';
        if (currentState === 'saving') key = 'comparison.track_saving';
        else if (currentState === 'unsaving') key = 'comparison.track_unsaving';
        else if (saved) key = 'comparison.tracked';
        else if (currentState === 'auth') key = 'comparison.track_sign_in';
        else if (currentState === 'error') key = 'comparison.track_error';
        if (labelEl) labelEl.textContent = t(key);
        const title = saved ? t('comparison.untrack_title') : t('comparison.track_title');
        btn.title = title;
        btn.setAttribute('aria-label', title);
    }

    async function refreshState() {
        const parcel = currentParcel;
        if (!parcel?.id) {
            currentRecord = null;
            setState('idle');
            return;
        }
        const seq = ++refreshSeq;
        setState('checking');
        try {
            const token = await getAuthToken();
            if (seq !== refreshSeq) return;
            if (!token) {
                currentRecord = null;
                setState('auth');
                return;
            }
            const existing = await fetchPrmByParcel(token, parcel.id);
            if (seq !== refreshSeq) return;
            currentRecord = existing || null;
            setState(existing ? 'saved' : 'idle');
        } catch (err) {
            if (seq !== refreshSeq) return;
            // Anonymous users get AuthRequiredError; everything else is a
            // transient PRM hiccup or simply "no record". Treat both as
            // actionable so the button stays useful.
            currentRecord = null;
            setState(err?.name === 'AuthRequiredError' ? 'auth' : 'idle');
        }
    }

    async function handleClick() {
        if (!currentParcel?.id) return;
        if (currentState === 'saving' || currentState === 'unsaving' || currentState === 'checking') return;

        const token = await getAuthToken();
        if (!token) {
            // Hand off to the React shell's shared login modal; after the
            // OIDC redirect round-trip the page reloads signed in.
            window.dispatchEvent(new CustomEvent('similoo:login'));
            return;
        }

        if (currentState === 'saved' && currentRecord?.id) {
            await untrack(token);
        } else {
            await track(token);
        }
    }

    async function track(token) {
        const parcel = currentParcel;
        setState('saving');
        try {
            const record = await createPrmRecord(token, {
                parcel_id: parcel.id,
                parcel_label: parcel.label || parcel.id,
                parcel_municipality: parcel.municipality || '',
                parcel_area: Number.isFinite(parcel.area) ? parcel.area : 0,
                parcel_lng: Number.isFinite(parcel.lng) ? parcel.lng : 0,
                parcel_lat: Number.isFinite(parcel.lat) ? parcel.lat : 0,
            });
            if (parcel !== currentParcel) return;
            currentRecord = record;
            setState('saved');
        } catch (err) {
            console.warn('PRM save failed', err);
            if (parcel !== currentParcel) return;
            setState(err?.name === 'AuthRequiredError' ? 'auth' : 'error');
        }
    }

    async function untrack(token) {
        const parcel = currentParcel;
        setState('unsaving');
        try {
            await deletePrmRecord(token, currentRecord.id);
            if (parcel !== currentParcel) return;
            currentRecord = null;
            setState('idle');
        } catch (err) {
            console.warn('PRM untrack failed', err);
            if (parcel !== currentParcel) return;
            setState(err?.name === 'AuthRequiredError' ? 'auth' : 'error');
        }
    }

    function setParcel(parcel) {
        if (!parcel?.id) {
            currentParcel = null;
            currentRecord = null;
            refreshSeq += 1; // cancel any in-flight refresh
            setState('idle');
            return;
        }
        // Same parcel re-rendered (copy-chip reset, filter refetch) — keep the
        // resolved tracked state instead of re-hitting PRM.
        if (currentParcel?.id === parcel.id) {
            currentParcel = parcel;
            render();
            return;
        }
        currentParcel = parcel;
        currentRecord = null;
        refreshState();
    }

    function destroy() {
        try { unlinkLocale?.(); } catch { /* already gone */ }
        try {
            userManager.events.removeUserLoaded(onUserChange);
            userManager.events.removeUserUnloaded(onUserChange);
        } catch { /* already gone */ }
        btn.remove();
    }

    return { root: btn, setParcel, destroy };
}

function bookmarkIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>';
}

function bookmarkCheckIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/><path d="m9 10 2 2 4-4"/></svg>';
}
