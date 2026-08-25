// Comparable map popup — the data card pinned to a comparable parcel after a
// list-card fly-to.
//
// Clicking a comparable card deliberately keeps the sidebar on the SUBJECT
// parcel (the comparison never switches subject) and only flies the camera to
// the comparable. Until now nothing at the destination said which parcel the
// camera landed on or what its numbers were — the data stayed in the list,
// 400px away. This popup is that missing label: a compact card anchored to the
// comparable's coordinate repeating the list card's facts, plus a hand-off
// link that opens the parcel in geopool (the suite's full parcel view).
//
// It is a vanilla maplibregl.Popup fed static HTML via setHTML — deliberately
// NOT the React-portal pattern, whose empty-container content measures 0x0 at
// addTo time and mis-anchors the finished card (the suite popup trap). Static
// HTML has its real size the moment MapLibre places it.

import * as maplibregl from 'maplibre-gl';
import { buildDeepLink } from '@aireon/shared';
// The one zone label per parcel (PARCEL_ZONE_STANDARD.md): the municipal
// designation, through the shared resolver's fallback chain — never a raw
// column read here.
import { resolveZoneLabel } from '@aireon/shared/parcel-zone';
import { t, onLocaleChange } from '../i18n.js';
import {
    dataPillHtml,
    escapeHtml,
    formatM,
    formatM2,
    formatM3,
    formatPct,
    formatRatio,
} from './format.js';

// Deep link that opens the comparable in geopool with the parcel SELECTED
// (URL_PARAMS_STANDARD.md, "Open with the parcel selected"): an external
// ?lat/?lng link auto-selects by default, and carrying ?egrid= pins the
// identity so the hit-test can never adopt a neighboring polygon. The shared
// builder owns the host and the zoom-17 floor the cross-app handoff needs.
export function geopoolComparableUrl(c) {
    const base = buildDeepLink('geopool', c.lat, c.lng);
    return c.egrid ? `${base}&egrid=${encodeURIComponent(c.egrid)}` : base;
}

// Lucide "x" and "external-link" paths, inlined the same way the sidebar
// inlines its point-cloud icon (this module renders HTML strings, not React).
const CLOSE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const OPEN_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';

// Pure HTML builder, exported for tests. Address-first identity (the suite
// context-menu/identity rule): the human-readable address leads when the
// backend row carries one, the EGRID drops to the sub-line; with no address
// the EGRID is the title. The pills repeat the list card's fields through the
// same formatters, so the two surfaces can never disagree on a number.
export function comparablePopupHtml(c) {
    const address = typeof c.address === 'string' ? c.address.trim() : '';
    const egrid = typeof c.egrid === 'string' ? c.egrid.trim() : '';
    const title = address || egrid
        || `${Number(c.lat).toFixed(5)}, ${Number(c.lng).toFixed(5)}`;
    const zone = resolveZoneLabel(c) || '';

    const subParts = [];
    if (address && egrid) subParts.push(`<span class="cmp-popup-egrid">${escapeHtml(egrid)}</span>`);
    if (zone) subParts.push(`<span class="cmp-popup-zone">${escapeHtml(zone)}</span>`);

    const pills = [
        // The score leads (it is why this parcel is on the list) and is the
        // one emphasized pill; every bare number carries a visible label per
        // DATA_PILLS_STANDARD.md R4.
        {
            label: t('comparison.metric_similarity_short'),
            value: Number.isFinite(c.similarity_score) ? formatPct(c.similarity_score) : null,
            emphasis: true,
        },
        {
            label: t('comparison.metric_ratiov'),
            value: Number.isFinite(c.ratioV) ? formatRatio(c.ratioV) : null,
            mono: true,
        },
        {
            value: Number.isFinite(c.parcel_area_m2) ? formatM2(c.parcel_area_m2) : null,
            title: t('comparison.metric_parcel_size'),
        },
        {
            value: Number.isFinite(c.building_volume_m3) ? formatM3(c.building_volume_m3) : null,
            title: t('comparison.metric_volume'),
        },
        {
            value: Number.isFinite(c.height_m) ? formatM(c.height_m) : null,
            title: t('comparison.metric_height'),
        },
        {
            label: t('comparison.metric_floors_short'),
            value: Number.isFinite(c.floors) ? String(c.floors) : null,
        },
        {
            label: t('comparison.metric_year'),
            value: Number.isFinite(c.construction_year) ? String(c.construction_year) : null,
        },
    ].map(dataPillHtml).filter(Boolean).join('');

    return `
        <article class="cmp-popup-card" aria-label="${escapeHtml(t('comparison.card_aria', { egrid }))}">
            <header class="cmp-popup-head">
                <h3 class="cmp-popup-title"${address ? '' : ' style="font-family: ui-monospace, monospace;"'}>${escapeHtml(title)}</h3>
                <button class="cmp-popup-close" type="button" aria-label="${escapeHtml(t('comparison.popup_close'))}">${CLOSE_ICON}</button>
            </header>
            ${subParts.length ? `<div class="cmp-popup-sub">${subParts.join('<span class="cmp-popup-dot" aria-hidden="true">·</span>')}</div>` : ''}
            ${pills ? `<div class="aireon-datapill-row cmp-popup-pills">${pills}</div>` : ''}
            <a class="cmp-popup-open" href="${escapeHtml(geopoolComparableUrl(c))}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('comparison.popup_open_geopool'))}${OPEN_ICON}</a>
        </article>
    `;
}

