import maplibregl from 'maplibre-gl';
import { t, onLocaleChange } from '../i18n.js';
import { fetchSimilooComparables } from '../api/similoo.js';

// Right-edge "Comparable Buildings" sidebar.
//
// Three stacked sections:
//   1. Target parcel metrics — municipality, zoning, EGRID, parcel size,
//      building volume + footprint + height + floors, construction year,
//      ratioV (headline metric, big number).
//   2. Filters — "years window" slider (1–30, default 10) and parcel-size
//      from/to inputs.
//   3. Comparable buildings list — sortable cards (similarity / ratioV /
//      size / year) with an in-card data bar visualising ratioV against
//      the max in the current set.
//
// Public API mirrors the building info panel module: `show({ target, egrid })`
// kicks off a fetch, `hide()` collapses the sidebar, `destroy()` rips it
// out. The picker integration in main.js owns the lifecycle.

const DEFAULT_YEARS = 10;
const DEBOUNCE_MS = 250;

const SORT_KEYS = ['similarity', 'ratioV', 'size', 'year'];

export function createComparisonSidebar({ map, onClose, onFlyTo, onSelectComparable, onHoverComparable, onUnhoverComparable, onDataLoaded } = {}) {
    let aside = buildShell();
    document.body.appendChild(aside);

    let currentEgrid = null;
    let currentData = null;
    let currentTargetSeed = null;
    let years = DEFAULT_YEARS;
    let sizeFrom = null;
    let sizeTo = null;
    let sortBy = 'similarity';
    let fetchSeq = 0;
    let highlightMarker = null;

    const els = {
        closeBtn: aside.querySelector('.cmp-close'),
        targetSection: aside.querySelector('.cmp-target'),
        targetEmpty: aside.querySelector('.cmp-target-empty'),
        yearsRange: aside.querySelector('.cmp-years-range'),
        yearsValue: aside.querySelector('.cmp-years-value'),
        sizeFromInput: aside.querySelector('.cmp-size-from'),
        sizeToInput: aside.querySelector('.cmp-size-to'),
        sortSelect: aside.querySelector('.cmp-sort'),
        list: aside.querySelector('.cmp-list'),
        status: aside.querySelector('.cmp-status'),
        meta: aside.querySelector('.cmp-meta'),
    };

    els.closeBtn.addEventListener('click', () => {
        hide();
        if (typeof onClose === 'function') onClose();
    });

    els.yearsRange.addEventListener('input', () => {
        years = clampInt(els.yearsRange.value, 1, 30, DEFAULT_YEARS);
        els.yearsValue.textContent = String(years);
        // Refetch debounced — moving the slider should feel responsive but
        // we don't want to fire a network call per single-pixel drag.
        scheduleRefetch();
    });

    let refetchTimer = null;
    function scheduleRefetch() {
        if (refetchTimer) clearTimeout(refetchTimer);
        refetchTimer = setTimeout(() => {
            refetchTimer = null;
            if (currentEgrid) loadFor(currentEgrid);
        }, DEBOUNCE_MS);
    }

    els.sizeFromInput.addEventListener('input', () => {
        sizeFrom = parseSizeInput(els.sizeFromInput.value);
        renderList();
    });
    els.sizeToInput.addEventListener('input', () => {
        sizeTo = parseSizeInput(els.sizeToInput.value);
        renderList();
    });
    els.sortSelect.addEventListener('change', () => {
        sortBy = SORT_KEYS.includes(els.sortSelect.value) ? els.sortSelect.value : 'similarity';
        renderList();
    });

    function show(egrid) {
        if (!egrid) return;
        currentEgrid = egrid;
        aside.setAttribute('data-state', 'visible');
        aside.setAttribute('aria-hidden', 'false');
        loadFor(egrid);
    }

    function hide() {
        aside.setAttribute('data-state', 'hidden');
        aside.setAttribute('aria-hidden', 'true');
        currentEgrid = null;
        currentData = null;
        clearHighlight();
    }

    async function loadFor(egrid) {
        const seq = ++fetchSeq;
        setStatus('loading');
        try {
            const data = await fetchSimilooComparables(egrid, { years, limit: 12 });
            // A newer request may have raced ahead — drop the stale response.
            if (seq !== fetchSeq) return;
            currentData = data;
            currentTargetSeed = `${data?.target?.egrid ?? egrid}`;
            renderTarget();
            renderList();
            renderMeta();
            setStatus(data?.comparables?.length ? 'ready' : 'empty');
            if (typeof onDataLoaded === 'function') onDataLoaded(data);
        } catch (err) {
            if (seq !== fetchSeq) return;
            console.error('similoo fetch failed:', err);
            setStatus('error');
        }
    }

    function setStatus(state) {
        els.status.dataset.state = state;
        switch (state) {
            case 'loading':
                els.status.textContent = t('comparison.status_loading');
                break;
            case 'empty':
                els.status.textContent = t('comparison.status_empty');
                break;
            case 'error':
                els.status.textContent = t('comparison.status_error');
                break;
            default:
                els.status.textContent = '';
        }
    }

    function renderTarget() {
        const target = currentData?.target;
        if (!target) {
            els.targetSection.hidden = true;
            els.targetEmpty.hidden = false;
            return;
        }
        els.targetEmpty.hidden = true;
        els.targetSection.hidden = false;
        const ratioV = Number.isFinite(target.ratioV)
            ? target.ratioV
            : (target.building_volume_m3 && target.parcel_area_m2
                ? target.building_volume_m3 / target.parcel_area_m2
                : null);
        els.targetSection.innerHTML = `
            <div class="cmp-target-head">
                <div class="cmp-target-ratiov">
                    <div class="cmp-target-ratiov-value">${formatRatio(ratioV)}</div>
                    <div class="cmp-target-ratiov-label">${escapeHtml(t('comparison.metric_ratiov'))}</div>
                </div>
                <div class="cmp-target-meta">
                    <div class="cmp-target-line">
                        <span class="cmp-target-key">${escapeHtml(t('comparison.metric_municipality'))}</span>
                        <span class="cmp-target-val">${escapeHtml(target.municipality || dash())}</span>
                    </div>
                    <div class="cmp-target-line">
                        <span class="cmp-target-key">${escapeHtml(t('comparison.metric_zoning'))}</span>
                        <span class="cmp-target-val">${escapeHtml(target.cz_local || target.cz_abbrev || dash())}</span>
                    </div>
                    <div class="cmp-target-line">
                        <span class="cmp-target-key">${escapeHtml(t('comparison.metric_egrid'))}</span>
                        <span class="cmp-target-val cmp-target-egrid">${escapeHtml(target.egrid || dash())}</span>
                    </div>
                </div>
            </div>
            <div class="cmp-target-grid">
                ${targetCell('comparison.metric_parcel_size', formatM2(target.parcel_area_m2))}
                ${targetCell('comparison.metric_volume', formatM3(target.building_volume_m3))}
                ${targetCell('comparison.metric_footprint', formatM2(target.footprint_m2))}
                ${targetCell('comparison.metric_height', formatM(target.height_m))}
                ${targetCell('comparison.metric_floors', target.floors != null ? String(target.floors) : dash())}
                ${targetCell('comparison.metric_year', target.construction_year != null ? String(target.construction_year) : dash())}
            </div>
        `;
    }

    function renderList() {
        if (!currentData) {
            els.list.innerHTML = '';
            return;
        }
        const filtered = filterComparables(currentData.comparables || []);
        const sorted = sortComparables(filtered, sortBy);
        if (!sorted.length) {
            els.list.innerHTML = '';
            setStatus(currentData.comparables?.length ? 'empty' : 'empty');
            return;
        }
        setStatus('ready');
        const maxRatio = sorted.reduce((m, c) => Math.max(m, Number.isFinite(c.ratioV) ? c.ratioV : 0), 0) || 1;
        els.list.innerHTML = sorted.map((c, i) => cardHtml(c, i, maxRatio)).join('');
        bindCardHandlers();
    }

    function cardHtml(c, idx, maxRatio) {
        const ratioPct = Math.max(2, Math.min(100, Math.round((c.ratioV / maxRatio) * 100)));
        return `
            <article class="cmp-card" data-idx="${idx}" tabindex="0" role="button" aria-label="${escapeHtml(t('comparison.card_aria', { egrid: c.egrid || '' }))}">
                <header class="cmp-card-head">
                    <div class="cmp-card-egrid" title="${escapeHtml(c.egrid || '')}">${escapeHtml(c.egrid || dash())}</div>
                    <div class="cmp-card-year">${c.construction_year != null ? escapeHtml(String(c.construction_year)) : dash()}</div>
                </header>
                <div class="cmp-card-ratiov-row">
                    <div class="cmp-card-ratiov-value">${formatRatio(c.ratioV)}</div>
                    <div class="cmp-card-ratiov-bar"><div class="cmp-card-ratiov-fill" style="width:${ratioPct}%"></div></div>
                </div>
                <footer class="cmp-card-foot">
                    <span class="cmp-card-foot-cell">
                        <span class="cmp-card-foot-key">${escapeHtml(t('comparison.metric_parcel_size_short'))}</span>
                        <span class="cmp-card-foot-val">${escapeHtml(formatM2(c.parcel_area_m2))}</span>
                    </span>
                    <span class="cmp-card-foot-cell">
                        <span class="cmp-card-foot-key">${escapeHtml(t('comparison.metric_volume_short'))}</span>
                        <span class="cmp-card-foot-val">${escapeHtml(formatM3(c.building_volume_m3))}</span>
                    </span>
                    <span class="cmp-card-foot-cell">
                        <span class="cmp-card-foot-key">${escapeHtml(t('comparison.metric_similarity_short'))}</span>
                        <span class="cmp-card-foot-val">${formatPct(c.similarity_score)}</span>
                    </span>
                </footer>
            </article>
        `;
    }

    function bindCardHandlers() {
        const cards = els.list.querySelectorAll('.cmp-card');
        cards.forEach((card) => {
            const idx = Number(card.dataset.idx);
            const comparable = sortedView()[idx];
            if (!comparable) return;
            // Click opens the building-detail popup. Fly-to is reserved
            // for explicit "show on map" affordances; otherwise the
            // primary action on a card is "inspect this building in 3D".
            card.addEventListener('click', () => {
                if (typeof onSelectComparable === 'function') {
                    onSelectComparable(comparable);
                } else {
                    flyToComparable(comparable);
                }
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (typeof onSelectComparable === 'function') {
                        onSelectComparable(comparable);
                    } else {
                        flyToComparable(comparable);
                    }
                }
            });
            card.addEventListener('mouseenter', () => {
                highlightComparable(comparable);
                onHoverComparable?.(comparable);
            });
            card.addEventListener('mouseleave', () => {
                clearHighlight();
                onUnhoverComparable?.(comparable);
            });
            card.addEventListener('focus', () => {
                highlightComparable(comparable);
                onHoverComparable?.(comparable);
            });
            card.addEventListener('blur', () => {
                clearHighlight();
                onUnhoverComparable?.(comparable);
            });
        });
    }

    function sortedView() {
        if (!currentData) return [];
        return sortComparables(filterComparables(currentData.comparables || []), sortBy);
    }

    function filterComparables(list) {
        return list.filter((c) => {
            if (Number.isFinite(sizeFrom) && c.parcel_area_m2 < sizeFrom) return false;
            if (Number.isFinite(sizeTo) && c.parcel_area_m2 > sizeTo) return false;
            return true;
        });
    }

    function sortComparables(list, key) {
        const sorted = list.slice();
        switch (key) {
            case 'ratioV':
                sorted.sort((a, b) => (b.ratioV ?? 0) - (a.ratioV ?? 0));
                break;
            case 'size':
                sorted.sort((a, b) => (b.parcel_area_m2 ?? 0) - (a.parcel_area_m2 ?? 0));
                break;
            case 'year':
                sorted.sort((a, b) => (b.construction_year ?? 0) - (a.construction_year ?? 0));
                break;
            case 'similarity':
            default:
                sorted.sort((a, b) => (b.similarity_score ?? 0) - (a.similarity_score ?? 0));
                break;
        }
        return sorted;
    }

    function flyToComparable(c) {
        if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
        if (typeof onFlyTo === 'function') {
            onFlyTo(c);
            return;
        }
        // Fallback: drive the MapLibre camera ourselves.
        if (map) {
            map.flyTo({
                center: [c.lng, c.lat],
                zoom: Math.max(map.getZoom(), 16.5),
                pitch: 50,
                bearing: -20,
                speed: 1.2,
                essential: true,
            });
        }
    }

    function highlightComparable(c) {
        if (!map) return;
        if (!Number.isFinite(c?.lat) || !Number.isFinite(c?.lng)) return;
        clearHighlight();
        // A floating red pin (DOM marker) over the comparable's centroid.
        // We don't have a stable per-comparable feature id in the rendered
        // building layer so we can't toggle feature-state for the whole set;
        // the marker is cheaper than juggling a filtered overlay layer and
        // it disappears cleanly on mouseleave.
        try {
            const el = document.createElement('div');
            el.className = 'cmp-pin';
            highlightMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([c.lng, c.lat])
                .addTo(map);
        } catch (err) {
            console.warn('comparison highlight failed:', err);
        }
    }

    function clearHighlight() {
        if (highlightMarker) {
            try { highlightMarker.remove(); } catch {}
            highlightMarker = null;
        }
    }

    function renderMeta() {
        const meta = currentData?.meta;
        if (!meta) {
            els.meta.textContent = '';
            return;
        }
        const tag = meta.source === 'mock' ? t('comparison.meta_mock') : t('comparison.meta_live');
        const month = meta.gwr_month ? t('comparison.meta_gwr_month', { month: meta.gwr_month }) : '';
        els.meta.textContent = [tag, month].filter(Boolean).join(' · ');
    }

    function targetCell(labelKey, value) {
        return `
            <div class="cmp-target-cell">
                <div class="cmp-target-cell-key">${escapeHtml(t(labelKey))}</div>
                <div class="cmp-target-cell-val">${escapeHtml(value)}</div>
            </div>
        `;
    }

    function relabel() {
        // Re-render every translatable string when the locale flips.
        aside.setAttribute('aria-label', t('comparison.title'));
        aside.querySelector('.cmp-eyebrow').textContent = t('comparison.eyebrow');
        aside.querySelector('.cmp-title').textContent = t('comparison.title');
        aside.querySelector('.cmp-close').setAttribute('aria-label', t('comparison.close'));
        aside.querySelector('.cmp-filters-title').textContent = t('comparison.filters_title');
        aside.querySelector('.cmp-years-label').textContent = t('comparison.years_window');
        aside.querySelector('.cmp-size-label').textContent = t('comparison.parcel_size_range');
        aside.querySelector('.cmp-size-from-label').textContent = t('comparison.parcel_size_from');
        aside.querySelector('.cmp-size-to-label').textContent = t('comparison.parcel_size_to');
        aside.querySelector('.cmp-list-title').textContent = t('comparison.list_title');
        aside.querySelector('.cmp-sort-label').textContent = t('comparison.sort_by');
        aside.querySelector('.cmp-target-empty').textContent = t('comparison.target_empty');
        aside.querySelector('.cmp-years-suffix').textContent = t('comparison.years_suffix');

        const sortOpts = aside.querySelectorAll('.cmp-sort option');
        sortOpts.forEach((opt) => {
            const key = opt.value;
            opt.textContent = t(`comparison.sort_${key}`);
        });
        renderTarget();
        renderList();
        renderMeta();
        if (els.status.dataset.state) setStatus(els.status.dataset.state);
    }

    onLocaleChange(() => relabel());
    relabel();

    function destroy() {
        clearHighlight();
        aside?.remove();
        aside = null;
    }

    function getCurrentData() {
        return currentData;
    }

    return { show, hide, destroy, getCurrentData };
}

