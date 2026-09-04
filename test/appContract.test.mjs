// App-level contracts: release-notes metadata stays in lockstep with
// package.json (the What's New badge derives from RELEASES[0]), and the
// mobile touch-target CSS contract keeps holding.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const { RELEASES, KIND_META, CURRENT_VERSION } = await import(
    '../src/js/releaseNotes/releaseNotesData.js'
);
const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const lock = JSON.parse(
    readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
);

test('package.json version and CURRENT_VERSION move in lockstep', () => {
    assert.equal(CURRENT_VERSION, pkg.version);
    assert.equal(RELEASES[0].version, CURRENT_VERSION);
});

test('the shared v1.209.0 repin release is newest', () => {
    assert.equal(pkg.version, '0.58.3');
    assert.equal(RELEASES[0].version, '0.58.3');
    assert.equal(RELEASES[0].codename, 'Shared foundation v1.209.0');
    assert.match(RELEASES[0].summary, /v1\.209\.0/);
    // The signal-carrier repin stays in the log, one below the head.
    assert.equal(RELEASES[1].codename, 'Carrier stays on');
    // The Turnstile-hardening repin stays in the log, two below the head.
    assert.equal(RELEASES[2].codename, 'A tighter bot gate');
    // The initial bot-gate wiring release stays in the log, three below the head.
    assert.equal(RELEASES[3].codename, 'Bot gate wired in');
    // The light-mode theme-switch release stays in the log, four below the head.
    assert.equal(RELEASES[4].codename, 'Light mode all the way through');
    // The even-navbar-spacing release stays in the log, five below the head.
    assert.equal(RELEASES[5].codename, 'Evenly spaced');
});

// v0.47.0 shipped with package-lock.json still saying 0.46.1: npm writes both
// of these fields from package.json, so they only drift when a version bump is
// hand-edited without a matching install. Derived from pkg.version rather than
// pinned to a literal, so a bump never has to touch this file to stay true.
test('package-lock.json carries the same version in both of its fields', () => {
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[''].version, pkg.version);
});

test('package-lock.json describes this package', () => {
    assert.equal(lock.name, pkg.name);
    assert.equal(lock.packages[''].name, pkg.name);
});

test('releases are well-formed and strictly newest-first', () => {
    assert.ok(RELEASES.length > 0);
    const toParts = (v) => v.split('.').map(Number);
    for (const release of RELEASES) {
        assert.match(release.version, /^\d+\.\d+\.\d+$/);
        assert.ok(release.date, `${release.version} has no date`);
        assert.ok(release.summary, `${release.version} has no summary`);
        assert.ok(release.items.length > 0, `${release.version} has no items`);
    }
    for (let i = 1; i < RELEASES.length; i++) {
        const [a, b] = [toParts(RELEASES[i - 1].version), toParts(RELEASES[i].version)];
        const cmp = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
        assert.ok(
            cmp > 0,
            `releases out of order: ${RELEASES[i - 1].version} follows ${RELEASES[i].version}`,
        );
    }
});

test('every release item uses a badge kind the panel can render', () => {
    const kinds = new Set(Object.keys(KIND_META));
    for (const release of RELEASES) {
        for (const item of release.items) {
            assert.ok(
                kinds.has(item.kind),
                `${release.version} uses unknown kind "${item.kind}"`,
            );
            assert.ok(item.text, `${release.version} has an item without text`);
        }
    }
});

test('comparison controls keep their 44px touch targets', async () => {
    // scripts/mobile-touch-regression.mjs asserts on import; a failed
    // contract rejects this dynamic import and fails the test. The
    // standalone `npm run test:mobile-touch` entry point stays intact.
    await import('../scripts/mobile-touch-regression.mjs');
});
