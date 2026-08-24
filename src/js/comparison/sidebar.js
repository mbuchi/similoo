import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
    BuildableMassingSection,
    ParcelOpenInMenu,
    aerialThumbnailZoom,
    buildSwisstopoAerialUrl,
    parseSwissAddress,
} from '@aireon/shared';
// Parcel-panel topic tabs (PANEL_TABS_STANDARD.md, @aireon/shared v1.180.0):
// the panel's ONE level of subject tabs. `PanelTopicTabs` is the WAI-ARIA tab
// widget; `getPanelTopicLabels` supplies the canonical `build` label so it
// never drifts into "Massing" here and "Bauen" there; `resolvePanelTopic` is
// the pure half of the `usePanelTopic` hook, which is what an imperative panel
// like this one can use.
import {
    PanelTopicTabs,
    getPanelTopicLabels,
    panelTopicStorageKey,
    resolvePanelTopic,
} from '@aireon/shared/panel-topics';
import { getPanelTopicOverride } from '@aireon/shared/url-params';
// The one zone label per parcel (PARCEL_ZONE_STANDARD.md, @aireon/shared
// v1.177.0): the MUNICIPAL designation (`cz_local`, "Wohnzone, Bauklasse 4").
// The federal category (`cz_harmonized`) is a filter, never the label. The
// resolver owns the fallback chain and the legal-reference guard; ZONE_FIELDS
// is only used to copy the zone columns off the picked tile (see zoneSource).
import { ZONE_FIELDS, resolveZoneLabel } from '@aireon/shared/parcel-zone';
import { t, onLocaleChange, getLocale } from '../i18n.js';
import { fetchSimilooComparables } from '../api/similoo.js';
import {
    ALL_YEARS,
    DEFAULT_YEARS,
    YEARS_LADDER,
    normalizeYearsWindow,
} from '../yearsWindow.js';
import { createSaveParcelButton } from './saveParcelButton.js';

// Right-edge "Comparable Buildings" sidebar.
//
// The parcel identity header (address, EGRID, coordinates, aerial thumbnail)
// is the panel's shell header and stays put on every topic. Below it sits the
// panel's ONE level of subject tabs (PANEL_TABS_STANDARD.md):
//
//   Compare (tab 1, the app's job and the default)
//     1. Target parcel — the ratioV headline metric, then the attributes as
//        suite data pills (DATA_PILLS_STANDARD.md): a "Parcel" section (size,
//        zone) and a "Building" section (footprint, floors, year, height,
//        volume). The zone pill is the ONE zone label per parcel from the
//        shared resolver (@aireon/shared/parcel-zone): the municipal
//        designation ("Wohnzone, Bauklasse 4"), resolved off the
//        /score/similoo target row with the picked parcel tile's zone columns
//        laid over it.
//     2. Filters — the "years window" precision ladder (5/10/15/20/40/60/All,
//        default 10) and parcel-size from/to inputs.
//     3. Comparable buildings list — sortable cards (similarity / ratioV /
//        size / year) with an in-card data bar visualising ratioV against
//        the max in the current set.
//
//   Build (canonical shared subject) — the buildable-massing simulator for the
//     subject parcel, on its own so it stops competing with the comparables
//     list for the same scroll.
//
// Public API mirrors the building info panel module: `show({ target, egrid })`
// kicks off a fetch, `hide()` collapses the sidebar, `destroy()` rips it
// out. The picker integration in main.js owns the lifecycle.

const DEBOUNCE_MS = 250;

const SORT_KEYS = ['similarity', 'ratioV', 'size', 'year'];

// --- Panel topics (PANEL_TABS_STANDARD.md) ---------------------------------
//
// T2: tab 1 is the question the app exists to answer, and it is the default —
// for similoo that is the comparable-buildings answer, so `compare` leads.
// T6: `build` is a canonical suite subject; its id, its four labels and the
// section it renders (<BuildableMassingSection>) all come from shared, never
// from similoo's own i18n table. similoo has no labeled field dictionary, so
// there is no `details` tab (T7 does not apply).
const PANEL_TOPICS = ['compare', 'build'];
const DEFAULT_PANEL_TOPIC = PANEL_TOPICS[0];
// DOM id of the role="tabpanel" the topic row controls. `PanelTopicTabs`
// derives each tab's own id from it as `${panelId}-tab-${topic}`, which is what
// the panel points aria-labelledby at.
const TOPIC_PANEL_ID = 'cmp-topic-panel';
const TOPIC_STORAGE_KEY = panelTopicStorageKey('similoo');

