// The single writer for "the user has confirmed WHICH parcel this is".
//
// similoo already put the picked COORDINATES in the address bar, so a copied
// link reopened a comparison near the right place. What it never wrote was the
// parcel's IDENTITY. The address bar therefore could not name the parcel on
// screen, and the navbar's "Share this view" button — which copies
// `window.location.href` verbatim — shared a bare camera position with the
// parcel dropped.
//
// Selecting a parcel is a location CONFIRMATION and owes the URL the same
// identity a navbar search or a right-click "load location" writes
// (URL_PARAMS_STANDARD.md, "Address precedence"): the coordinates, the parcel's
// EGRID, and the parcel's OWN address as the label. The canonical shared writer
// `updateConfirmedLocationUrl` does all of it — it publishes `q`, drops the
// competing `address`/`EGRID` alias spellings, clears identifiers that no longer
// describe the confirmation, preserves every unrelated param (theme, lang,
// opacity, the quiet-boot flags) and uses `replaceState` so repeated picks do
// not turn Back into a replay stack.
//
// Never hand-roll `URLSearchParams` + `history.replaceState` here: the shared
// writer is also what stamps `history.state.aireonSelfWritten`, and similoo's
// deep-link bootstrap reads that marker to tell a zoom it wrote itself (used
// raw) from a zoom that arrived from outside (floored at DEEP_LINK_MIN_ZOOM).

import { updateConfirmedLocationUrl, updateMapUrl } from '@aireon/shared/url-params';
import { deepLinkLabelExtra } from './deepLinkAddress.js';

/**
 * True when the current URL still carries similoo's legacy `?label` key.
 *
 * The shared writer clears the suite's `address` alias but knows nothing about
 * similoo's own older spelling, and `readDeepLinkAddress()` PREFERS `label`
 * over `q` — so a stale one left behind would outlive the value that replaced
 * it. A pure read: the removal itself still goes through the shared writer.
 */
function hasLegacyLabelParam() {
    try {
        return new URLSearchParams(window.location.search).has('label');
    } catch {
        return false;
    }
}

/**
 * Stamp a confirmed parcel into the address bar.
 *
 * `label` must be the PARCEL's own address (the tile's, or the one
 * `resolveDeepLinkLabel` resolves from the EGRID) and never a coordinate
 * reverse geocode, which returns whichever feature geo.admin ranks first within
 * ~20 m and so relabels a parcel with its neighbour's address
 * (PARCEL_ADDRESS_STANDARD.md). With no parcel-sourced label, pass null.
 *
 * A null `label`/`egrid` DELETES that param, which is exactly what the camera
 * write-back wants once the map has flown off the picked point: coordinates
 * that no longer name the confirmed parcel must not keep its identity glued to
 * them.
 *
 * `select` says whether the comparison panel is open, and similoo — not the
 * shared writer — is the one that knows. Left alone, `updateConfirmedLocationUrl`
 * INFERS it from the identity it was handed (@aireon/shared v1.185.0+): something
 * to name means `select=parcel`, nothing at all means `select=off`. That
 * inference is wrong for two of this app's three writers, because both hand it a
 * null identity while the panel is very much open:
 *
 *   • the moveend camera write-back, which drops the label and the EGRID the
 *     moment the camera leaves the point they describe. Panning is not a
 *     deselect, so it must leave `select` exactly as it found it.
 *   • the first of syncDeepLink's writes, fired before the parcel tile has been
 *     probed, when a bare `?lat/?lng` link has no address and no EGRID yet.
 *
 * So the default here is `null` — "do not touch the param" — and the only way to
 * write `off` is {@link clearConfirmedParcelUrl}, the one real deselect. Writing
 * `parcel` stays an explicit act of the pick path.
 *
 * @param {{ lat: number, lng: number, zoom?: number, label?: string | null, egrid?: string | null, select?: 'parcel' | 'off' | null }} opts
 */
export function stampConfirmedParcelUrl({ lat, lng, zoom, label = null, egrid = null, select = null }) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    updateConfirmedLocationUrl({
        lat,
        lng,
        zoom,
        query: label || null,
        egrid: egrid || null,
        // similoo never deep-links by an app-local parcel id; clearing it keeps
        // an inbound `?parcel_id=` from outliving the parcel it named.
        parcelId: null,
        select,
    });
    // Second (and only when there is something to remove) so an old link's
    // `?label` cannot survive the value that replaced it. `deepLinkLabelExtra`
    // stays the one place that knows the legacy key exists.
    if (hasLegacyLabelParam()) {
        updateMapUrl({ lat, lng, zoom, extra: deepLinkLabelExtra(label || null) });
    }
}

/**
 * Undo {@link stampConfirmedParcelUrl} when the comparison panel is dismissed.
 *
 * Without this the URL keeps claiming a parcel that is no longer on screen and
 * "Share this view" keeps sharing it. The camera stays — that is still what the
 * user is looking at — and only the identity the selection contributed is
 * dropped.
 *
 * This is the ONE writer allowed to say `select=off`. The identity going out of
 * the URL is not by itself a deselect (the camera write-back drops it on every
 * pan), so the closed panel has to be stated outright, and stated here: a
 * reloaded link that says `off` is the visitor's dismissal surviving the reload.
 *
 * @param {{ lat: number, lng: number, zoom?: number }} camera
 */
export function clearConfirmedParcelUrl({ lat, lng, zoom }) {
    stampConfirmedParcelUrl({ lat, lng, zoom, label: null, egrid: null, select: 'off' });
}
