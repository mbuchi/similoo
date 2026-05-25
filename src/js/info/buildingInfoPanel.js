// Right-side dark info panel for the selected building. Knows nothing
// about Cesium — it just renders the shaped object returned by
// computeBuildingMetrics().

import { t, onLocaleChange } from '../i18n.js';

// Bucket / roof / source / label codes returned by buildingMetrics → the
// i18n keys that render the visible badge text. Translation logic stays in
// this panel so the metrics module remains UI-agnostic.
const BUCKET_KEYS = {
    small: 'building.bucket_small',
    medium: 'building.bucket_medium',
    large: 'building.bucket_large',
    xlarge: 'building.bucket_xlarge',
    'low-rise': 'building.bucket_low_rise',
    'mid-rise': 'building.bucket_mid_rise',
    'high-rise': 'building.bucket_high_rise',
    tower: 'building.bucket_tower',
};

const ROOF_KEYS = {
    flat: 'building.roof_flat',
    pitched: 'building.roof_pitched',
    unknown: 'building.roof_unknown',
};

const SOURCE_KEYS = {
    SwissTLM3D: 'building.source_swisstlm',
    'OSM Buildings': 'building.source_osm',
    Building: 'building.source_generic',
};

const BUILDING_LABEL_KEYS = {
    Residential: 'building.label_residential',
    'Mixed-use': 'building.label_mixed_use',
    Industrial: 'building.label_industrial',
    Office: 'building.label_office',
    Public: 'building.label_public',
    Religious: 'building.label_religious',
    Apartments: 'building.label_apartments',
    Commercial: 'building.label_commercial',
    Retail: 'building.label_retail',
    School: 'building.label_school',
    Building: 'building.fallback_name',
};

function tBucket(bucket) {
    const key = BUCKET_KEYS[bucket];
    return key ? t(key) : (bucket || '');
}

function tRoof(shape) {
    const key = ROOF_KEYS[shape];
    return key ? t(key) : t('building.roof_unknown');
}

function tSource(source) {
    const key = SOURCE_KEYS[source];
    return key ? t(key) : (source || t('building.source_generic'));
}

function tBuildingLabel(label) {
    const key = BUILDING_LABEL_KEYS[label];
    return key ? t(key) : (label || t('building.fallback_name'));
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildShell() {
    const aside = document.createElement('aside');
    aside.className = 'bip';
    aside.setAttribute('data-state', 'hidden');
    aside.setAttribute('aria-hidden', 'true');
    aside.setAttribute('role', 'dialog');
    aside.setAttribute('aria-label', t('building.dialog_label'));
    aside.dataset.i18nAriaKey = 'building.dialog_label';
    aside.innerHTML = `
        <header class="bip-header">
            <div class="bip-eyebrow">
                <span class="bip-source"></span>
                <span class="bip-divider">·</span>
                <span class="bip-id"></span>
            </div>
            <h2 class="bip-title"></h2>
            <button class="bip-close" type="button" aria-label="${t('building.close_panel')}" data-i18n-aria-key="building.close_panel"><i data-lucide="x"></i></button>
        </header>
        <section class="bip-section bip-quickstats" hidden></section>
        <section class="bip-section bip-profile" hidden></section>
        <section class="bip-section bip-solar" hidden></section>
        <section class="bip-section bip-props"></section>
    `;
    return aside;
}

export function createBuildingInfoPanel({ onClose } = {}) {
    let aside = buildShell();
    document.body.appendChild(aside);

    let lastMetrics = null;

    const closeBtn = aside.querySelector('.bip-close');
    closeBtn.addEventListener('click', () => {
        hide();
        if (typeof onClose === 'function') onClose();
    });

    function hide() {
        aside.setAttribute('data-state', 'hidden');
        aside.setAttribute('aria-hidden', 'true');
    }

    function show(metrics) {
        if (!metrics) return;
        lastMetrics = metrics;
        renderHeader(aside, metrics);
        renderQuickStats(aside, metrics);
        renderProfile(aside, metrics);
        renderSolar(aside, metrics);
        renderProps(aside, metrics);
        aside.setAttribute('data-state', 'visible');
        aside.setAttribute('aria-hidden', 'false');
        // Re-render any Lucide icons inside the panel (the chevron in the
        // properties toggle, the close X, etc.).
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ nameAttr: 'data-lucide' });
        }
    }

    function destroy() {
        aside.remove();
        aside = null;
    }

    // Re-render the entire panel content with the latest metrics when the
    // locale flips. Most strings (labels, bucket badges, "Properties (N)",
    // section headings, units) are baked into innerHTML at show() time.
    onLocaleChange(() => {
        if (!aside) return;
        aside.setAttribute('aria-label', t('building.dialog_label'));
        const closeBtnEl = aside.querySelector('.bip-close');
        if (closeBtnEl) closeBtnEl.setAttribute('aria-label', t('building.close_panel'));
        if (aside.getAttribute('data-state') === 'visible' && lastMetrics) {
            show(lastMetrics);
        }
    });

    return { show, hide, destroy };
}