// One popup instance per app, owned by main.js next to the other map
// treatments. `getMap` is a live getter because the MapLibre instance is
// created asynchronously after boot.
export function createComparablePopup(getMap) {
    let popup = null;
    let current = null;

    function bindContent(p) {
        const el = p.getElement();
        if (!el) return;
        // Transient selection chrome, like the hover beacon — excluded from
        // the "Save image" map capture.
        el.setAttribute('data-screenshot-ignore', 'true');
        el.querySelector('.cmp-popup-close')?.addEventListener('click', hide);
    }

    // Keep an open popup in the visitor's language: the sidebar relabels
    // itself on locale flips, and a stale-language card next to it would read
    // as broken.
    const offLocale = onLocaleChange(() => {
        if (!popup || !current) return;
        popup.setHTML(comparablePopupHtml(current));
        bindContent(popup);
    });

    function show(c) {
        const map = getMap();
        if (!map || !c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
        hide();
        current = c;
        const p = new maplibregl.Popup({
            // The card brings its own suite-styled close chip; MapLibre's
            // default button cannot be styled into the header row.
            closeButton: false,
            // Clicking the basemap dismisses, matching a tooltip's feel.
            closeOnClick: true,
            // Don't steal focus from the sidebar list: a keyboard user
            // arrowing through cards fires a fly-to per card, and yanking
            // focus to the map on each one would break the traversal.
            focusAfterOpen: false,
            // Fixed anchor: auto-anchoring computes from the projected point,
            // which mid-fly can sit anywhere; a stable above-the-parcel card
            // is calmer than one that flips sides depending on camera timing.
            anchor: 'bottom',
            offset: 14,
            maxWidth: '300px',
            className: 'cmp-popup',
        });
        popup = p;
        p.setLngLat([c.lng, c.lat]);
        p.setHTML(comparablePopupHtml(c));
        // closeOnClick dismissals and our own remove() both land here; only
        // forget state if this popup is still the live one (show() may already
        // have replaced it).
        p.on('close', () => {
            if (popup === p) {
                popup = null;
                current = null;
            }
        });
        p.addTo(map);
        bindContent(p);
    }

    function hide() {
        const p = popup;
        popup = null;
        current = null;
        if (p) {
            try { p.remove(); } catch { /* map may be mid-teardown */ }
        }
    }

    function destroy() {
        offLocale();
        hide();
    }

    return { show, hide, destroy };
}
