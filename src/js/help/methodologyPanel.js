import { t, onLocaleChange } from '../i18n.js';

// "How comparable buildings are calculated" help modal.
//
// Triggered by the "?" (help-circle) button in the navbar. It explains, in
// plain language, the pipeline the comparison engine runs:
//
//   1. Resolve the searched address → parcel → EGRID + the target parcel's
//      GWR metrics (zone, area, volume, footprint, height, floors, year,
//      ratioV).
//   2. Hard-filter the candidate pool to true peers — same planning zone
//      (cz_local) and built inside the years window (default 10, 1–30 via the
//      sidebar slider).
//   3. Soft-score the survivors 0–100% on three weighted axes — parcel size
//      (40%), volume density / ratioV (40%) and construction year (20%) —
//      mirroring the similarity formula in api/similoo.js:
//          score = 1 − 0.4·areaΔ − 0.4·ratioVΔ − 0.2·yearΔ
//
// Built in plain DOM + the shared `--hood-*` tokens (similoo is React-free),
// mirroring the release-notes panel pattern. Every string goes through the
// vanilla i18n `t()`, and the whole panel is rebuilt on `onLocaleChange`.

const HASH = '#how-it-works';

let panelEl = null;
let lastFocus = null;

// The three scoring axes and their weights, mirroring the similarity formula
// in api/similoo.js (areaΔ 0.4, ratioVΔ 0.4, yearΔ 0.2 → 40/40/20%).
const FACTORS = [
    { key: 'help.factor_size', weight: 40 },
    { key: 'help.factor_ratiov', weight: 40 },
    { key: 'help.factor_year', weight: 20 },
];

// The map highlight swatches — reuse the legend.* labels so the help modal
// and the on-map legend never drift apart.
const LEGEND_ROWS = [
    { cls: 'target', key: 'legend.target' },
    { cls: 'same-zone', key: 'legend.same_zone' },
    { cls: 'comparable', key: 'legend.comparable' },
];

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function panelMarkup() {
    return `
        <div class="mh-backdrop"></div>
        <div class="mh-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('help.title'))}">
            <header class="mh-header">
                <div class="mh-header-info">
                    <span class="mh-eyebrow"><i data-lucide="help-circle"></i>${escapeHtml(t('help.eyebrow'))}</span>
                    <h1 class="mh-title">${escapeHtml(t('help.title'))}</h1>
                    <p class="mh-subtitle">${escapeHtml(t('help.subtitle'))}</p>
                </div>
                <button class="mh-close" type="button" aria-label="${escapeHtml(t('help.close'))}"><i data-lucide="x"></i></button>
            </header>

            <div class="mh-body">
                <p class="mh-intro">${escapeHtml(t('help.intro'))}</p>

                <ol class="mh-steps">
                    <li class="mh-step">
                        <span class="mh-step-num">1</span>
                        <div class="mh-step-content">
                            <h2 class="mh-step-title">${escapeHtml(t('help.step1_title'))}</h2>
                            <p class="mh-step-body">${escapeHtml(t('help.step1_body'))}</p>
                        </div>
                    </li>

                    <li class="mh-step">
                        <span class="mh-step-num">2</span>
                        <div class="mh-step-content">
                            <h2 class="mh-step-title">${escapeHtml(t('help.step2_title'))}</h2>
                            <p class="mh-step-body">${escapeHtml(t('help.step2_body'))}</p>
                            <div class="mh-filters">
                                <div class="mh-filter">
                                    <span class="mh-filter-icon mh-filter-icon--zone"><i data-lucide="layers"></i></span>
                                    <div class="mh-filter-text">
                                        <h3 class="mh-filter-title">${escapeHtml(t('help.filter_zone_title'))}</h3>
                                        <p class="mh-filter-body">${escapeHtml(t('help.filter_zone_body'))}</p>
                                    </div>
                                </div>
                                <div class="mh-filter">
                                    <span class="mh-filter-icon mh-filter-icon--year"><i data-lucide="calendar-clock"></i></span>
                                    <div class="mh-filter-text">
                                        <h3 class="mh-filter-title">${escapeHtml(t('help.filter_year_title'))}</h3>
                                        <p class="mh-filter-body">${escapeHtml(t('help.filter_year_body'))}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </li>

                    <li class="mh-step">
                        <span class="mh-step-num">3</span>
                        <div class="mh-step-content">
                            <h2 class="mh-step-title">${escapeHtml(t('help.step3_title'))}</h2>
                            <p class="mh-step-body">${escapeHtml(t('help.step3_body'))}</p>
                            <ul class="mh-factors">
                                ${FACTORS.map((f) => `
                                    <li class="mh-factor">
                                        <span class="mh-factor-label">${escapeHtml(t(f.key))}</span>
                                        <span class="mh-factor-bar"><span class="mh-factor-fill" style="width:${f.weight}%"></span></span>
                                        <span class="mh-factor-weight">${f.weight}%</span>
                                    </li>
                                `).join('')}
                            </ul>
                            <p class="mh-step-note">${escapeHtml(t('help.step3_note'))}</p>
                        </div>
                    </li>
                </ol>

                <section class="mh-callout">
                    <h2 class="mh-callout-title"><i data-lucide="ruler"></i>${escapeHtml(t('help.ratiov_title'))}</h2>
                    <p class="mh-callout-body">${escapeHtml(t('help.ratiov_body'))}</p>
                    <code class="mh-formula">ratioV = ${escapeHtml(t('help.ratiov_formula'))}</code>
                </section>

                <section class="mh-legend">
                    <h2 class="mh-legend-title">${escapeHtml(t('help.legend_title'))}</h2>
                    <p class="mh-legend-intro">${escapeHtml(t('help.legend_intro'))}</p>
                    <ul class="mh-legend-rows">
                        ${LEGEND_ROWS.map((r) => `
                            <li class="mh-legend-row">
                                <span class="mh-legend-swatch mh-legend-swatch--${r.cls}" aria-hidden="true"></span>
                                <span class="mh-legend-label">${escapeHtml(t(r.key))}</span>
                            </li>
                        `).join('')}
                    </ul>
                </section>

                <p class="mh-data"><i data-lucide="database"></i><span>${escapeHtml(t('help.data_body'))}</span></p>
            </div>

            <footer class="mh-footer">
                <span>${escapeHtml(t('help.footer'))}</span>
                <button class="mh-close-btn" type="button">${escapeHtml(t('help.close'))} <kbd>Esc</kbd></button>
            </footer>
        </div>
    `;
}