// ---------- section renderers ----------------------------------------
// (Tasks 11–14 fill these in. Stubs render nothing so the skeleton works.)

function renderHeader(aside, metrics) {
    aside.querySelector('.bip-source').textContent = tSource(metrics.source);
    aside.querySelector('.bip-id').textContent = metrics.id ? t('building.id_prefix', { id: metrics.id }) : '';
    aside.querySelector('.bip-title').textContent = tBuildingLabel(metrics.label);
}

function formatNumber(n, decimals = 0) {
    if (!Number.isFinite(n)) return '—';
    if (n >= 10000) return Math.round(n).toLocaleString('en-CH').replace(/,/g, ' ');
    if (decimals === 0) return String(Math.round(n));
    return n.toFixed(decimals);
}

function renderQuickStats(aside, metrics) {
    const section = aside.querySelector('.bip-quickstats');
    const hasAny =
        Number.isFinite(metrics.volume) ||
        Number.isFinite(metrics.height) ||
        Number.isFinite(metrics.footprintArea);
    if (!hasAny) {
        section.hidden = true;
        section.innerHTML = '';
        return;
    }
    section.hidden = false;
    section.innerHTML = `
        <div class="bip-tile">
            <div class="bip-tile-value">${formatNumber(metrics.volume)}<span class="bip-tile-unit">${t('building.unit_m3')}</span></div>
            <div class="bip-tile-label">${t('building.tile_volume')}</div>
            <div class="bip-tile-est">${t('building.tile_estimated')}</div>
        </div>
        <div class="bip-tile">
            <div class="bip-tile-value">${formatNumber(metrics.height, 1)}<span class="bip-tile-unit">${t('building.unit_m')}</span></div>
            <div class="bip-tile-label">${t('building.tile_height')}</div>
        </div>
        <div class="bip-tile">
            <div class="bip-tile-value">${formatNumber(metrics.footprintArea)}<span class="bip-tile-unit">${t('building.unit_m2')}</span></div>
            <div class="bip-tile-label">${t('building.tile_footprint')}</div>
            <div class="bip-tile-est">${t('building.tile_estimated')}</div>
        </div>
    `;
}

function clampRatio(ratio) {
    if (!Number.isFinite(ratio) || ratio <= 0) return 0;
    return Math.min(1, ratio / 2); // 2× baseline fills the bar
}

function roofIcon(shape) {
    if (shape === 'flat') return 'square';
    if (shape === 'pitched') return 'triangle';
    return 'help-circle';
}

