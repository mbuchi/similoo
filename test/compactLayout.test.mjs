// Source contracts for the compact (<1024px) app layout — the Aireon mobile
// standard (scoore origin). similoo has no vitest; these run under the same
// `node --test` harness as the other contract suites and read the shipped
// source files so a refactor that silently drops a compact behaviour fails
// the suite instead of shipping.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('useCompactLayout switches at the suite-standard 1024px breakpoint', () => {
    const hook = read('hooks/useCompactLayout.ts');
    assert.match(hook, /COMPACT_LAYOUT_BREAKPOINT = 1024/);
    assert.match(hook, /max-width: \$\{COMPACT_LAYOUT_BREAKPOINT - 1\}px/);
    // Synchronous initial read — no desktop-navbar flash on phone loads.
    assert.match(hook, /useState\(matchesCompactLayout\)/);
});

test('compact navbar collapses to wordmark + search + one account menu', () => {
    const app = read('App.tsx');
    // Hub badge leaves the bar on phones.
    assert.match(app, /hideHubLink=\{isCompact\}/);
    // The MapToolbar cluster and the Open-with / help / about icon cluster
    // disappear; their actions live in the account menu instead.
    assert.match(app, /toolbar=\{isCompact \? undefined : \{/);
    assert.match(app, /actionsExtra=\{isCompact \? undefined :/);
    assert.match(app, /\.\.\.\(isCompact \? compactMenuItems : \[\]\)/);
});

test('compact account dropdown is height-capped with its own scrollbar', () => {
    const app = read('App.tsx');
    assert.match(app, /map-shell-user-dropdown\]:max-h-/);
    assert.match(app, /map-shell-user-dropdown\]:overflow-y-auto/);
    assert.match(app, /map-shell-user-menu-item\]:min-h-11/);
});

test('every removed navbar action has a compact account-menu row', () => {
    const app = read('App.tsx');
    for (const key of ['open-with', 'methodology', 'capture', 'exports', 'language']) {
        assert.ok(
            app.includes(`key: '${key}'`),
            `compact menu is missing the '${key}' row`,
        );
    }
    // Liquid Glass appearance rides in via the shared menu-item builder.
    assert.match(app, /buildGlassMenuItem\(\{ level: glassLevel/);
});
