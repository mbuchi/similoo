// Shared value formatters + data-pill markup for the comparison surfaces.
//
// Extracted verbatim from sidebar.js so the comparable map popup can print the
// exact same numbers and pills the sidebar cards do — one formatter per unit,
// one pill markup, no drift between the list and the map.

import { t } from '../i18n.js';

export function formatM2(n) {
    if (!Number.isFinite(n)) return dash();
    return `${formatInt(n)} ${t('comparison.unit_m2')}`;
}

export function formatM3(n) {
    if (!Number.isFinite(n)) return dash();
    return `${formatInt(n)} ${t('comparison.unit_m3')}`;
}

export function formatM(n) {
    if (!Number.isFinite(n)) return dash();
    return `${(Math.round(n * 10) / 10).toLocaleString('en-CH').replace(/,/g, ' ')} ${t('comparison.unit_m')}`;
}

export function formatInt(n) {
    return Math.round(n).toLocaleString('en-CH').replace(/,/g, ' ');
}

export function formatRatio(n) {
    if (!Number.isFinite(n)) return dash();
    return (Math.round(n * 100) / 100).toFixed(2);
}

export function formatPct(n) {
    if (!Number.isFinite(n)) return dash();
    return `${Math.round(n * 100)}%`;
}

export function dash() {
    return '-';
}

// --- Suite data pills (DATA_PILLS_STANDARD.md, @aireon/shared v1.135.0) -------
//
// The shared <DataPillGroup> / <DataPill> pair is React; the comparison
// surfaces build their DOM from innerHTML strings, so this hand-rolls the
// exact same markup and `.aireon-datapill*` classes that ship in map-ui.css.
// Keeping the class contract identical means the pills render the same here as
// in every React app in the suite. similoo themes off [data-theme="dark"],
// which the shipped rules target directly, so no `--dark` flag is needed.

// One fit-content pill. A nullish/empty value renders nothing so callers can
// list every candidate field and let the missing ones fall away. `label` is a
// short uppercase prefix for values that are ambiguous on their own ("FLOORS:
// 3"); `title` is the hover/a11y meaning for values that already carry a unit
// ("658 m²").
export function dataPillHtml({ label, value, title, mono, emphasis } = {}) {
    if (value == null || value === '') return '';
    const cls = [
        'aireon-datapill',
        mono ? 'aireon-datapill--mono' : '',
        emphasis ? 'aireon-datapill--em' : '',
    ].filter(Boolean).join(' ');
    const meaning = title ?? label ?? '';
    const labelHtml = label
        ? `<span class="aireon-datapill-label">${escapeHtml(label)}:</span>`
        : '';
    return `<span class="${cls}"${meaning ? ` title="${escapeHtml(meaning)}"` : ''}>`
        + `${labelHtml}<span class="aireon-datapill-value">${escapeHtml(String(value))}</span></span>`;
}

// One titled section ("Parcel", "Building") whose pills sit on a tightly
// wrapping row. A group whose items are all empty renders nothing at all — no
// stray eyebrow heading over an empty row.
export function dataPillGroupHtml(heading, items) {
    const pills = items.map(dataPillHtml).filter(Boolean);
    if (!pills.length) return '';
    return `
        <section class="aireon-datapill-group" aria-label="${escapeHtml(heading)}">
            <h3 class="aireon-datapill-heading">${escapeHtml(heading)}</h3>
            <div class="aireon-datapill-row">${pills.join('')}</div>
        </section>
    `;
}

export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