function renderProfile(aside, metrics) {
    const section = aside.querySelector('.bip-profile');
    if (!metrics.profile) {
        section.hidden = true;
        section.innerHTML = '';
        return;
    }
    const p = metrics.profile;
    section.hidden = false;
    section.innerHTML = `
        <h3 class="bip-section-title">${t('building.profile_title')}</h3>
        <div class="bip-bar-row">
            <span>${t('building.bar_volume')}</span>
            <div class="bip-bar"><div class="bip-bar-fill" style="width:${(clampRatio(p.volume.ratio) * 100).toFixed(0)}%"></div></div>
            <span class="bip-bar-badge">${tBucket(p.volume.bucket)}</span>
        </div>
        <div class="bip-bar-row">
            <span>${t('building.bar_height')}</span>
            <div class="bip-bar"><div class="bip-bar-fill" style="width:${(clampRatio(p.height.ratio) * 100).toFixed(0)}%"></div></div>
            <span class="bip-bar-badge">${tBucket(p.height.bucket)}</span>
        </div>
        <div class="bip-bar-row">
            <span>${t('building.bar_footprint')}</span>
            <div class="bip-bar"><div class="bip-bar-fill" style="width:${(clampRatio(p.footprint.ratio) * 100).toFixed(0)}%"></div></div>
            <span class="bip-bar-badge">${tBucket(p.footprint.bucket)}</span>
        </div>
        <div class="bip-roof-row">
            <i data-lucide="${roofIcon(metrics.roofShape)}"></i>
            <span>${t('building.roof_label')}</span>
            <span class="bip-roof-value">${tRoof(metrics.roofShape || 'unknown')}</span>
        </div>
    `;
}

function formatSolarDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-CH', { month: 'short', day: 'numeric' });
}

function renderSolar(aside, metrics) {
    const section = aside.querySelector('.bip-solar');
    if (!metrics.solar24h || !Array.isArray(metrics.solar24h.hourly)) {
        section.hidden = true;
        section.innerHTML = '';
        return;
    }
    const solar = metrics.solar24h;
    const W = 240;
    const H = 60;
    const barW = W / 24;
    const bars = solar.hourly
        .map((v, h) => {
            const isNight = v === 0 && (h < 4 || h > 21);
            const isShaded = v === 0 && !isNight;
            const barH = v === 1 ? H - 4 : (isShaded ? 6 : 4);
            const y = H - barH;
            const klass = isNight ? 'is-night' : isShaded ? 'is-shaded' : '';
            return `<rect class="${klass}" x="${(h * barW).toFixed(2)}" y="${y}" width="${(barW - 1).toFixed(2)}" height="${barH}" rx="1"/>`;
        })
        .join('');

    section.hidden = false;
    section.innerHTML = `
        <h3 class="bip-section-title">${t('building.solar_title')} <span class="bip-section-meta">${formatSolarDate(solar.date)}</span></h3>
        <svg class="bip-solar-sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            ${bars}
        </svg>
        <div class="bip-solar-axis">
            <span>06:00</span><span>12:00</span><span>18:00</span>
        </div>
        <div class="bip-solar-summary">
            <i data-lucide="sun"></i>
            <span>${t('building.solar_summary', {
                hours: solar.sunlitHours.toFixed(1),
                percent: (solar.sunlitPercent * 100).toFixed(0),
            })}</span>
        </div>
    `;
}

function renderProps(aside, metrics) {
    const section = aside.querySelector('.bip-props');
    const count = (metrics.props || []).length;
    section.innerHTML = `
        <button class="bip-props-toggle" type="button" aria-expanded="false">
            <i data-lucide="chevron-right"></i>
            ${t('building.props_toggle', { count })}
        </button>
        <dl class="bip-props-list" hidden>
            ${(metrics.props || [])
                .map(
                    ({ key, value }) =>
                        `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value ?? '')}</dd>`
                )
                .join('')}
        </dl>
    `;
    const toggle = section.querySelector('.bip-props-toggle');
    const list = section.querySelector('.bip-props-list');
    toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        list.hidden = open;
    });
}
