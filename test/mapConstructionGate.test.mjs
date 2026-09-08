// Source contract for the MapLibre construction gate.
//
// maplibre-gl 6.7.0 changed how the engine reports a refused WebGL2 context, and
// the two behaviors are MUTUALLY EXCLUSIVE, so a guard written for either one
// alone is dead code under the other:
//
//   <= 6.6.0  `_setupPainter()` fires a GPUInitializationError EVENT and the
//             constructor ends `if (!this.painter) return;` — `new Map()`
//             RESOLVES and hands back a painter-less map whose damage lands far
//             from its cause (jumpTo/easeTo and Marker.addTo both die on
//             "reading '0'").
//   >= 6.7.0  `_setupPainter()` THROWS and the constructor rethrows it after
//             `_cleanupContainer()` — `new Map()` THROWS, sailing straight past
//             any post-construction painter gate.
//
// The shared `constructMapSafely` folds both into a `null` return. The BEHAVIOUR
// is covered by src/js/viewer/viewerConfig.test.ts (fakes), by
// src/js/viewer/mapEnginePremise.test.ts (the real installed engine) and by
// src/js/mapUnavailable.test.ts (what the visitor gets). What this file pins is
// the SHAPE of the source, so the gate cannot quietly be edited back out — and
// above all so a NEW bare `new maplibregl.Map(...)` cannot creep in beside it.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

// ⚠ Both files DESCRIBE `new maplibregl.Map(...)` in their comments (that is the
// whole point of the seam notes at the top of viewerConfig.js), so a raw match
// over the file counts prose as code. Strip line comments before counting.
const stripComments = (src) => src.replace(/^\s*\/\/.*$/gm, '');

const viewerConfig = read('js/viewer/viewerConfig.js');
const viewerConfigCode = stripComments(viewerConfig);
const main = read('js/main.js');
const mainCode = stripComments(main);

test('every MapLibre construction in the app goes through the shared gate', () => {
    assert.match(
        viewerConfig,
        /import \{ constructMapSafely, MapStartupUnsupportedError \} from '@aireon\/shared\/webgl'/,
    );
    // The engine is constructed in exactly ONE place in this repo, and that one
    // place is wrapped. Counting is what catches a second site being added later
    // without the wrapper.
    const constructions = viewerConfigCode.match(/new maplibregl\.Map\(/g) ?? [];
    assert.equal(constructions.length, 1, 'expected exactly one MapLibre construction site');
    assert.match(viewerConfigCode, /constructMapSafely\(\(\) => new maplibregl\.Map\(\{/);

    // No OTHER module may construct one at all. `main.js` builds Markers from
    // the same namespace import, which is why this is a per-file assertion
    // rather than a repo-wide grep for `maplibregl.`.
    assert.doesNotMatch(mainCode, /new maplibregl\.Map\(/);
});

test('the gate sits between the constructor and the first use of the instance', () => {
    const construction = viewerConfigCode.indexOf('constructMapSafely(() => new maplibregl.Map({');
    const nullCheck = viewerConfigCode.indexOf('if (!map) {', construction);
    const unsupported = viewerConfigCode.indexOf('throw new MapStartupUnsupportedError()', nullCheck);
    const firstUse = viewerConfigCode.indexOf('map.addControl(', construction);

    assert.ok(construction > -1, 'construction site not found');
    assert.ok(nullCheck > construction, 'the null check must follow construction');
    assert.ok(unsupported > nullCheck, 'the null branch must raise the named device error');
    // The ordering that matters: nothing touches the instance — not addControl,
    // not the load/error promise, not a ref write — before the gate has passed.
    assert.ok(firstUse > unsupported, 'the gate must precede the first use of the map');
});

test('a device that cannot paint is warned about, never reported as a defect', () => {
    const catchBlock = mainCode.indexOf('if (isDeviceCannotPaint(e)) {');
    const warn = mainCode.indexOf("console.warn('MapLibre startup unsupported:'", catchBlock);
    const genuineFailure = mainCode.indexOf("console.error('Error initializing viewer:'", catchBlock);

    assert.ok(catchBlock > -1, 'the device-cause branch is missing from ensureMap');
    assert.ok(warn > catchBlock, 'the device cause must be reported with console.warn');
    // ⚠ App.tsx installs the shared error logger with `captureConsoleErrors:
    // true`, which files one hub bug row per console.error. The device branch
    // must return BEFORE the genuine-failure console.error, or every
    // WebGL2-less visitor files a row for a browser setting.
    assert.ok(
        genuineFailure > warn,
        'the device branch must come before the genuine-failure console.error',
    );
    assert.match(main, /console\.warn\('MapLibre startup unsupported:'/);

    // Matched by NAME, never `instanceof`: similoo loads the engine from
    // static.aireon.ch, so the GPUInitializationError class we would catch is
    // not necessarily the one any bundled copy exposes.
    assert.match(main, /error\?\.name === 'MapStartupUnsupportedError' \|\| isGpuInitializationError\(error\)/);
});

test('the unavailable path latches instead of re-arming construction', () => {
    // A device that cannot paint never will, so re-arming would rebuild — and
    // re-report — on every later search or recenter. `mapLoading` keeps its
    // resolved-null promise so every subsequent ensureMap() short-circuits.
    const branch = mainCode.indexOf('if (isDeviceCannotPaint(e)) {');
    const branchEnd = mainCode.indexOf('mapLoading = null;', branch);
    const returnNull = mainCode.indexOf('return null;', branch);

    assert.ok(returnNull > branch, 'the device branch must resolve null');
    assert.ok(
        returnNull < branchEnd,
        'the device branch must return before `mapLoading = null` re-arms construction',
    );
});

test('the React shell is told, so the visitor gets an explanation not a blank panel', () => {
    assert.match(main, /window\.dispatchEvent\(new CustomEvent\('similoo:map-unavailable'\)\)/);

    const view = read('components/ComparisonView.tsx');
    assert.match(view, /import \{ MapUnavailable \} from '@aireon\/shared\/webgl'/);
    assert.match(view, /window\.addEventListener\('similoo:map-unavailable', onUnavailable\)/);
    assert.match(view, /\{mapUnavailable \? <MapUnavailable dark=\{dark\} \/> : null\}/);
});

test('every unawaited map launch carries a terminal catch', () => {
    // ⚠ The deep-link bootstrap's own `try { ... } catch { }` is SYNCHRONOUS and
    // provably cannot catch an async rejection, so a genuine boot failure used to
    // land as an unhandled rejection — which the shared error logger also hooks,
    // filing a SECOND hub row on top of ensureMap's console.error.
    const launches = mainCode.match(/void (handlePick|showEmptyMap|ensureMap)\(/g) ?? [];
    assert.ok(launches.length >= 4, `expected the unawaited launch sites, found ${launches.length}`);
    // Every `void`-launched promise chain ends in a catch.
    const catches = mainCode.match(/\.catch\(\(\) => \{ \/\* already reported by ensureMap \*\/ \}\)/g) ?? [];
    assert.equal(
        catches.length,
        launches.length,
        'each unawaited map launch needs its own terminal .catch',
    );
});