// The storage half of `usePanelTopic`, hand-rolled because this panel is
// imperative and cannot call a hook. Every access is wrapped for the same
// reason the shared hook wraps its own: private-mode Safari and storage-blocked
// embeds throw on getItem/setItem, and a panel must never fail to open over a
// preference.
function readStoredTopic() {
    try {
        return localStorage.getItem(TOPIC_STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeStoredTopic(value) {
    try {
        localStorage.setItem(TOPIC_STORAGE_KEY, value);
    } catch {
        /* storage unavailable — a blocked store must never break the panel */
    }
}

// Inline lucide SVGs matching the shared <ParcelIdentityHeader> (MapPin 11px for
// the subtitle, Copy/Check 13px for the identifier chips). Inlined because this
// imperative card builds its DOM via innerHTML rather than the React icon
// components; the markup + `.aireon-pih-*` classes are otherwise identical to
// the shared component so the header renders the same across the suite.
const PIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';
const COPY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cmp-id-chip-icon" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cmp-id-chip-icon" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

// Aerial thumbnail rendered size (CSS px) — matches the shared
// <ParcelAerialThumbnail> default the ParcelPanelShell apps use, so the
// compact header reads the same across the suite. The WMS request doubles it
// for retina (buildSwisstopoAerialUrl does that internally).
const AERIAL_SIZE_PX = 88;

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

// Loading placeholder for one data-pill section: the eyebrow heading plus a
// wrapping row of pill-shaped blanks at the widths the real pills take, so the
// swap to real content does not shift the panel.
function skeletonPillGroup(widths) {
    const pills = widths
        .map((w) => `<div class="skeleton" style="height:22px;width:${w}px;border-radius:9999px;"></div>`)
        .join('');
    return `
        <section class="aireon-datapill-group" aria-hidden="true">
            <div class="skeleton" style="height:10px;width:52px;margin-bottom:6px;"></div>
            <div class="aireon-datapill-row">${pills}</div>
        </section>
    `;
}

export function createComparisonSidebar({ map, onClose, onFlyTo, onSelectComparable, onHoverComparable, onUnhoverComparable, onDataLoaded } = {}) {
    let aside = buildShell();
    document.body.appendChild(aside);

    // "Track" (save to PRM) toggle for the target parcel. Created once and
    // re-slotted into the identity header after each renderTarget() — the
    // section is innerHTML-rebuilt, but this node (with its listeners and
    // resolved tracked-state) survives across renders.
    const saveParcel = createSaveParcelButton();

    let currentEgrid = null;
    let currentAddress = null;
    let currentData = null;
    let currentTargetSeed = null;
    // The searched parcel's polygon + centroid, threaded in from main.js's pick
    // flow — the lite base + camera center the buildable-massing simulator uses.
    let currentGeometry = null;
    let currentLngLat = null;
    // The picked parcel tile's properties (null when the tile pick missed). Only
    // its zone columns are read: the tile carries every zone column
    // (`cz_local`, `cz_harmonized`, `cz_canton`), the /score/similoo target row
    // only `cz_local` + `cz_abbrev`, so the zone pill resolves off both.
    let currentParcelProps = null;
    let massingRoot = null;
    let panelThemeObserver = null;
    let footerRoot = null;
    let topicsRoot = null;
    // Which subject tab the panel is on. `?topic=` from the URL the page was
    // opened with beats the stored preference (a shared link is an explicit
    // instruction); similoo never shipped the retired `Simple | Advanced`
    // density mode, so there is no legacy key to migrate.
    let topic = resolvePanelTopic({
        appKey: 'similoo',
        topics: PANEL_TOPICS,
        urlTopic: getPanelTopicOverride(),
        stored: readStoredTopic(),
    });
    let years = DEFAULT_YEARS;
    let sizeFrom = null;
    let sizeTo = null;
    let sortBy = 'similarity';
    let fetchSeq = 0;
    // Developer "{}" raw-JSON view state — mirrors groove's InfoPanel showRaw.
    let showRaw = false;
    let rawCopyTimer = null;

    const els = {
        grab: aside.querySelector('.cmp-grab'),
        closeBtn: aside.querySelector('.cmp-close'),
        rawToggle: aside.querySelector('.cmp-raw-toggle'),
        rawTitle: aside.querySelector('.cmp-raw-title'),
        rawCopy: aside.querySelector('.cmp-raw-copy'),
        rawCopyLabel: aside.querySelector('.cmp-raw-copy-label'),
        rawPre: aside.querySelector('.cmp-raw'),
        identity: aside.querySelector('.cmp-identity'),
        targetSection: aside.querySelector('.cmp-target'),
        targetEmpty: aside.querySelector('.cmp-target-empty'),
        topics: aside.querySelector('.cmp-topics'),
        topicPanel: aside.querySelector('.cmp-topic-panel'),
        massing: aside.querySelector('.cmp-massing'),
        buildEmpty: aside.querySelector('.cmp-build-empty'),
        yearsLabel: aside.querySelector('.cmp-years-label'),
        sizeFromInput: aside.querySelector('.cmp-size-from'),
        sizeToInput: aside.querySelector('.cmp-size-to'),
        sortSelect: aside.querySelector('.cmp-sort'),
        list: aside.querySelector('.cmp-list'),
        status: aside.querySelector('.cmp-status'),
        poolNote: aside.querySelector('.cmp-pool-note'),
        meta: aside.querySelector('.cmp-meta'),
        footer: aside.querySelector('.cmp-footer'),
    };

    // Header action cluster order (suite panel-actions standard): Track
    // bookmark first, raw-JSON "{}" second, Close last. The Track chip is a
    // JS-built control (saveParcelButton.js), so slot it into the header
    // ahead of the raw toggle here rather than in the static shell HTML. It
    // renders whenever a target parcel is loaded — signed-out too, where a
    // click routes to the shared login modal.
    aside.querySelector('.cmp-header').insertBefore(saveParcel.root, els.rawToggle);

    els.closeBtn.addEventListener('click', () => {
        hide();
        if (typeof onClose === 'function') onClose();
    });

    // Drag-down-to-dismiss on the mobile grab handle (Aireon mobile
    // parcel-sheet standard). The handle only renders on phones — desktop
    // hides it via comparison.css — so the pointer wiring is inert there.
    let dragStartY = null;
    function clearDragStyles() {
        // Inline styles only live during an active drag; clearing them hands
        // control back to the CSS data-state transitions.
        aside.style.transform = '';
        aside.style.transition = '';
    }
    els.grab.addEventListener('pointerdown', (e) => {
        dragStartY = e.clientY;
        els.grab.setPointerCapture(e.pointerId);
        aside.style.transition = 'none';
    });
    els.grab.addEventListener('pointermove', (e) => {
        if (dragStartY === null) return;
        const dy = Math.max(0, e.clientY - dragStartY);
        aside.style.transform = `translateY(${dy}px)`;
    });
    els.grab.addEventListener('pointerup', (e) => {
        if (dragStartY === null) return;
        const dy = e.clientY - dragStartY;
        dragStartY = null;
        clearDragStyles();
        if (dy > 90) {
            hide();
            if (typeof onClose === 'function') onClose();
        }
    });
    els.grab.addEventListener('pointercancel', () => {
        dragStartY = null;
        clearDragStyles();
    });

    // --- years precision ladder ------------------------------------------
    //
    // The window filter is a discrete ladder (5/10/15/20/40/60/All), not a free
    // slider: every step is a question someone actually asks, and the widest
    // one drops the construction-year floor entirely. It behaves as a radio
    // group — exactly one step is in the tab order (roving tabindex), arrow
    // keys and Home/End move the selection, and `aria-checked` carries state
    // for assistive tech. Sighted users read the selection off a filled pill
    // plus a heavier label, so it never depends on hue alone.
    const yearsSteps = Array.from(aside.querySelectorAll('.cmp-years-step'));

    function stepValue(button) {
        return normalizeYearsWindow(button.dataset.years);
    }

    function syncYearsLadder({ focus = false } = {}) {
        for (const button of yearsSteps) {
            const active = stepValue(button) === years;
            button.setAttribute('aria-checked', active ? 'true' : 'false');
            button.tabIndex = active ? 0 : -1;
            if (active && focus) button.focus();
        }
    }

    function selectYears(next, { focus = false } = {}) {
        const value = normalizeYearsWindow(next);
        const changed = value !== years;
        years = value;
        syncYearsLadder({ focus });
        // Refetch debounced — a keyboard sweep across the ladder should feel
        // instant without firing a network call per keystroke.
        if (changed) scheduleRefetch();
    }

    yearsSteps.forEach((button, index) => {
        // Enter/Space already arrive here as a native button click, so the
        // keydown handler below deliberately ignores them.
        button.addEventListener('click', () => selectYears(button.dataset.years));
        button.addEventListener('keydown', (e) => {
            const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
                : 0;
            let target = null;
            if (step) {
                target = yearsSteps[(index + step + yearsSteps.length) % yearsSteps.length];
            } else if (e.key === 'Home') {
                target = yearsSteps[0];
            } else if (e.key === 'End') {
                target = yearsSteps[yearsSteps.length - 1];
            }
            if (!target) return;
            e.preventDefault();
            selectYears(target.dataset.years, { focus: true });
        });
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

    // "{}" toggle — flip the panel into the raw-JSON developer view (and back).
    // Inert while there's no data to serialize.
    els.rawToggle.addEventListener('click', () => {
        if (!currentData) return;
        setRaw(!showRaw);
    });

    // Copy the pretty-printed JSON to the clipboard, flashing "Copied" for ~1.5s.
    els.rawCopy.addEventListener('click', async () => {
        const text = safeStringify(currentData);
        try {
            await navigator.clipboard?.writeText(text);
        } catch {
            return;
        }
        els.rawCopy.classList.add('is-copied');
        els.rawCopyLabel.textContent = t('comparison.copied');
        if (rawCopyTimer) clearTimeout(rawCopyTimer);
        rawCopyTimer = setTimeout(() => {
            els.rawCopy.classList.remove('is-copied');
            els.rawCopyLabel.textContent = t('comparison.copy');
        }, 1500);
    });

    function show(egrid, address, geometry, lngLat, parcelProps) {
        if (!egrid) return;
        // New parcel → drop the previous parcel's data so the next load shows a
        // skeleton instead of stale cards.
        if (egrid !== currentEgrid) currentData = null;
        currentEgrid = egrid;
        // The searched address (if any) titles the parcel identity header; it
        // arrives from the navbar/landing search pick via main.js.
        currentAddress = address || null;
        // The parcel polygon + centroid drive the buildable-massing simulator.
        currentGeometry = geometry || null;
        currentLngLat = Array.isArray(lngLat) && lngLat.length === 2 ? lngLat : null;
        // The tile's zone columns feed the zone pill (see renderTarget).
        currentParcelProps = parcelProps && typeof parcelProps === 'object' ? parcelProps : null;
        clearDragStyles();
        aside.setAttribute('data-state', 'visible');
        aside.setAttribute('aria-hidden', 'false');
        // Paint the massing panel straight away off the geometry (real parcel-area
        // fills in once /score/similoo resolves — see loadFor). Renders nothing
        // unless the panel is on the Build topic.
        renderMassing();
        renderBuildEmpty();
        // The phone footer's "Open in" hand-off follows the picked point.
        renderFooter();
        loadFor(egrid);
    }

    // Replace the address the panel is titled with, without touching the parcel
    // it is showing. A ?lat/?lng deep link opens on a text label that is only a
    // hint (see main.js / deepLinkAddress.js); the address resolved from the
    // parcel's own identity lands a moment later and must overwrite it in the
    // identity header AND in the Track chip's save record. Re-calling show()
    // would refetch the comparables for a parcel that has not changed, so this
    // re-renders off the data already in hand.
    function setAddress(address) {
        const next = address || null;
        if (next === currentAddress) return;
        currentAddress = next;
        // Before the comparables land there is nothing rendered to update: the
        // panel is still a skeleton and renderTarget() will pick the new value
        // up on its first pass.
        if (currentData?.target) renderTarget();
    }

    function hide() {
        clearDragStyles();
        aside.setAttribute('data-state', 'hidden');
        aside.setAttribute('aria-hidden', 'true');
        currentEgrid = null;
        currentAddress = null;
        currentData = null;
        currentGeometry = null;
        currentLngLat = null;
        currentParcelProps = null;
        // Data is gone — disable the "{}" toggle and drop back to the normal body.
        syncRawAvailability();
        // Drop the Track button's parcel binding so a stale tracked-state can't
        // flash when the next parcel opens.
        saveParcel.setParcel(null);
        // Tear the massing preview down (drops its RES fetch + 3D scene) so the
        // next parcel starts clean.
        renderMassing();
        renderBuildEmpty();
        // Coordinates are gone → the footer "Open in" empties out (CSS collapses
        // the empty slot entirely).
        renderFooter();
        // Same for the candidate-pool note: no data, nothing to explain.
        renderPoolNote();
        onUnhoverComparable?.();
    }

    // --- Mobile footer: full-width "Open in" hand-off (shared React menu) -----
    //
    // similoo has no Claire assistant, so the Aireon mobile data-card footer is
    // the single full-width "Open in" row (no 85/15 split). The shared drop-up
    // is a React component; like the massing simulator it mounts imperatively
    // into a stable `.cmp-footer` slot via its own lazily created root. With no
    // coordinates it renders nothing and the slot collapses via CSS. Desktop
    // keeps the footer hidden entirely (comparison.css shows it only inside the
    // phone media block).
    function renderFooter() {
        if (!els.footer) return;
        if (!footerRoot) footerRoot = createRoot(els.footer);
        const lng = Array.isArray(currentLngLat) ? Number(currentLngLat[0]) : null;
        const lat = Array.isArray(currentLngLat) ? Number(currentLngLat[1]) : null;
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
        footerRoot.render(
            hasCoords
                ? createElement(ParcelOpenInMenu, {
                    lat,
                    lng,
                    label: t('comparison.open_in'),
                    darkMode: document.documentElement.classList.contains('dark'),
                    currentAppId: 'similoo',
                    fullWidth: true,
                })
                : null,
        );
    }

    // --- Topic tabs (shared React component) ---------------------------------
    //
    // The panel's only navigation axis (PANEL_TABS_STANDARD.md T1). Like the
    // massing simulator and the footer menu, the shared <PanelTopicTabs> is
    // mounted into a stable `.cmp-topics` div via its own lazily created React
    // root. It is a CONTROLLED component: this module owns `topic`, so the tab
    // row and the imperative body can never disagree.
    function renderTopicTabs() {
        if (!els.topics) return;
        if (!topicsRoot) {
            topicsRoot = createRoot(els.topics);
            watchPanelTheme();
        }
        topicsRoot.render(
            createElement(PanelTopicTabs, {
                tabs: [
                    // similoo owns its headline topic and its label...
                    { id: 'compare', label: t('comparison.topic_compare') },
                    // ...but `build` is canonical: id, label and section all
                    // come from shared (T6), so it reads the same word here as
                    // in roofs, footprint and geopool.
                    { id: 'build', label: getPanelTopicLabels(getLocale()).build },
                ],
                value: topic,
                onChange: selectTopic,
                ariaLabel: t('comparison.topic_selector'),
                panelId: TOPIC_PANEL_ID,
                dark: document.documentElement.classList.contains('dark'),
            }),
        );
    }

    function selectTopic(next) {
        if (!PANEL_TOPICS.includes(next) || next === topic) return;
        topic = next;
        writeStoredTopic(topic);
        applyTopic();
    }

    // Push the current topic through the panel: the aside's `data-topic`
    // switches the vanilla sections (comparison.css), the tabpanel re-points
    // its aria-labelledby at the newly selected tab, and the massing simulator
    // mounts or unmounts.
    function applyTopic() {
        aside.setAttribute('data-topic', topic);
        els.topicPanel?.setAttribute('aria-labelledby', `${TOPIC_PANEL_ID}-tab-${topic}`);
        renderTopicTabs();
        renderMassing();
        renderBuildEmpty();
    }

    // --- Buildable-massing simulator (shared React component) ----------------
    //
    // similoo's sidebar is imperative vanilla DOM, so the shared
    // <BuildableMassingSection> is mounted into a stable `.cmp-massing` div via
    // its own React root (created lazily, reused across parcels). It renders
    // NOTHING when there's no geometry and no real spare_space candidate, so the
    // `.cmp-massing` container stays empty (and collapsed — see comparison.css)
    // until there's something to show.
    //
    // It is UNMOUNTED, not hidden, whenever the panel is on another topic: the
    // simulator builds a MapLibre map, and a MapLibre map created inside a
    // `display: none` box initialises at zero height and never recovers. Not
    // mounting it also spares the RES spare_space fetch and the 3D scene for
    // anyone who never opens the tab.
    function renderMassing() {
        if (!els.massing) return;
        if (!massingRoot) {
            massingRoot = createRoot(els.massing);
            watchPanelTheme();
        }
        const target = currentData?.target;
        const areaM2 = Number.isFinite(target?.parcel_area_m2) ? target.parcel_area_m2 : null;
        const active = topic === 'build' && !!currentEgrid;
        massingRoot.render(
            active
                ? createElement(BuildableMassingSection, {
                    geometry: currentGeometry,
                    areaM2,
                    egrid: currentEgrid || undefined,
                    lngLat: currentLngLat,
                    dark: document.documentElement.classList.contains('dark'),
                    locale: getLocale(),
                    className: 'cmp-massing-inner',
                    onError: (err) => console.warn('massing render error:', err?.message || err),
                })
                : null,
        );
    }

    // A Build tab with nothing to simulate would otherwise be a blank tab. The
    // simulator needs either the parcel polygon or a point to look a real
    // spare_space candidate up from; when the pick handed us neither, say so in
    // one quiet line. Deliberately NOT driven off `.cmp-massing:empty` — the
    // container is empty for a frame while React commits, which would flash the
    // note on every parcel.
    function renderBuildEmpty() {
        if (!els.buildEmpty) return;
        const hasSubject = !!currentEgrid && !!(currentGeometry || currentLngLat);
        els.buildEmpty.textContent = hasSubject ? '' : t('comparison.build_empty');
    }

    // The app theme is React-controlled (App.tsx flips both `.dark` and
    // `data-theme` on <html>); re-render the topic row, the massing preview AND
    // the footer "Open in" menu when it changes so their palettes follow live —
    // the same MutationObserver pattern the detail modal uses. Created once, on
    // first render.
    function watchPanelTheme() {
        if (panelThemeObserver) return;
        panelThemeObserver = new MutationObserver(() => {
            renderTopicTabs();
            renderMassing();
            renderFooter();
        });
        panelThemeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-theme'],
        });
    }

    async function loadFor(egrid) {
        const seq = ++fetchSeq;
        setStatus('loading');
        // First fetch for this parcel → skeleton placeholders. On a ladder-step
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
            // Real parcel-area is now known — re-render massing so its lite
            // estimate is sized off the true parcel size.
            renderMassing();
            setStatus(data?.comparables?.length ? 'ready' : 'empty');
            // Enable the "{}" toggle now that there's data; keep the raw view in
            // sync if it's already open (e.g. a ladder refetch of the same parcel).
            syncRawAvailability();
            if (showRaw) renderRaw();
            if (typeof onDataLoaded === 'function') onDataLoaded(data);
        } catch (err) {
            if (seq !== fetchSeq) return;
            console.error('similoo fetch failed:', err);
            // Drop the first-load skeleton; a refetch keeps the prior content.
            if (!currentData) {
                els.list.innerHTML = '';
                els.identity.hidden = true;
                els.identity.innerHTML = '';
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
        renderPoolNote();
        els.targetEmpty.hidden = true;
        els.identity.hidden = false;
        els.targetSection.hidden = false;
        // Identity block (above the topic tabs) — aerial thumbnail, title and
        // the two identifier chips.
        els.identity.innerHTML = `
            <div class="cmp-idh-row" style="margin-bottom:10px;">
                <div class="skeleton" style="height:${AERIAL_SIZE_PX}px;width:${AERIAL_SIZE_PX}px;border-radius:8px;flex:none;"></div>
                <div class="cmp-target-meta">
                    <div class="skeleton" style="height:14px;width:85%;"></div>
                    <div class="skeleton" style="height:12px;width:60%;"></div>
                </div>
            </div>
            <div class="cmp-id-grid">
                <div class="skeleton" style="height:28px;border-radius:6px;flex:1 1 0;"></div>
                <div class="skeleton" style="height:28px;border-radius:6px;flex:1 1 0;"></div>
            </div>
        `;
        // Compare-tab body — the ratioV hero band and the two pill groups.
        els.targetSection.innerHTML = `
            <div class="cmp-target-head">
                <div class="skeleton" style="height:74px;border-radius:14px;"></div>
            </div>
            <div class="cmp-target-pills">
                ${skeletonPillGroup([70, 96])}
                ${skeletonPillGroup([78, 62, 70, 58, 88])}
            </div>
        `;
        els.list.innerHTML = SKELETON_CARD.repeat(6);
    }

    // The properties bag the zone pill resolves from: the /score/similoo target
    // row with the picked tile's zone columns laid over it. The tile is the
    // authoritative source for the zone columns (the row's `cz_abbrev` is
    // really cz_canton on the wire), and it carries the full chain the shared
    // resolver may fall back through; when the tile pick missed, the row's own
    // municipal `cz_local` resolves on its own. Still one label per parcel:
    // the municipal designation, via resolveZoneLabel(), never a raw read.
    function zoneSource(target) {
        const merged = { ...(target || {}) };
        if (currentParcelProps) {
            for (const field of ZONE_FIELDS) {
                if (currentParcelProps[field] != null && currentParcelProps[field] !== '') {
                    merged[field] = currentParcelProps[field];
                }
            }
        }
        return merged;
    }

    function renderTarget() {
        const target = currentData?.target;
        if (!target) {
            els.identity.hidden = true;
            els.identity.innerHTML = '';
            els.targetSection.hidden = true;
            els.targetSection.innerHTML = '';
            els.targetEmpty.hidden = false;
            // No target on show -> no Track chip in the header either.
            saveParcel.setParcel(null);
            return;
        }
        els.targetEmpty.hidden = true;
        els.identity.hidden = false;
        els.targetSection.hidden = false;
        const ratioV = Number.isFinite(target.ratioV)
            ? target.ratioV
            : (target.building_volume_m3 && target.parcel_area_m2
                ? target.building_volume_m3 / target.parcel_area_m2
                : null);
        const egrid = target.egrid || currentEgrid || null;
        // Attribute block: two compact pill sections (Parcel → Building) in the
        // canonical order of DATA_PILLS_STANDARD.md — area/size first, then
        // counts and dimensions. The ratioV hero above is a headline figure, not
        // a raw attribute, so it stays outside the groups; EGRID and the
        // coordinates stay in the identity header and are never repeated as
        // pills. Missing values drop their pill entirely (never a row of
        // dashes), and a section with nothing to show renders nothing.
        // The identity block sits ABOVE the topic tabs and is the same on every
        // topic, so it renders into its own container rather than into the
        // Compare tab's body.
        els.identity.innerHTML = identityHeaderHtml(egrid);
        els.targetSection.innerHTML = `
            <div class="cmp-target-head">
                <div class="cmp-target-ratiov">
                    <div class="cmp-target-ratiov-value">${formatRatio(ratioV)}</div>
                    <div class="cmp-target-ratiov-label">${escapeHtml(t('comparison.metric_ratiov'))}</div>
                </div>
            </div>
            <div class="cmp-target-pills">
                ${dataPillGroupHtml(t('comparison.section_parcel'), [
                    {
                        value: Number.isFinite(target.parcel_area_m2) ? formatM2(target.parcel_area_m2) : null,
                        title: t('comparison.metric_parcel_size'),
                    },
                    {
                        label: t('comparison.metric_zoning'),
                        value: resolveZoneLabel(zoneSource(target)),
                    },
                ])}
                ${dataPillGroupHtml(t('comparison.section_building'), [
                    {
                        value: Number.isFinite(target.footprint_m2) ? formatM2(target.footprint_m2) : null,
                        title: t('comparison.metric_footprint'),
                    },
                    {
                        label: t('comparison.metric_floors'),
                        value: target.floors != null ? String(target.floors) : null,
                    },
                    {
                        label: t('comparison.metric_year'),
                        value: target.construction_year != null ? String(target.construction_year) : null,
                    },
                    {
                        value: Number.isFinite(target.height_m) ? formatM(target.height_m) : null,
                        title: t('comparison.metric_height'),
                    },
                    {
                        value: Number.isFinite(target.building_volume_m3) ? formatM3(target.building_volume_m3) : null,
                        title: t('comparison.metric_volume'),
                    },
                ])}
            </div>
        `;
        bindIdentityHeader();
        syncTrackButton(egrid);
    }

    // Point the persistent header Track chip at the current target parcel.
    // The button module keeps its resolved tracked-state when the parcel id
    // is unchanged (e.g. the copy-chip reset re-render), so this never
    // re-queries PRM needlessly.
    function syncTrackButton(egrid) {
        if (!egrid) {
            saveParcel.setParcel(null);
            return;
        }
        const target = currentData?.target;
        saveParcel.setParcel({
            id: egrid,
            label: currentAddress || egrid,
            municipality: target?.municipality || '',
            area: Number.isFinite(target?.parcel_area_m2) ? target.parcel_area_m2 : 0,
            lng: Array.isArray(currentLngLat) ? Number(currentLngLat[0]) : NaN,
            lat: Array.isArray(currentLngLat) ? Number(currentLngLat[1]) : NaN,
        });
    }

    // Suite-standard compact parcel identity header (Aireon mobile data-card
    // standard; mirrors the shared <ParcelPanelShell> compact header, reusing
    // its shipped `.aireon-pih-*` title/subtitle classes from map-ui.css).
    // Layout: a small swisstopo aerial thumbnail at the very top-left, the
    // searched street + house number as the title (split out of the flat
    // geocoder label per data-card header standard R6, falling back to the
    // municipality, then a localized "Selected parcel" — title text only,
    // never a badge) with the "ZIP · City" locality (fallback municipality)
    // as the muted subtitle beside it, then the two copyable
    // identifier pills (EGRID + Lat/Lng) on their own content-sized flex row —
    // side by side when they fit, each on its own full-width row when they do
    // not, but never with a wrapped value (data-card header standard R2). A
    // lone pill fills the row on its own. similoo's engine themes off
    // [data-theme="dark"], which both the shipped `.aireon-pih-*` rules and
    // the local `.cmp-id-chip` rules target, so no --dark flag is needed here.
    function identityHeaderHtml(egrid) {
        const target = currentData?.target;
        const municipality = target?.municipality || null;
        // Identity feed (data-card header standard R6): the geocoder hands the
        // sidebar a flat label ("Nüschelerstrasse 30 8001 Zürich"), which must
        // never be the title verbatim. Split it so the title carries only
        // street + house number and the "ZIP · City" locality drops to the
        // muted line below. Display-time only — `currentAddress` itself keeps
        // the full label because saveParcel and the deep-link consume it.
        const parts = parseSwissAddress(currentAddress);
        const title = parts.street ?? currentAddress ?? municipality ?? t('comparison.identity_fallback_title');
        // Locality line under the title, falling back to the municipality —
        // suppressed when it would just repeat the title (i.e. the
        // municipality is already up top because there is no address).
        const subtitle = parts.locality ?? (municipality && municipality !== title ? municipality : null);
        const copyEgridLabel = t('comparison.copy_egrid');
        const copyLatLngLabel = t('comparison.copy_latlng');
        const lng = Array.isArray(currentLngLat) ? Number(currentLngLat[0]) : null;
        const lat = Array.isArray(currentLngLat) ? Number(currentLngLat[1]) : null;
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
        const latLngText = hasCoords ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;
        const areaM2 = Number.isFinite(target?.parcel_area_m2) ? target.parcel_area_m2 : null;
        const aerialUrl = hasCoords
            ? buildSwisstopoAerialUrl(lng, lat, aerialThumbnailZoom(areaM2, lat, AERIAL_SIZE_PX), AERIAL_SIZE_PX)
            : null;
        const egridChip = egrid ? `
                    <button type="button" class="cmp-id-chip" data-copy="${escapeHtml(egrid)}" title="${escapeHtml(copyEgridLabel)}" aria-label="${escapeHtml(copyEgridLabel)}">
                        <span class="cmp-id-chip-label" aria-hidden="true">EGRID</span>
                        <span class="cmp-id-chip-value">${escapeHtml(egrid)}</span>
                        ${COPY_SVG}
                    </button>` : '';
        const latLngChip = latLngText ? `
                    <button type="button" class="cmp-id-chip" data-copy="${escapeHtml(latLngText)}" title="${escapeHtml(copyLatLngLabel)}" aria-label="${escapeHtml(copyLatLngLabel)}">
                        <span class="cmp-id-chip-label" aria-hidden="true">Lat/Lng</span>
                        <span class="cmp-id-chip-value">${escapeHtml(latLngText)}</span>
                        ${COPY_SVG}
                    </button>` : '';
        return `
            <div class="aireon-pih cmp-target-identity">
                <div class="cmp-idh-row">
                    ${aerialUrl ? `<img class="cmp-idh-aerial" src="${escapeHtml(aerialUrl)}" alt="${escapeHtml(t('comparison.aerial_alt'))}" width="${AERIAL_SIZE_PX}" height="${AERIAL_SIZE_PX}" loading="lazy" decoding="async" />` : ''}
                    <div class="aireon-pih-main">
                        <h2 class="aireon-pih-title">${escapeHtml(title)}</h2>
                        ${subtitle ? `
                        <p class="aireon-pih-subtitle">
                            ${PIN_SVG}
                            <span class="aireon-pih-subtitle-text">${escapeHtml(subtitle)}</span>
                        </p>` : ''}
                    </div>
                </div>
                ${(egridChip || latLngChip) ? `
                <div class="cmp-id-grid">${egridChip}${latLngChip}</div>
                <span role="status" aria-live="polite" class="sr-only"></span>` : ''}
            </div>
        `;
    }

    // Wire the copy-to-clipboard identifier pills after each renderTarget().
    // Mirrors the shared component's behavior: copy the chip's value (EGRID or
    // "lat, lng"), swap the value + icon to "Copied" for ~1.5s, announce it
    // politely, then revert via a full header re-render.
    let copyTimer = null;
    function bindIdentityHeader() {
        const chips = els.identity.querySelectorAll('.cmp-id-chip');
        if (!chips.length) return;
        const status = els.identity.querySelector('.aireon-pih [role="status"]');
        chips.forEach((chip) => {
            chip.addEventListener('click', async () => {
                const text = chip.dataset.copy;
                if (!text) return;
                try {
                    await navigator.clipboard?.writeText(text);
                } catch {
                    return;
                }
                const copiedLabel = t('comparison.copied');
                const valueEl = chip.querySelector('.cmp-id-chip-value');
                const iconEl = chip.querySelector('.cmp-id-chip-icon');
                chip.classList.add('cmp-id-chip--copied');
                if (valueEl) valueEl.textContent = copiedLabel;
                if (iconEl) iconEl.outerHTML = CHECK_SVG;
                chip.title = copiedLabel;
                chip.setAttribute('aria-label', copiedLabel);
                if (status) status.textContent = copiedLabel;
                if (copyTimer) clearTimeout(copyTimer);
                copyTimer = setTimeout(() => {
                    // Re-render the header to restore the idle value/icon state.
                    if (els.identity && currentData) renderTarget();
                }, 1500);
            });
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
            setStatus('empty');
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

    // Which candidate pool produced the list. /score/similoo starts from recent
    // GWR permits and falls back to the parcel table whenever that pool yields
    // fewer than five candidates — the normal outcome on a 5-year window. Say so
    // in one quiet line, otherwise a tight step just looks like a broken query.
    function renderPoolNote() {
        if (!els.poolNote) return;
        const fallback = currentData?.meta?.fallback_used;
        els.poolNote.textContent =
            fallback === 'parcel_table' ? t('comparison.pool_fallback') : '';
    }

    function renderMeta() {
        renderPoolNote();
        const meta = currentData?.meta;
        if (!meta) {
            els.meta.textContent = '';
            return;
        }
        const tag = meta.source === 'mock' ? t('comparison.meta_mock') : t('comparison.meta_live');
        const month = meta.gwr_month ? t('comparison.meta_gwr_month', { month: meta.gwr_month }) : '';
        els.meta.textContent = [tag, month].filter(Boolean).join(' · ');
    }

    // --- Raw-JSON developer view ---------------------------------------------
    //
    // Flip between the normal comparison body and a syntax-highlighted dump of
    // the full /api/similoo response ({ target, comparables, meta }). Which one
    // shows is driven entirely by the `data-raw` attribute on the aside (CSS
    // hides the body sections and reveals `.cmp-raw-wrap` when it is "true"), so
    // the normal body renders unchanged whenever showRaw is false.
    function setRaw(on) {
        showRaw = !!on && !!currentData;
        els.rawToggle.setAttribute('aria-pressed', showRaw ? 'true' : 'false');
        aside.setAttribute('data-raw', showRaw ? 'true' : 'false');
        if (showRaw) renderRaw();
    }

    function renderRaw() {
        if (!els.rawPre) return;
        els.rawPre.innerHTML = highlightJson(currentData);
    }

    // Enable the "{}" toggle only when there's data to serialize; drop back to
    // the normal body if the data went away while the raw view was open.
    function syncRawAvailability() {
        const has = !!currentData;
        els.rawToggle.disabled = !has;
        if (!has && showRaw) setRaw(false);
    }

    function relabel() {
        // Re-render every translatable string when the locale flips.
        aside.setAttribute('aria-label', t('comparison.title'));
        aside.querySelector('.cmp-title').textContent = t('comparison.title');
        aside.querySelector('.cmp-close').setAttribute('aria-label', t('comparison.close'));
        els.rawToggle.setAttribute('title', t('comparison.toggle_raw_json'));
        els.rawToggle.setAttribute('aria-label', t('comparison.toggle_raw_json'));
        els.rawTitle.textContent = t('comparison.raw_json');
        // Don't clobber a mid-flash "Copied" label when the locale flips.
        if (!els.rawCopy.classList.contains('is-copied')) {
            els.rawCopyLabel.textContent = t('comparison.copy');
        }
        aside.querySelector('.cmp-filters-title').textContent = t('comparison.filters_title');
        els.yearsLabel.textContent = t('comparison.years_window');
        // Ladder steps: the numeric ones show the bare number (the group label
        // supplies "years"), so each carries a spoken-out accessible name.
        for (const button of yearsSteps) {
            const step = button.dataset.years;
            if (step === ALL_YEARS) {
                button.textContent = t('comparison.years_all');
                button.setAttribute('aria-label', t('comparison.years_all_aria'));
                button.setAttribute('title', t('comparison.years_all_aria'));
            } else {
                button.textContent = step;
                button.setAttribute('aria-label', t('comparison.years_step_aria', { years: step }));
                button.setAttribute('title', t('comparison.years_step_aria', { years: step }));
            }
        }
        syncYearsLadder();
        aside.querySelector('.cmp-size-label').textContent = t('comparison.parcel_size_range');
        aside.querySelector('.cmp-size-from-label').textContent = t('comparison.parcel_size_from');
        aside.querySelector('.cmp-size-to-label').textContent = t('comparison.parcel_size_to');
        aside.querySelector('.cmp-list-title').textContent = t('comparison.list_title');
        aside.querySelector('.cmp-sort-label').textContent = t('comparison.sort_by');
        aside.querySelector('.cmp-target-empty').textContent = t('comparison.target_empty');

        const sortOpts = aside.querySelectorAll('.cmp-sort option');
        sortOpts.forEach((opt) => {
            const key = opt.value;
            opt.textContent = t(`comparison.sort_${key}`);
        });
        renderTarget();
        renderList();
        renderMeta();
        // Re-render the topic tabs — similoo owns the "Compare" label, `build`
        // comes from the shared canonical table, and both are locale-bound.
        renderTopicTabs();
        // Re-render the massing panel so its localized labels flip with the app.
        renderMassing();
        renderBuildEmpty();
        // Same for the footer "Open in" trigger label.
        renderFooter();
        if (els.status.dataset.state) setStatus(els.status.dataset.state);
    }

    onLocaleChange(() => relabel());
    // Reflect the resolved topic (?topic= / stored preference / default) onto
    // the panel before the first relabel paints it.
    applyTopic();
    relabel();

    function destroy() {
        onUnhoverComparable?.();
        panelThemeObserver?.disconnect();
        panelThemeObserver = null;
        // Unmount the React roots asynchronously — unmounting synchronously from
        // within another render pass trips a React warning; the container node
        // refs survive the aside.remove() below.
        if (massingRoot) {
            const root = massingRoot;
            massingRoot = null;
            setTimeout(() => {
                try { root.unmount(); } catch { /* already gone */ }
            }, 0);
        }
        if (footerRoot) {
            const root = footerRoot;
            footerRoot = null;
            setTimeout(() => {
                try { root.unmount(); } catch { /* already gone */ }
            }, 0);
        }
        if (topicsRoot) {
            const root = topicsRoot;
            topicsRoot = null;
            setTimeout(() => {
                try { root.unmount(); } catch { /* already gone */ }
            }, 0);
        }
        saveParcel.destroy();
        aside?.remove();
        aside = null;
    }

    function getCurrentData() {
        return currentData;
    }

    return { show, setAddress, hide, destroy, getCurrentData };
}

// ---------- DOM shell -----------------------------------------------------

// One <button role="radio"> per ladder step, generated from YEARS_LADDER so
// the steps are declared exactly once (src/js/yearsWindow.js). Labels are
// filled in by relabel(); the default step starts selected and is the only
// one in the tab order.
function yearsLadderMarkup() {
    return YEARS_LADDER.map((step) => {
        const active = step === DEFAULT_YEARS;
        return `<button type="button" role="radio" class="cmp-years-step"`
            + ` data-years="${step}" aria-checked="${active ? 'true' : 'false'}"`
            + ` tabindex="${active ? '0' : '-1'}"></button>`;
    }).join('');
}

function buildShell() {
    const aside = document.createElement('aside');
    aside.className = 'cmp';
    // Floating chrome — excluded from the "Save image" map capture.
    aside.setAttribute('data-screenshot-ignore', 'true');
    aside.setAttribute('data-state', 'hidden');
    aside.setAttribute('data-topic', DEFAULT_PANEL_TOPIC);
    aside.setAttribute('aria-hidden', 'true');
    aside.setAttribute('role', 'complementary');
    aside.setAttribute('aria-label', 'Comparable buildings');
    aside.innerHTML = `
        <div class="cmp-grab" aria-hidden="true"><span class="cmp-grab-bar"></span></div>
        <header class="cmp-header">
            <h2 class="cmp-title"></h2>
            <button class="cmp-raw-toggle" type="button" aria-pressed="false" disabled>
                <i data-lucide="braces"></i>
            </button>
            <button class="cmp-close" type="button" aria-label="Close">
                <i data-lucide="x"></i>
            </button>
        </header>

        <!-- Developer "{}" raw-JSON view. Replaces the normal panel body when the
             header toggle is on; renders the full /api/similoo response (target +
             comparables + meta) as syntax-highlighted JSON. Hidden by default and
             collapsed via CSS unless the panel carries data-raw="true". Note the
             payload is often the deterministic MOCK (meta.source === "mock") until
             the RES /score/similoo backend is live. -->
        <section class="cmp-section cmp-raw-wrap">
            <div class="cmp-raw-head">
                <span class="cmp-raw-title"></span>
                <button class="cmp-raw-copy" type="button">
                    <i data-lucide="copy"></i>
                    <span class="cmp-raw-copy-label"></span>
                </button>
            </div>
            <pre class="cmp-raw"></pre>
        </section>

        <!-- Parcel identity header + the panel's topic row. The identity block
             is this panel's shell header (PANEL_ACTIONS_STANDARD.md R4) and is
             the same on every topic, so it sits ABOVE the tabs; the full-width
             track under it is what separates the panel's header from its body
             (PANEL_TABS_STANDARD.md). -->
        <section class="cmp-section cmp-identity-wrap">
            <div class="cmp-identity"></div>
            <div class="cmp-topics"></div>
        </section>

        <div class="cmp-topic-panel" id="${TOPIC_PANEL_ID}" role="tabpanel" tabindex="0" aria-labelledby="${TOPIC_PANEL_ID}-tab-${DEFAULT_PANEL_TOPIC}">
        <!-- cmp-target and cmp-target-empty are siblings on purpose: exactly
             one of them is ever visible, so this section is never an empty box
             painting 32px of padding and a stray divider straight under the
             tab row (which is what a fetch error, or a /score/similoo payload
             with no target, would otherwise produce). -->
        <section class="cmp-section cmp-target-wrap">
            <div class="cmp-target"></div>
            <div class="cmp-target-empty"></div>
        </section>

        <!-- Subject-parcel buildable-massing simulator (shared React component
             mounted here imperatively) — the "Build" topic. Stays empty —
             collapsed, no chrome — when the component finds no footprint to
             render, and is UNMOUNTED entirely while another topic is showing
             (see renderMassing). -->
        <div class="cmp-massing"></div>
        <div class="cmp-build-empty"></div>

        <details class="cmp-section cmp-filters">
            <summary class="cmp-section-title cmp-filters-title"></summary>
            <div class="cmp-filter-body">
            <div class="cmp-filter-row cmp-filter-years">
                <span class="cmp-years-label" id="cmp-years-label"></span>
                <div class="cmp-years-ladder" role="radiogroup" aria-labelledby="cmp-years-label">
                    ${yearsLadderMarkup()}
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
            </div>
        </details>

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
            <!-- Which candidate pool answered. /score/similoo prefers recent GWR
                 permits and silently falls back to the parcel table when that
                 pool is too thin (meta.fallback_used === "parcel_table"), which
                 a 5-year window hits almost every time — one quiet line so a
                 narrow step reads as sparse data, not as a broken app. -->
            <p class="cmp-pool-note"></p>
            <div class="cmp-list"></div>
            <div class="cmp-meta"></div>
        </section>
        </div>

        <!-- Phone footer (Aireon mobile data-card standard): the shared
             "Open in" drop-up mounts here via React (see renderFooter). similoo
             has no Claire assistant, so this is the single full-width variant.
             Kept empty (and collapsed by CSS) on desktop and while no parcel
             coordinates are loaded. -->
        <div class="cmp-footer"></div>
    `;
    return aside;
}

// ---------- helpers -------------------------------------------------------

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

// --- Suite data pills (DATA_PILLS_STANDARD.md, @aireon/shared v1.135.0) -------
//
// The shared <DataPillGroup> / <DataPill> pair is React; this sidebar builds its
// DOM from innerHTML strings, so it hand-rolls the exact same markup and
// `.aireon-datapill*` classes that ship in map-ui.css — the approach the
// identity header above already takes with `.aireon-pih-*`. Keeping the class
// contract identical means the pills render the same here as in every React app
// in the suite. similoo themes off [data-theme="dark"], which the shipped rules
// target directly, so no `--dark` flag is needed.

// One fit-content pill. A nullish/empty value renders nothing so callers can
// list every candidate field and let the missing ones fall away. `label` is a
// short uppercase prefix for values that are ambiguous on their own ("FLOORS:
// 3"); `title` is the hover/a11y meaning for values that already carry a unit
// ("658 m²").
function dataPillHtml({ label, value, title, mono, emphasis } = {}) {
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
function dataPillGroupHtml(heading, items) {
    const pills = items.map(dataPillHtml).filter(Boolean);
    if (!pills.length) return '';
    return `
        <section class="aireon-datapill-group" aria-label="${escapeHtml(heading)}">
            <h3 class="aireon-datapill-heading">${escapeHtml(heading)}</h3>
            <div class="aireon-datapill-row">${pills.join('')}</div>
        </section>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Pretty-print any value to JSON, falling back to String() if it can't be
// serialized (e.g. a cyclic structure) so the copy/raw view never throws.
function safeStringify(value) {
    try {
        const json = JSON.stringify(value, null, 2);
        return json === undefined ? String(value) : json;
    } catch {
        return String(value);
    }
}

// Colourise a JSON dump for the "{}" raw view, mirroring groove's JsonHighlight:
// keys sky, strings emerald, booleans amber, null red, numbers orange, the rest
// muted. Each token is HTML-escaped before it goes into the span so the result
// is safe to assign via innerHTML.
function highlightJson(value) {
    const json = safeStringify(value);
    const tokenRe = /("(?:[^"\\]|\\.)*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    let out = '';
    let lastIndex = 0;
    let match;
    while ((match = tokenRe.exec(json)) !== null) {
        if (match.index > lastIndex) {
            out += `<span class="cmp-raw-punct">${escapeHtml(json.slice(lastIndex, match.index))}</span>`;
        }
        const token = match[0];
        let cls;
        if (/^"[^"]*"\s*:$/.test(token)) cls = 'cmp-raw-key';
        else if (/^"/.test(token)) cls = 'cmp-raw-str';
        else if (/^(true|false)$/.test(token)) cls = 'cmp-raw-bool';
        else if (/^null$/.test(token)) cls = 'cmp-raw-null';
        else cls = 'cmp-raw-num';
        out += `<span class="${cls}">${escapeHtml(token)}</span>`;
        lastIndex = match.index + token.length;
    }
    if (lastIndex < json.length) {
        out += `<span class="cmp-raw-punct">${escapeHtml(json.slice(lastIndex))}</span>`;
    }
    return out;
}
