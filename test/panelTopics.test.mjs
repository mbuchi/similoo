// Parcel-panel topic tabs contract — aireon-shared/docs/PANEL_TABS_STANDARD.md.
//
// similoo's comparison sidebar is imperative vanilla DOM, so there is no
// component test to render; like the other contract suites here this reads the
// shipped source files under `node --test` so a refactor that drops the
// standard fails here instead of shipping.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const sidebar = read('js/comparison/sidebar.js');
const css = read('css/comparison.css');
const i18n = read('js/i18n.js');

test('the topic row is the shared PanelTopicTabs, never a hand-rolled control', () => {
    assert.match(sidebar, /from '@aireon\/shared\/panel-topics'/);
    assert.match(sidebar, /PanelTopicTabs/);
    // SegmentedTabs is a segmented *toggle* wearing tab roles (no aria-controls,
    // no roving tabIndex, no arrow keys) and stays correct for map-control docks
    // only. A panel topic row is a real tab widget.
    assert.doesNotMatch(sidebar, /SegmentedTabs/);
});

test("T1/T2/T7: one level, tab 1 is the app's job, no details tab", () => {
    assert.match(sidebar, /const PANEL_TOPICS = \['compare', 'build'\];/);
    // Tab 1 is the default: `resolvePanelTopic` falls back to `topics[0]`, and
    // the shell paints that same id before the first render.
    assert.match(sidebar, /const DEFAULT_PANEL_TOPIC = PANEL_TOPICS\[0\];/);
    assert.match(sidebar, /data-topic', DEFAULT_PANEL_TOPIC/);
    // Exactly ONE tablist mount point — a second one would be the nested tab
    // row the standard exists to forbid.
    assert.equal(sidebar.split('class="cmp-topics"').length - 1, 1);
});

test('T6: the `build` label comes from shared, never from similoo i18n', () => {
    assert.match(sidebar, /getPanelTopicLabels\(getLocale\(\)\)\.build/);
    // Re-translating a canonical label in an app table is what makes `Build`
    // drift into `Massing` in one repo and `Erstellen` in another.
    assert.doesNotMatch(i18n, /'comparison\.topic_build'/);
});

test('similoo owns only its headline topic label, in all four locales', () => {
    for (const key of ['comparison.topic_compare', 'comparison.topic_selector', 'comparison.build_empty']) {
        assert.equal(
            i18n.split(`'${key}':`).length - 1,
            4,
            `${key} must be present in exactly the four supported locales`,
        );
    }
});

test('T9: ?topic= beats the stored preference, and there is no legacy mode to migrate', () => {
    assert.match(sidebar, /resolvePanelTopic\(\{/);
    assert.match(sidebar, /urlTopic: getPanelTopicOverride\(\)/);
    assert.match(sidebar, /stored: readStoredTopic\(\)/);
    assert.match(sidebar, /panelTopicStorageKey\('similoo'\)/);
    // similoo never shipped the retired `Simple | Advanced` density mode, so
    // passing a `legacy` map would migrate a key that never existed.
    assert.doesNotMatch(sidebar, /parcelDetailMode/);
    // Storage is wrapped both ways: a blocked store must never break the panel.
    assert.match(sidebar, /function readStoredTopic\(\)\s*\{\s*try \{/);
    assert.match(sidebar, /function writeStoredTopic\(value\)\s*\{\s*try \{/);
});

test('the body it controls is a real tabpanel', () => {
    assert.match(sidebar, /const TOPIC_PANEL_ID = 'cmp-topic-panel';/);
    assert.match(sidebar, /role="tabpanel"/);
    assert.match(sidebar, /aria-labelledby="\$\{TOPIC_PANEL_ID\}-tab-\$\{DEFAULT_PANEL_TOPIC\}"/);
    // ...and it re-points at the active tab on every switch.
    assert.match(sidebar, /aria-labelledby', `\$\{TOPIC_PANEL_ID\}-tab-\$\{topic\}`/);
    assert.match(sidebar, /panelId: TOPIC_PANEL_ID/);
});

test('the identity header sits ABOVE the tabs and is the same on every topic', () => {
    // PANEL_ACTIONS_STANDARD R4: address / EGRID / coordinates are the panel's
    // shell header. Repeating them inside a tab is the duplicate-header bug.
    const shell = sidebar.slice(sidebar.indexOf('function buildShell()'));
    const identityAt = shell.indexOf('class="cmp-identity"');
    const topicsAt = shell.indexOf('class="cmp-topics"');
    const panelAt = shell.indexOf('class="cmp-topic-panel"');
    assert.ok(identityAt > -1 && topicsAt > identityAt, 'identity block precedes the topic row');
    assert.ok(panelAt > topicsAt, 'the tabpanel follows the topic row');
    assert.match(sidebar, /els\.identity\.innerHTML = identityHeaderHtml\(egrid\)/);
});

test('the Compare section is never an empty padded box under the tab row', () => {
    // `.cmp-target` (loaded / skeleton) and `.cmp-target-empty` (no target,
    // fetch error) are siblings inside the SAME .cmp-section, so exactly one is
    // always visible. Split them and the section paints 32px of padding plus a
    // stray divider directly beneath the tabs whenever /score/similoo fails.
    const section = sidebar.slice(
        sidebar.indexOf('<section class="cmp-section cmp-target-wrap">'),
        sidebar.indexOf('<div class="cmp-massing">'),
    );
    assert.match(section, /class="cmp-target"/);
    assert.match(section, /class="cmp-target-empty"/);
});

test('the shell markup carries no backtick that would close its template literal', () => {
    // buildShell() assigns aside.innerHTML from a template literal, so a
    // backtick anywhere in that HTML (easy to type in an explanatory comment,
    // e.g. `.cmp-target`) terminates the literal and breaks the whole app.
    const open = "aside.innerHTML = `";
    const start = sidebar.indexOf(open);
    assert.ok(start > -1, 'buildShell assigns innerHTML from a template literal');
    const body = sidebar.slice(start + open.length, sidebar.indexOf('`;\n    return aside;', start));
    assert.ok(body.length > 0, 'found the shell template body');
    assert.ok(!body.includes('`'), 'no backtick inside the shell template literal');
});

test('the massing simulator is MOUNTED per topic, not hidden with CSS', () => {
    // A MapLibre map created inside a `display: none` box initialises at zero
    // height and never recovers, so the Build section is unmounted rather than
    // hidden when another topic is showing.
    assert.match(sidebar, /const active = topic === 'build' && !!currentEgrid;/);
    assert.match(sidebar, /massingRoot\.render\(\s*\n\s*active/);
    assert.doesNotMatch(css, /\.cmp\[data-topic="compare"\][^\n]*\.cmp-massing/);
});

test('CSS switches the Compare body on the aside\'s data-topic', () => {
    assert.match(css, /\.cmp\[data-topic="build"\] \.cmp-target-wrap,/);
    assert.match(css, /\.cmp\[data-topic="build"\] \.cmp-filters,/);
    assert.match(css, /\.cmp\[data-topic="build"\] \.cmp-list-wrap \{ display: none; \}/);
});

test('T8: the raw {} view replaces the tabpanel, tabs and all', () => {
    assert.match(css, /\.cmp\[data-raw="true"\] \.cmp-identity-wrap,/);
    assert.match(css, /\.cmp\[data-raw="true"\] \.cmp-topic-panel \{ display: none; \}/);
    // ...and it stays a header toggle, never a third tab.
    assert.doesNotMatch(sidebar, /id: 'raw'/);
});

test('a printout is the whole report, not a snapshot of the open tab', () => {
    const print = css.slice(css.indexOf('@media print'), css.indexOf('@media (max-width: 640px)'));
    assert.match(print, /\.cmp-topics,/);
    assert.match(print, /\.cmp-build-empty,/);
    assert.match(print, /\.cmp-identity-wrap,\n\s*\.cmp-topic-panel,\n\s*\.cmp-target-wrap,\n\s*\.cmp-list-wrap \{\n\s*display: block !important;/);
});
