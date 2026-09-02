// Source contracts for the compact (<1024px) app layout — the Aireon mobile
// standard (scoore origin). similoo has no vitest; these run under the same
// `node --test` harness as the other contract suites and read the shipped
// source files so a refactor that silently drops a compact behaviour fails
// the suite instead of shipping.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const readRoot = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const SHARED_VERSION = '1.207.4';
const SHARED_COMMIT = '37c0089ce4ffd8fb322b6cf53e9e220695df6e4e';
const SHARED_SPEC = `github:mbuchi/aireon-shared#v${SHARED_VERSION}`;
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

// v1.194.0 routed MapUserMenu through the central <aireon-user-menu> custom
// element. That element renders in a shadow root, so it could not inherit the
// map-shell-user-* design CSS this app ships, and the menu came out visibly
// wrong: panel over the navbar, its own scrollbar, an unblurred translucent
// surface, Manage / name / email mis-placed, wrong font. v1.196.0 puts the
// bundled local shell back on MapUserMenu's render path and makes the central
// runtime opt-in, so the loader must be absent from the production HTML.
// The pin has since moved forward (v1.205.1); the runtime menu stays
// opt-in, so the assertions below still describe the shipped behavior.
//
// v1.205.1 is the light-mode theme fix. The pre-paint bootstrap stamps FOUR
// signals on <html> (the `dark` class, `data-theme`, style.colorScheme and
// style.backgroundColor) but applyTheme() moved only the class, so the first
// in-app theme change left the other three on the OLD theme. glass.css keys
// its dark tokens on [data-theme='dark'] .glass-surface / .glass-control as
// well as on .dark, so a stale attribute held every glass panel at the dark
// fill while the rest of the app went light, until a reload. All four signals
// now move together. Nothing about the account-menu render path changed.
test('the account menu is pinned to the shared release that renders the local shell', async () => {
    const manifest = JSON.parse(readRoot('package.json'));
    const lock = JSON.parse(readRoot('package-lock.json'));
    assert.equal(manifest.dependencies['@aireon/shared'], SHARED_SPEC);
    assert.equal(lock.packages[''].dependencies['@aireon/shared'], SHARED_SPEC);
    assert.equal(lock.packages['node_modules/@aireon/shared'].version, SHARED_VERSION);
    assert.match(lock.packages['node_modules/@aireon/shared'].resolved, new RegExp(`${SHARED_COMMIT}$`));

    const viteConfig = readRoot('vite.config.ts');
    assert.match(viteConfig, /import \{ aireonHtmlPlugin \} from '@aireon\/shared\/vite'/);
    assert.match(viteConfig, /aireonHtmlPlugin\(\{ archetype: 'map-first', defaultTheme: 'light' \}\)/);
    // The central runtime is opt-in from v1.196.0 on; similoo never opts in.
    assert.doesNotMatch(viteConfig, /runtimeUserMenu\s*:\s*true/);

    const { aireonHtmlPlugin } = await import('@aireon/shared/vite');
    const plugin = aireonHtmlPlugin({ archetype: 'map-first', defaultTheme: 'light' });
    plugin.config({}, { command: 'build' });
    const html = plugin.transformIndexHtml.handler('<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>');
    assert.equal(html.split(STABLE_USER_MENU_LOADER).length - 1, 0);
    // The shared MapLibre engine still rides on the same static host, so the
    // preconnect is unchanged by dropping the loader. From v1.203.1 on there is
    // NO import map: it needed Safari 16.4+ / Firefox 108+, above the suite's
    // own build target floor, so on Safari 16.0-16.3 the bare specifier failed
    // to resolve and the map died while the rest of the app kept working. The
    // plugin now resolves the exact bare id to the absolute URL at build time.
    // From v1.205.0 that URL carries `/baseline/`: the stock upstream bundle is
    // ES2022 and its class static initialization blocks cannot be PARSED by
    // Safari < 16.4, Firefox < 93 or Chrome < 94, so dropping the import map
    // alone only changed the failure from "cannot resolve" to a SyntaxError.
    // The host's baseline build is the same version lowered to
    // safari16,firefox104,chrome107,edge107.
    assert.equal(html.split('<link rel="preconnect" href="https://static.aireon.ch" crossorigin>').length - 1, 1);
    assert.equal(html.split('<script type="importmap">').length - 1, 0);
    assert.deepEqual(plugin.resolveId('maplibre-gl'), {
        id: 'https://static.aireon.ch/maplibre-gl@6.3.0/baseline/maplibre-gl.mjs',
        external: true,
    });
    // Matched by EXACT id: subpath imports stay bundled, which is what keeps
    // the tile-worker asset and maplibre-gl.css local and per-app.
    assert.equal(plugin.resolveId('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'), null);

    // The installed MapUserMenu emits the local shell markup that carries the
    // suite design CSS, rather than mounting the shadow-DOM custom element.
    const sharedEntry = readFileSync(
        new URL('../node_modules/@aireon/shared/dist/index.js', import.meta.url),
        'utf8',
    );
    assert.match(sharedEntry, /map-shell-user-dropdown/);
    assert.match(sharedEntry, /map-shell-user-menu-item/);
});

test('similoo keeps the local account shell without an account summary', () => {
    const app = read('App.tsx');
    const userMenu = app.slice(app.indexOf('<MapUserMenu'), app.indexOf('/>', app.indexOf('<MapUserMenu')) + 2);

    assert.match(userMenu, /appId="similoo"/);
    assert.match(userMenu, /showSavedParcels=\{false\}/);
    assert.match(userMenu, /showSearchHistory=\{false\}/);
    assert.doesNotMatch(userMenu, /\bsummary(?:Handlers)?\s*=/);
    assert.doesNotMatch(userMenu, /\bdropdownSummary\s*=/);
});
