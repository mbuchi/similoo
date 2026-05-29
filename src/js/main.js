import './i18n.js';

import {
    initializeViewer,
    BUILDING_SOURCE,
    BUILDING_SOURCE_LAYER,
    BUILDING_LAYER,
    PARCEL_FILL_LAYER,
    applyZoneHighlight,
} from './viewer/viewerConfig.js';
import { applyTranslations, bindLocaleSelect, t } from './i18n.js';
import { createComparisonSidebar } from './comparison/sidebar.js';
import { resolveEgridFromLngLat } from './comparison/parcelLookup.js';
import { bindLandingSearch } from './landing/addressSearch.js';
import { createComparableMarkers } from './viewer/comparableMarkers.js';
import { createBuildingDetailModal } from './detail/buildingDetailModal.js';

// Apply translations as soon as the static DOM is parsed.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

function boot() {
    applyTranslations(document);
    bindLocaleSelect('locale-select');
    setupThemeToggle();

    const landingView = document.getElementById('landingView');
    const comparisonView = document.getElementById('comparisonView');
    const comparisonAddress = document.getElementById('comparisonAddress');
    const backBtn = document.getElementById('backToSearch');
    const input = document.getElementById('landingSearchInput');
    const list = document.getElementById('landingResults');

    let map = null;
    let sidebar = null;
    let markers = null;
    let detailModal = null;
    let currentTargetBuildingId = null;
    let currentTargetParcelId = null;
    let pickSeq = 0;

    async function ensureMap() {
        if (map) return map;
        try {
            map = await initializeViewer('mapContainer');
            window.__similooMap = map; // exposed for browser-driven tests
        } catch (e) {
            console.error('Error initializing viewer:', e);
            throw e;
        }
        return map;
    }

    function ensureDetailModal() {
        if (detailModal) return detailModal;
        detailModal = createBuildingDetailModal();
        return detailModal;
    }

    function openDetail(c) {
        if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
        const modal = ensureDetailModal();
        modal.show({
            lat: c.lat,
            lng: c.lng,
            label: c.address || c.egrid || formatLatLng(c.lat, c.lng),
            subtitle: composeSubtitle(c),
        });
    }

    function composeSubtitle(c) {
        const parts = [];
        if (c.cz_local || c.cz_abbrev) parts.push(c.cz_local || c.cz_abbrev);
        if (Number.isFinite(c.construction_year)) parts.push(String(c.construction_year));
        if (Number.isFinite(c.ratioV)) parts.push(`ratioV ${c.ratioV.toFixed(2)}`);
        return parts.join(' · ');
    }

    function ensureSidebar() {
        if (sidebar) return sidebar;
        sidebar = createComparisonSidebar({
            map,
            onClose: () => {
                clearTargetHighlight();
                clearZoneHighlight();
                markers?.clear();
                document.body.classList.remove('cmp-shifted');
            },
            onSelectComparable: (c) => openDetail(c),
            onHoverComparable: (c) => markers?.highlightId(c?.egrid || null),
            onUnhoverComparable: () => markers?.highlightId(null),
            onFlyTo: (c) => {
                if (!map || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
                map.flyTo({
                    center: [c.lng, c.lat],
                    zoom: Math.max(map.getZoom(), 16.5),
                    pitch: 50,
                    bearing: -25,
                    speed: 1.2,
                    essential: true,
                });
            },
            onDataLoaded: (data) => {
                // Comparable mini-cubes on the map.
                markers?.setComparables(data?.comparables || []);
                // Paint the parcel layer by zoning. `cz_local` comes from
                // the /score/similoo response; `currentTargetParcelId` was
                // picked up from the parcel vector tile at handlePick time.
                const czLocal = data?.target?.cz_local || null;
                applyZoneHighlight(map, {
                    targetParcelId: currentTargetParcelId,
                    czLocal,
                });
            },
        });
        return sidebar;
    }

    function ensureMarkers() {
        if (markers) return markers;
        markers = createComparableMarkers({
            map,
            onSelect: (c) => openDetail(c),
            onHover: () => {},
            onUnhover: () => {},
        });
        return markers;
    }

    async function showComparison(label) {
        landingView.hidden = true;
        comparisonView.hidden = false;
        comparisonAddress.textContent = label;
        await ensureMap();
        ensureSidebar();
        ensureMarkers();
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    function showLanding() {
        comparisonView.hidden = true;
        landingView.hidden = false;
        clearTargetHighlight();
        clearZoneHighlight();
        markers?.clear();
        if (sidebar) {
            sidebar.hide();
            document.body.classList.remove('cmp-shifted');
        }
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 50);
        }
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('lat');
            url.searchParams.delete('lng');
            url.searchParams.delete('label');
            window.history.replaceState({}, '', url.toString());
        } catch {}
    }

    backBtn?.addEventListener('click', showLanding);

    // Paints the building feature at (lat, lng) as the "target". MapLibre
    // can only setFeatureState on features that have a stable id, so we
    // queryRenderedFeatures at the lat/lng's projected point and use the
    // feature with the largest area among the hits (most reliable when
    // the click point straddles two adjacent buildings).
    function highlightTargetAt(lng, lat) {
        if (!map) return null;
        const point = map.project([lng, lat]);
        // Probe a small box so we still hit the building even if the
        // projected pixel falls on an edge.
        const hits = map.queryRenderedFeatures(
            [
                [point.x - 4, point.y - 4],
                [point.x + 4, point.y + 4],
            ],
            { layers: [BUILDING_LAYER] },
        );
        if (!hits.length) return null;
        const target = hits[0];
        if (target.id == null) return null;
        clearTargetHighlight();
        currentTargetBuildingId = target.id;
        map.setFeatureState(
            { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id: currentTargetBuildingId },
            { target: true },
        );
        document.body.classList.add('cmp-shifted');
        return target;
    }

    function clearTargetHighlight() {
        if (!map || currentTargetBuildingId == null) return;
        map.setFeatureState(
            { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id: currentTargetBuildingId },
            { target: false },
        );
        currentTargetBuildingId = null;
    }

    // Pull the parcel feature under (lng,lat) from the parcel vector tile.
    // Used to know which parcel_id should be painted red in the zone view;
    // also doubles as the resolved parcel for the EGRID lookup fallback.
    function pickParcelAt(lng, lat) {
        if (!map || !map.getLayer(PARCEL_FILL_LAYER)) return null;
        const point = map.project([lng, lat]);
        const hits = map.queryRenderedFeatures(
            [
                [point.x - 4, point.y - 4],
                [point.x + 4, point.y + 4],
            ],
            { layers: [PARCEL_FILL_LAYER] },
        );
        if (!hits.length) return null;
        return hits[0];
    }

    function clearZoneHighlight() {
        currentTargetParcelId = null;
        applyZoneHighlight(map, { targetParcelId: null, czLocal: null });
    }

    async function handlePick(result) {
        if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lng)) return;
        const seq = ++pickSeq;

        await showComparison(result.label || formatLatLng(result.lat, result.lng));
        syncDeepLink(result);

        // Fly first so the building tile renders for the queryRenderedFeatures
        // probe below. We need ~zoom 16+ for the buildings vector tile.
        await flyToWaitForIdle(result);
        if (seq !== pickSeq) return;

        // First-pass highlight from rendered tiles. We retry once after a
        // short delay because the buildings tile sometimes finishes
        // rendering a tick after `idle` fires.
        let target = highlightTargetAt(result.lng, result.lat);
        if (!target) {
            await waitMs(250);
            if (seq !== pickSeq) return;
            target = highlightTargetAt(result.lng, result.lat);
        }

        // Capture the parcel under the click so the zone-highlight layer can
        // paint that parcel red once the /score/similoo response arrives.
        // `parcel_id` is promoted to feature.id by the parcels source.
        const parcelFeature = pickParcelAt(result.lng, result.lat);
        currentTargetParcelId = parcelFeature?.id ?? null;

        // Resolve EGRID and kick off the sidebar in parallel with the
        // map highlight — sidebar fetch is the slowest leg.
        try {
            const { egrid } = await resolveEgridFromLngLat(
                { lng: result.lng, lat: result.lat },
                parcelFeature ?? (target ? { properties: { parcel_id: target.id } } : null),
            );
            if (seq !== pickSeq) return;
            if (egrid) {
                document.body.classList.add('cmp-shifted');
                sidebar.show(egrid);
            }
        } catch (err) {
            console.warn('comparison flow failed:', err?.message);
        }
    }

    function flyToWaitForIdle(result) {
        return new Promise((resolve) => {
            if (!map) return resolve();
            map.flyTo({
                center: [result.lng, result.lat],
                zoom: Math.max(16.5, map.getZoom()),
                pitch: 50,
                bearing: -25,
                speed: 1.4,
                essential: true,
            });
            const onIdle = () => {
                map.off('idle', onIdle);
                resolve();
            };
            map.on('idle', onIdle);
            // Safety net: don't hang forever if the tile server stalls.
            setTimeout(() => {
                map.off('idle', onIdle);
                resolve();
            }, 4500);
        });
    }

    function waitMs(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    function syncDeepLink(result) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('lat', String(result.lat));
            url.searchParams.set('lng', String(result.lng));
            if (result.label) url.searchParams.set('label', result.label);
            else url.searchParams.delete('label');
            window.history.replaceState({}, '', url.toString());
        } catch { /* no-op */ }
    }

    if (input && list) {
        bindLandingSearch({ input, list, onPick: handlePick });
        setTimeout(() => input.focus(), 80);
    }

    // Deep-link bootstrap: ?lat=&lng= skips the landing view and renders
    // the comparison immediately. Useful for sharing and headless tests.
    try {
        const params = new URLSearchParams(window.location.search);
        const rawLat = params.get('lat');
        const rawLng = params.get('lng');
        if (rawLat != null && rawLng != null) {
            const lat = Number(rawLat);
            const lng = Number(rawLng);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                const label = params.get('label') || formatLatLng(lat, lng);
                handlePick({ lat, lng, label });
            }
        }
    } catch (_) { /* no-op */ }

    if (window.lucide?.createIcons) window.lucide.createIcons();
}

function formatLatLng(lat, lng) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// Minimal dark-mode toggle — mirrors the pre-paint bootstrap in index.html.
function setupThemeToggle() {
    const btn = document.getElementById('themeToggleButton');
    if (!btn) return;
    const root = document.documentElement;
    const sync = () => {
        const isDark = root.getAttribute('data-theme') === 'dark';
        btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    };
    btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try {
            localStorage.setItem('similoo-theme', next);
        } catch {}
        sync();
    });
    sync();
}
