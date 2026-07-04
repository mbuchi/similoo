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

// Inline lucide SVGs matching the shared <ParcelIdentityHeader> (MapPin 11px for
// the subtitle, Copy/Check 13px for the EGRID chip). Inlined because this
// imperative card builds its DOM via innerHTML rather than the React icon
// components; the markup + `.aireon-pih-*` classes are otherwise identical to
// the shared component so the header renders the same across the suite.
const PIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';
const COPY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="aireon-pih-egrid-icon" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="aireon-pih-egrid-icon" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

// One placeholder comparable card (mirrors `cmp-card`), shown while the first
// fetch for a parcel is in flight. Suite standard: a skeleton, never a spinner.
const SKELETON_CARD = `
    <article class="cmp-card cmp-card-skeleton" aria-hidden="true">
        <div class="cmp-card-head">
            <div class="skeleton" style="height:11px;width:88px;"></div>
            <div class="skeleton" style="height:12px;width:32px;"></div>
        </div>
        <div class="cmp-card-ratiov-row">
            <div class="skeleton" style="height:16px;width:46px;"></div>
            <div class="skeleton" style="height:6px;width:100%;"></div>
        </div>
        <div class="cmp-card-foot">
            <div class="skeleton" style="height:22px;"></div>
            <div class="skeleton" style="height:22px;"></div>
            <div class="skeleton" style="height:22px;"></div>
            <div class="skeleton" style="height:22px;"></div>
            <div class="skeleton" style="height:22px;"></div>
        </div>
    </article>
`;