function wireControls() {
    if (!panelEl) return;
    panelEl.querySelector('.mh-backdrop')?.addEventListener('click', close);
    panelEl.querySelectorAll('.mh-close, .mh-close-btn').forEach((btn) =>
        btn.addEventListener('click', close),
    );
}

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

export function open() {
    if (panelEl) return;
    lastFocus = document.activeElement;

    panelEl = document.createElement('div');
    panelEl.className = 'mh-overlay';
    panelEl.innerHTML = panelMarkup();
    document.body.appendChild(panelEl);
    document.body.classList.add('mh-open');

    wireControls();
    refreshIcons();
    requestAnimationFrame(() => panelEl?.classList.add('is-visible'));
    panelEl.querySelector('.mh-close')?.focus();

    if (window.location.hash !== HASH) {
        history.replaceState(null, '', `${location.pathname}${location.search}${HASH}`);
    }
}

export function close() {
    if (!panelEl) return;
    const node = panelEl;
    panelEl = null;
    node.classList.remove('is-visible');
    document.body.classList.remove('mh-open');
    setTimeout(() => node.remove(), 200);

    if (window.location.hash === HASH) {
        history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
    try { lastFocus?.focus?.(); } catch { /* element gone */ }
    lastFocus = null;
}

function rebuild() {
    if (!panelEl) return;
    const wasVisible = panelEl.classList.contains('is-visible');
    panelEl.innerHTML = panelMarkup();
    wireControls();
    refreshIcons();
    if (wasVisible) panelEl.classList.add('is-visible');
}

// Wire the navbar "?" button to the modal. Idempotent — safe to call once
// from boot().
export function initMethodologyHelp(buttonId = 'helpButton') {
    const btn = document.getElementById(buttonId);
    if (btn) btn.addEventListener('click', open);

    window.addEventListener('keydown', (e) => {
        if (panelEl && e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    });

    // Rebuild an open panel so its (innerHTML-baked) copy comes back
    // translated when the language flips.
    onLocaleChange(() => rebuild());

    // Deep link: opening on #how-it-works shows the panel straight away.
    if (window.location.hash === HASH) open();
    window.addEventListener('hashchange', () => {
        if (window.location.hash === HASH) open();
    });
}
