/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

// The module under test only needs maplibregl.Popup at createComparablePopup
// time; the pure HTML/URL builders never touch it.
vi.mock('maplibre-gl', () => ({ Popup: class FakePopup {} }));

import { comparablePopupHtml, geopoolComparableUrl } from './comparablePopup.js';

const comparable = {
    egrid: 'CH123456789012',
    lat: 47.376888,
    lng: 8.541694,
    address: 'Bahnhofstrasse 1, 8001 Zurich',
    similarity_score: 0.87,
    ratioV: 1.85,
    parcel_area_m2: 746,
    building_volume_m3: 2031,
    height_m: 9.4,
    floors: 3,
    construction_year: 1994,
    cz_local: 'Wohnzone 2',
};

describe('geopoolComparableUrl', () => {
    it('builds the shared geopool deep link with the EGRID pinned', () => {
        const url = geopoolComparableUrl(comparable);
        expect(url).toBe(
            'https://geopool.aireon.ch/?lat=47.376888&lng=8.541694&zoom=17.00&egrid=CH123456789012',
        );
    });

    it('omits the egrid param when the comparable has none', () => {
        const url = geopoolComparableUrl({ ...comparable, egrid: undefined });
        expect(url).toBe('https://geopool.aireon.ch/?lat=47.376888&lng=8.541694&zoom=17.00');
        expect(url).not.toContain('egrid');
    });
});

describe('comparablePopupHtml', () => {
    it('leads with the address and drops the EGRID to the sub-line', () => {
        const html = comparablePopupHtml(comparable);
        const titleAt = html.indexOf('Bahnhofstrasse 1, 8001 Zurich');
        // The EGRID also appears earlier inside the aria-label; the visible
        // copy must sit in the sub-line span, after the address title.
        const egridAt = html.indexOf('<span class="cmp-popup-egrid">CH123456789012</span>');
        expect(titleAt).toBeGreaterThan(-1);
        expect(egridAt).toBeGreaterThan(titleAt);
    });

    it('falls back to the EGRID as the title when there is no address', () => {
        const html = comparablePopupHtml({ ...comparable, address: undefined });
        expect(html).toContain('<h3 class="cmp-popup-title"');
        expect(html).toContain('CH123456789012</h3>');
    });

    it('prints the card metrics through the shared formatters', () => {
        const html = comparablePopupHtml(comparable);
        expect(html).toContain('87%');
        expect(html).toContain('1.85');
        expect(html).toContain('746 m²');
        // en-CH digit grouping is the Swiss apostrophe (U+2019), same as the
        // sidebar cards have always printed.
        expect(html).toContain('2’031 m³');
        expect(html).toContain('9.4 m');
        expect(html).toContain('1994');
        expect(html).toContain('Wohnzone 2');
    });

    it('drops pills for missing metrics instead of printing placeholders', () => {
        const html = comparablePopupHtml({
            egrid: 'CH123456789012',
            lat: 47.376888,
            lng: 8.541694,
        });
        expect(html).not.toContain('undefined');
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('aireon-datapill-row');
    });

    it('links to geopool in a new tab without an opener', () => {
        const html = comparablePopupHtml(comparable);
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
        expect(html).toContain(
            'href="https://geopool.aireon.ch/?lat=47.376888&amp;lng=8.541694&amp;zoom=17.00&amp;egrid=CH123456789012"',
        );
    });

    it('escapes HTML in backend-provided fields', () => {
        const html = comparablePopupHtml({
            ...comparable,
            address: '<img src=x onerror=alert(1)>',
            cz_local: '"quoted" & <zone>',
        });
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).not.toContain('<zone>');
    });
});
