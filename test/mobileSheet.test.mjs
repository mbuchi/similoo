// Full-height parcel sheet contract — the Aireon mobile parcel-sheet standard
// (valoo reference; see valoo/src/__tests__/mobileUx.test.ts).
//
// On phones the Comparable Buildings sidebar must present as a bottom sheet
// that fills everything below the 3.5rem navbar, keeps the navbar visible and
// interactive (no backdrop/scrim), pads past the home-indicator inset, and
// offers a grab handle with drag-down-to-dismiss. similoo has no vitest; like
// the other contract suites this reads the shipped source files under
// `node --test` so a refactor that drops the sheet behaviour fails here
// instead of shipping.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('mobile sheet spans the full area below the 56px (3.5rem) navbar', () => {
    const css = read('css/comparison.css');
    const mobile = css.slice(css.indexOf('@media (max-width: 640px)'));
    assert.ok(mobile.length > 0, 'comparison.css has a max-width 640px mobile block');
    // Anchored under the navbar, full width; the base .cmp block supplies
    // position: fixed; right: 0; bottom: 0 which the mobile block inherits.
    assert.match(mobile, /top: 56px/);
    assert.match(mobile, /width: 100%/);
    assert.match(css, /position: fixed/);
    assert.match(css, /bottom: 0/);
});

test('sheet body clears the home-indicator inset', () => {
    const css = read('css/comparison.css');
    assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test('no backdrop/scrim — the navbar stays visible and interactive', () => {
    const css = read('css/comparison.css');
    assert.doesNotMatch(css, /backdrop\b(?!-filter)/i, 'no backdrop element styling');
    assert.doesNotMatch(css, /scrim/i, 'no scrim selector');
    assert.doesNotMatch(css, /overlay/i, 'no overlay selector');
});

test('mobile entrance slides up, not sideways', () => {
    const css = read('css/comparison.css');
    const mobile = css.slice(css.indexOf('@media (max-width: 640px)'));
    assert.match(mobile, /transform: translateY\(24px\)/);
});

test('grab handle exists in the shell and drag-down-to-dismiss is wired', () => {
    const js = read('js/comparison/sidebar.js');
    assert.match(js, /class="cmp-grab"/, 'buildShell renders the grab handle');
    assert.match(js, /cmp-grab-bar/, 'grab handle has the centered bar');
    assert.match(js, /pointerdown/);
    assert.match(js, /pointermove/);
    assert.match(js, /pointerup/);
    assert.match(js, /setPointerCapture/);
});

test('grab handle is hidden on desktop and never prints', () => {
    const css = read('css/comparison.css');
    // Base (desktop) rule hides the handle...
    assert.match(css, /\.cmp-grab \{\s*display: none;\s*\}/);
    // ...and the print hidden-chrome list includes it.
    const print = css.slice(css.indexOf('@media print'), css.indexOf('@media (max-width: 640px)'));
    assert.match(print, /\.cmp-grab/);
});
