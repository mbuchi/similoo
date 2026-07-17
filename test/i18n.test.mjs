// i18n completeness and runtime behavior.
//
// Completeness is checked statically against src/js/i18n.js source: every
// key present in en must exist in fr/de/it and vice versa, with no empty
// strings. Runtime behavior (locale switching, fallback, interpolation)
// goes through the real module + shared engine, which are SSR-safe.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const i18n = await import('../src/js/i18n.js');
const engine = await import('@aireon/shared/cesium-app/i18n/engine.js');

// ---------- static catalog extraction --------------------------------

function extractCatalogKeys() {
    const src = readFileSync(new URL('../src/js/i18n.js', import.meta.url), 'utf8');
    const start = src.indexOf('const translations = {');
    const end = src.indexOf('\n};', start);
    assert.ok(start > -1 && end > start, 'translations catalog not found in i18n.js');

    const locales = {};
    let current = null;
    for (const line of src.slice(start, end).split('\n')) {
        const open = line.match(/^ {2}([a-z]{2}): \{$/);
        if (open) {
            current = open[1];
            locales[current] = new Map();
            continue;
        }
        if (/^ {2}\},?$/.test(line)) {
            current = null;
            continue;
        }
        if (!current) continue;
        const entry = line.match(/^ {4}'([^']+)':(.*)$/);
        if (entry) locales[current].set(entry[1], entry[2].trim());
    }
    return locales;
}

const catalog = extractCatalogKeys();

test('the catalog carries exactly the four supported locales', () => {
    assert.deepEqual(i18n.SUPPORTED_LOCALES, ['en', 'fr', 'de', 'it']);
    assert.deepEqual(Object.keys(catalog).sort(), ['de', 'en', 'fr', 'it']);
    assert.ok(catalog.en.size > 200, `en catalog suspiciously small: ${catalog.en.size} keys`);
});

test('every translation key exists in all four locales', () => {
    const enKeys = [...catalog.en.keys()];
    for (const locale of ['fr', 'de', 'it']) {
        const keys = new Set(catalog[locale].keys());
        const missing = enKeys.filter((k) => !keys.has(k));
        const extra = [...keys].filter((k) => !catalog.en.has(k));
        assert.deepEqual(missing, [], `${locale} is missing keys present in en`);
        assert.deepEqual(extra, [], `${locale} has keys absent from en`);
    }
});

test('no locale ships an empty translation string', () => {
    for (const [locale, entries] of Object.entries(catalog)) {
        for (const [key, rawValue] of entries) {
            assert.ok(
                !/^(''|"")\s*,?$/.test(rawValue),
                `${locale}.${key} is an empty string`,
            );
        }
    }
});

// ---------- runtime behavior ------------------------------------------

test('locale switching resolves the same key per language', (t) => {
    t.after(() => engine.setLocale('en'));
    assert.equal(i18n.getLocale(), 'en'); // headless Node: no stored or navigator locale
    assert.equal(i18n.t('common.loading'), 'Loading…');

    const expected = {
        fr: 'Chargement…',
        de: 'Wird geladen…',
        it: 'Caricamento…',
    };
    for (const [locale, value] of Object.entries(expected)) {
        engine.setLocale(locale);
        assert.equal(engine.t('common.loading'), value);
    }
});

test('an unsupported locale is a no-op', () => {
    engine.setLocale('xx');
    assert.equal(engine.getLocale(), 'en');
});

test('placeholders interpolate and unknown keys fall back to the key', () => {
    assert.equal(
        i18n.t('nav.search_results_count', { count: 3 }),
        '3 address suggestions available',
    );
    // A missing param leaves the placeholder visible instead of crashing.
    assert.equal(
        i18n.t('nav.search_results_count'),
        '{count} address suggestions available',
    );
    assert.equal(i18n.t('definitely.not.a.key'), 'definitely.not.a.key');
});