// ---------- DOM shell -----------------------------------------------------

function buildShell() {
    const aside = document.createElement('aside');
    aside.className = 'cmp';
    aside.setAttribute('data-state', 'hidden');
    aside.setAttribute('aria-hidden', 'true');
    aside.setAttribute('role', 'complementary');
    aside.setAttribute('aria-label', 'Comparable buildings');
    aside.innerHTML = `
        <header class="cmp-header">
            <div class="cmp-eyebrow"></div>
            <h2 class="cmp-title"></h2>
            <button class="cmp-close" type="button" aria-label="Close">
                <i data-lucide="x"></i>
            </button>
        </header>

        <section class="cmp-section cmp-target-wrap">
            <div class="cmp-target"></div>
            <div class="cmp-target-empty"></div>
        </section>

        <section class="cmp-section cmp-filters">
            <h3 class="cmp-section-title cmp-filters-title"></h3>
            <div class="cmp-filter-row cmp-filter-years">
                <label class="cmp-years-label" for="cmp-years-range"></label>
                <div class="cmp-years-control">
                    <input type="range" min="1" max="30" step="1" value="10" id="cmp-years-range" class="cmp-years-range" />
                    <span class="cmp-years-value">10</span>
                    <span class="cmp-years-suffix"></span>
                </div>
            </div>
            <div class="cmp-filter-row cmp-filter-size">
                <label class="cmp-size-label"></label>
                <div class="cmp-size-control">
                    <label class="cmp-size-sub">
                        <span class="cmp-size-from-label"></span>
                        <input type="number" min="0" step="10" class="cmp-size-from" inputmode="numeric" placeholder="—" />
                    </label>
                    <label class="cmp-size-sub">
                        <span class="cmp-size-to-label"></span>
                        <input type="number" min="0" step="10" class="cmp-size-to" inputmode="numeric" placeholder="—" />
                    </label>
                </div>
            </div>
        </section>

        <section class="cmp-section cmp-list-wrap">
            <div class="cmp-list-header">
                <h3 class="cmp-section-title cmp-list-title"></h3>
                <label class="cmp-sort-wrap">
                    <span class="cmp-sort-label"></span>
                    <select class="cmp-sort">
                        <option value="similarity"></option>
                        <option value="ratioV"></option>
                        <option value="size"></option>
                        <option value="year"></option>
                    </select>
                </label>
            </div>
            <div class="cmp-status" data-state="idle"></div>
            <div class="cmp-list"></div>
            <div class="cmp-meta"></div>
        </section>
    `;
    return aside;
}

// ---------- helpers -------------------------------------------------------

function clampInt(raw, lo, hi, fallback) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(lo, Math.min(hi, Math.round(n)));
}

function parseSizeInput(raw) {
    const v = String(raw ?? '').trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function formatM2(n) {
    if (!Number.isFinite(n)) return dash();
    return `${formatInt(n)} ${t('comparison.unit_m2')}`;
}

function formatM3(n) {
    if (!Number.isFinite(n)) return dash();
    return `${formatInt(n)} ${t('comparison.unit_m3')}`;
}

function formatM(n) {
    if (!Number.isFinite(n)) return dash();
    return `${(Math.round(n * 10) / 10).toLocaleString('en-CH').replace(/,/g, ' ')} ${t('comparison.unit_m')}`;
}

function formatInt(n) {
    return Math.round(n).toLocaleString('en-CH').replace(/,/g, ' ');
}

function formatRatio(n) {
    if (!Number.isFinite(n)) return dash();
    return (Math.round(n * 100) / 100).toFixed(2);
}

function formatPct(n) {
    if (!Number.isFinite(n)) return dash();
    return `${Math.round(n * 100)}%`;
}

function dash() {
    return '—';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