export function createComparisonSidebar({ map, onClose, onFlyTo, onSelectComparable, onHoverComparable, onUnhoverComparable, onDataLoaded } = {}) {
    let aside = buildShell();
    document.body.appendChild(aside);

    let currentEgrid = null;
    let currentAddress = null;
    let currentData = null;
    let currentTargetSeed = null;
    let years = DEFAULT_YEARS;
    let sizeFrom = null;
    let sizeTo = null;
    let sortBy = 'similarity';
    let fetchSeq = 0;

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

    function show(egrid, address) {
        if (!egrid) return;
        // New parcel → drop the previous parcel's data so the next load shows a
        // skeleton instead of stale cards.
        if (egrid !== currentEgrid) currentData = null;
        currentEgrid = egrid;
        // The searched address (if any) titles the parcel identity header; it
        // arrives from the navbar/landing search pick via main.js.
        currentAddress = address || null;
        aside.setAttribute('data-state', 'visible');
        aside.setAttribute('aria-hidden', 'false');
        loadFor(egrid);
    }

    function hide() {
        aside.setAttribute('data-state', 'hidden');
        aside.setAttribute('aria-hidden', 'true');
        currentEgrid = null;
        currentAddress = null;
        currentData = null;
        onUnhoverComparable?.();
    }

    async function loadFor(egrid) {
        const seq = ++fetchSeq;
        setStatus('loading');
        // First fetch for this parcel → skeleton placeholders. On a slider
        // refetch the prior data stays put (no flicker), only the status updates.
        if (!currentData) renderLoadingSkeleton();
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
            // Drop the first-load skeleton; a refetch keeps the prior content.
            if (!currentData) {
                els.list.innerHTML = '';
                els.targetSection.hidden = true;
                els.targetSection.innerHTML = '';
                els.targetEmpty.hidden = false;
            }
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

    // Skeleton placeholders for the target metrics + comparable list, shown
    // while the first fetch for a parcel is in flight (suite standard: never a
    // spinner). Reuses the shared `.skeleton` blink and the real layout classes
    // so the swap to real content does not shift.
    function renderLoadingSkeleton() {
        els.targetEmpty.hidden = true;
        els.targetSection.hidden = false;
        els.targetSection.innerHTML = `
            <div class="cmp-target-head">
                <div class="skeleton" style="height:64px;width:96px;border-radius:14px;"></div>
                <div class="cmp-target-meta">
                    <div class="skeleton" style="height:12px;width:85%;"></div>
                    <div class="skeleton" style="height:12px;width:68%;"></div>
                    <div class="skeleton" style="height:12px;width:78%;"></div>
                </div>
            </div>
            <div class="cmp-target-grid">
                ${'<div class="skeleton" style="height:42px;border-radius:8px;"></div>'.repeat(6)}
            </div>
        `;
        els.list.innerHTML = SKELETON_CARD.repeat(6);
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
        const egrid = target.egrid || currentEgrid || null;
        els.targetSection.innerHTML = `
            ${identityHeaderHtml(egrid)}
            <div class="cmp-target-head">
                <div class="cmp-target-ratiov">
                    <div class="cmp-target-ratiov-value">${formatRatio(ratioV)}</div>
                    <div class="cmp-target-ratiov-label">${escapeHtml(t('comparison.metric_ratiov'))}</div>
                </div>
                <div class="cmp-target-meta">
                    <div class="cmp-target-line">
                        <span class="cmp-target-key">${escapeHtml(t('comparison.metric_zoning'))}</span>
                        <span class="cmp-target-val">${escapeHtml(target.cz_local || target.cz_abbrev || dash())}</span>
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
        bindIdentityHeader();
    }

    // Suite-standard parcel identity header (mirrors the shared
    // @aireon/shared <ParcelIdentityHeader>, reusing its shipped `.aireon-pih-*`
    // classes from map-ui.css). Titles the subject card with the searched
    // address (falling back to the municipality, then a localized "Selected
    // parcel"), shows the municipality as the muted subtitle, and renders the
    // EGRID as a monospace chip that copies itself to the clipboard on click.
    // similoo's engine themes off [data-theme="dark"], which the shipped
    // `.aireon-pih-*` rules already target, so no --dark flag is needed here.
    function identityHeaderHtml(egrid) {
        const target = currentData?.target;
        const municipality = target?.municipality || null;
        const title = currentAddress || municipality || t('comparison.identity_fallback_title');
        // Show the municipality as the muted subtitle only when it isn't already
        // the title (i.e. we have a real searched address up top) — otherwise it
        // would just repeat the title line.
        const subtitle = currentAddress && municipality ? municipality : null;
        const copyLabel = t('comparison.copy_egrid');
        return `
            <div class="aireon-pih cmp-target-identity">
                <div class="aireon-pih-main">
                    <h2 class="aireon-pih-title">${escapeHtml(title)}</h2>
                    ${subtitle ? `
                    <p class="aireon-pih-subtitle">
                        ${PIN_SVG}
                        <span class="aireon-pih-subtitle-text">${escapeHtml(subtitle)}</span>
                    </p>` : ''}
                    ${egrid ? `
                    <button type="button" class="aireon-pih-egrid" data-egrid="${escapeHtml(egrid)}" title="${escapeHtml(copyLabel)}" aria-label="${escapeHtml(copyLabel)}">
                        <span class="aireon-pih-egrid-eyebrow" aria-hidden="true">EGRID</span>
                        <span class="aireon-pih-egrid-value">${escapeHtml(egrid)}</span>
                        ${COPY_SVG}
                    </button>
                    <span role="status" aria-live="polite" class="sr-only"></span>` : ''}
                </div>
            </div>
        `;
    }

    // Wire the copy-to-clipboard chip after each renderTarget(). Mirrors the
    // shared component's behavior: copy the EGRID, swap the label + icon to
    // "Copied" for ~1.5s, announce it politely, then revert.
    let copyTimer = null;
    function bindIdentityHeader() {
        const chip = els.targetSection.querySelector('.aireon-pih-egrid');
        if (!chip) return;
        const status = els.targetSection.querySelector('.aireon-pih [role="status"]');
        chip.addEventListener('click', async () => {
            const egrid = chip.dataset.egrid;
            if (!egrid) return;
            try {
                await navigator.clipboard?.writeText(egrid);
            } catch {
                return;
            }
            const copiedLabel = t('comparison.copied');
            const valueEl = chip.querySelector('.aireon-pih-egrid-value');
            const iconEl = chip.querySelector('.aireon-pih-egrid-icon');
            chip.classList.add('aireon-pih-egrid--copied');
            if (valueEl) valueEl.textContent = copiedLabel;
            if (iconEl) iconEl.outerHTML = CHECK_SVG;
            chip.title = copiedLabel;
            chip.setAttribute('aria-label', copiedLabel);
            if (status) status.textContent = copiedLabel;
            if (copyTimer) clearTimeout(copyTimer);
            copyTimer = setTimeout(() => {
                // Re-render the header to restore the idle EGRID/icon state.
                if (els.targetSection && currentData) renderTarget();
            }, 1500);
        });
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
        const pcLabel = escapeHtml(t('comparison.card_view_pointcloud'));
        return `
            <article class="cmp-card" data-idx="${idx}" tabindex="0" role="button" aria-label="${escapeHtml(t('comparison.card_aria', { egrid: c.egrid || '' }))}" title="${escapeHtml(t('comparison.card_show_hint'))}">
                <header class="cmp-card-head">
                    <div class="cmp-card-egrid" title="${escapeHtml(c.egrid || '')}">${escapeHtml(c.egrid || dash())}</div>
                    <div class="cmp-card-head-right">
                        <div class="cmp-card-year">${c.construction_year != null ? escapeHtml(String(c.construction_year)) : dash()}</div>
                        <button class="cmp-card-pc" type="button" aria-label="${pcLabel}" title="${pcLabel}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                        </button>
                    </div>
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
                        <span class="cmp-card-foot-key">${escapeHtml(t('comparison.metric_height_short'))}</span>
                        <span class="cmp-card-foot-val">${escapeHtml(formatM(c.height_m))}</span>
                    </span>
                    <span class="cmp-card-foot-cell">
                        <span class="cmp-card-foot-key">${escapeHtml(t('comparison.metric_floors_short'))}</span>
                        <span class="cmp-card-foot-val">${c.floors != null ? escapeHtml(String(c.floors)) : dash()}</span>
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
            // Primary action: fly the map camera to the comparable parcel so
            // the user can see it in context. The 3D point-cloud viewer moved
            // to the dedicated in-card button (below) — clicking the card body
            // now means "show me this one on the map".
            card.addEventListener('click', () => flyToComparable(comparable));
            card.addEventListener('keydown', (e) => {
                // Only the card's own Enter/Space triggers fly-to; when the
                // nested point-cloud button has focus it fires its own click,
                // so we must not double-handle the bubbled keydown here.
                if (e.target !== card) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    flyToComparable(comparable);
                }
            });
            // Secondary action: the small in-card button opens the 3D
            // point-cloud viewer. stopPropagation keeps it from also flying
            // the map via the card's click handler above.
            const pcBtn = card.querySelector('.cmp-card-pc');
            if (pcBtn) {
                pcBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof onSelectComparable === 'function') onSelectComparable(comparable);
                });
            }
            // Hover/focus spotlights the comparable's parcel on the map. The
            // map treatment (an animated amber parcel outline) is owned by
            // main.js via these callbacks — the sidebar no longer drops its
            // own map marker.
            card.addEventListener('mouseenter', () => onHoverComparable?.(comparable));
            card.addEventListener('mouseleave', () => onUnhoverComparable?.(comparable));
            card.addEventListener('focus', () => onHoverComparable?.(comparable));
            card.addEventListener('blur', () => onUnhoverComparable?.(comparable));
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
        onUnhoverComparable?.();
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
                        <input type="number" min="0" step="10" class="cmp-size-from" inputmode="numeric" placeholder="-" />
                    </label>
                    <label class="cmp-size-sub">
                        <span class="cmp-size-to-label"></span>
                        <input type="number" min="0" step="10" class="cmp-size-to" inputmode="numeric" placeholder="-" />
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
    return '-';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
