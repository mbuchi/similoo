// Address precedence for a deep-linked pick.
//
// > COORDINATES AND PARCEL IDS ARE IDENTITY. TEXT IS A HINT.
//   (aireon-shared/docs/URL_PARAMS_STANDARD.md, "Address precedence")
//
// A link can describe one place twice, and the two descriptions can disagree:
//
//   ?lat=47.521503&lng=8.583285&label=Alte+Rheinstrasse+87,+8424+Embrach
//
// Those coordinates are on Embrach parcel CH813872487780, whose address is
// "Alte Rheinstrasse 91". The text is a snapshot taken by whatever minted the
// link: it goes stale as address resolution improves, it survives every
// hand-edit of the coordinates, and rendering it verbatim used to pin the wrong
// number onto the parcel identity header, the PRM save record and the navbar —
// permanently, because the label was also fed straight back into the URL.
//
// So the text is only a placeholder that keeps those surfaces from flashing
// blank. The identity decides, and the resolved answer is written back so the
// link heals itself on first load.
//
// Two similoo specifics live here:
//
//   • similoo mints its own `?label`, while the shared address search and the
//     shared map context menu write the canonical `?q`. Reading only `label`
//     meant a `q` refreshed by the context menu's own EGRID lookup never
//     reached the display and a stale `label` won. Both keys are read here, and
//     the writer below publishes `q` while clearing `label`, so a link similoo
//     mints can never carry two disagreeing spellings of its own label.
//   • similoo has no forward geocoder in the engine (address entry is the
//     shared React AddressSearch), so a bare `?q=` with no coordinates has
//     nothing to resolve. `authoritative` is reported for completeness and for
//     the day one is wired.

import { getDeepLinkAddress, getUrlState } from '@aireon/shared/url-params';
import { resolveAddressAtPoint } from '@aireon/shared/geoadmin';

/**
 * What the URL says the opened place is called, and how much of that to trust.
 *
 * @returns {{ hint: string | null, authoritative: boolean }}
 *   `hint` is safe to display IMMEDIATELY. `authoritative` is true only when the
 *   text is the ONLY thing in the URL describing a location — with `?lat/?lng`,
 *   `?egrid` or `?parcel_id` present it is false and the caller MUST overwrite
 *   the hint with {@link resolveDeepLinkLabel}.
 */
export function readDeepLinkAddress() {
    const shared = getDeepLinkAddress();
    let local = null;
    try {
        local = new URLSearchParams(window.location.search).get('label');
    } catch { /* no window (SSR / unit host) — the shared hint still stands */ }
    const hint = (typeof local === 'string' && local.trim()) || shared.hint || null;
    if (!hint) return { hint: null, authoritative: false };
    const s = getUrlState();
    const hasIdentity =
        (s.lat !== null && s.lng !== null) || s.egrid !== null || s.parcelId !== null;
    return { hint, authoritative: !hasIdentity };
}

/**
 * The address of the parcel the deep link actually points at.
 *
 * Prefers the EGRID the pick already resolved (the parcel tile's `parcel_id`),
 * which makes the answer a pure function of the parcel rather than of the point;
 * with no EGRID the shared helper identifies the parcel under the coordinate
 * itself and only falls back to the nearest address where there is genuinely no
 * parcel to ask. Never throws: resolves null when nothing could be determined,
 * and the caller then keeps whatever the URL offered.
 *
 * @param {{ egrid?: string | number | null, lat: number, lng: number, signal?: AbortSignal }} options
 * @returns {Promise<string | null>}
 */
export async function resolveDeepLinkLabel({ egrid = null, lat, lng, signal } = {}) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    try {
        const resolved = await resolveAddressAtPoint(lat, lng, { egrid, signal });
        return resolved?.label || null;
    } catch {
        return null;
    }
}

/**
 * The `extra` params that publish a label, in one place so every writer agrees.
 *
 * `q` is the canonical suite key; `label` is similoo's legacy spelling, kept
 * readable above but always cleared on write so an old value can never outlive
 * the one that replaced it.
 *
 * @param {string | null | undefined} label
 * @returns {{ q: string | null, label: null }}
 */
export function deepLinkLabelExtra(label) {
    return { q: label || null, label: null };
}
