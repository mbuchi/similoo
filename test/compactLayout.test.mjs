// Source contracts for the compact (<1024px) app layout — the Aireon mobile
// standard (scoore origin). similoo has no vitest; these run under the same
// `node --test` harness as the other contract suites and read the shipped
// source files so a refactor that silently drops a compact behaviour fails
// the suite instead of shipping.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const readRoot = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const SHARED_COMMIT = 'cac1f963e0d98a11dec96d2eadd2de329d38063b';
const SHARED_SPEC = `github:mbuchi/aireon-shared#${SHARED_COMMIT}`;
const STABLE_USER_MENU_LOADER = 'https://static.aireon.ch/shell/user-menu/v1/loader.js';

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

test('the central account runtime is pinned to the reviewed shared release and enabled in production HTML', async () => {
    const manifest = JSON.parse(readRoot('package.json'));
    const lock = JSON.parse(readRoot('package-lock.json'));
    assert.equal(manifest.dependencies['@aireon/shared'], SHARED_SPEC);
    assert.equal(lock.packages[''].dependencies['@aireon/shared'], SHARED_SPEC);
    assert.equal(lock.packages['node_modules/@aireon/shared'].version, '1.194.0');
    assert.match(lock.packages['node_modules/@aireon/shared'].resolved, new RegExp(`${SHARED_COMMIT}$`));

    const viteConfig = readRoot('vite.config.ts');
    assert.match(viteConfig, /import \{ aireonHtmlPlugin \} from '@aireon\/shared\/vite'/);
    assert.match(viteConfig, /aireonHtmlPlugin\(\{ archetype: 'map-first', defaultTheme: 'light' \}\)/);
    assert.doesNotMatch(viteConfig, /runtimeUserMenu\s*:\s*false/);

    const { aireonHtmlPlugin } = await import('@aireon/shared/vite');
    const plugin = aireonHtmlPlugin({ archetype: 'map-first', defaultTheme: 'light' });
    plugin.config({}, { command: 'build' });
    const html = plugin.transformIndexHtml.handler('<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>');
    assert.equal(html.split(STABLE_USER_MENU_LOADER).length - 1, 1);
    assert.equal(html.split('<link rel="preconnect" href="https://static.aireon.ch" crossorigin>').length - 1, 1);
    assert.equal(html.split('<script type="importmap">').length - 1, 1);
    assert.match(html, /"maplibre-gl":"https:\/\/static\.aireon\.ch\/maplibre-gl@6\.3\.0\/maplibre-gl\.mjs"/);

    const chunkDirectory = new URL('../node_modules/@aireon/shared/dist/', import.meta.url);
    const runtimeSource = readdirSync(chunkDirectory)
        .filter((name) => /^chunk-.*\.js$/.test(name))
        .map((name) => readFileSync(new URL(name, chunkDirectory), 'utf8'))
        .find((source) => source.includes(STABLE_USER_MENU_LOADER));
    assert.ok(runtimeSource, 'installed shared package must carry the stable user-menu loader client');
    assert.match(runtimeSource, /function ensureRuntimeUserMenu\(\{ timeoutMs = 2e3 \} = \{\}\)/);
});

test('similoo intentionally adopts the runtime shell without an account summary', () => {
    const app = read('App.tsx');
    const userMenu = app.slice(app.indexOf('<MapUserMenu'), app.indexOf('/>', app.indexOf('<MapUserMenu')) + 2);

    assert.match(userMenu, /appId="similoo"/);
    assert.match(userMenu, /showSavedParcels=\{false\}/);
    assert.match(userMenu, /showSearchHistory=\{false\}/);
    assert.doesNotMatch(userMenu, /\bsummary(?:Handlers)?\s*=/);
    assert.doesNotMatch(userMenu, /\bdropdownSummary\s*=/);
});
