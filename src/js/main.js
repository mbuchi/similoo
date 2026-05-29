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
import { resolveEgridFromLngLat, normaliseEgrid } from './comparison/parcelLookup.js';
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
    let currentTargetCzLocal = null;
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
                // Re-affirm the parcel paint once the sidebar data lands. The
                // highlight was already applied instantly from the tile at
                // pick time (see handlePick); the tile's own `cz_local` stays
                // authoritative so the green set never shifts when the slower
                // /score/similoo response arrives. We only fall back to the
                // backend's `cz_local` when the tile pick missed the parcel.
                const czLocal = currentTargetCzLocal || data?.target?.cz_local || null;
                if (czLocal && czLocal !== currentTargetCzLocal) {
                    currentTargetCzLocal = czLocal;
                }
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
        if (!map || !map.getLayer(BUILDING_LAYER)) return null;
        const point = map.project([lng, lat]);
        // Tight probe first — the searched address normally lands right on its
        // building footprint.
        let hits = map.queryRenderedFeatures(
            [
                [point.x - 8, point.y - 8],
                [point.x + 8, point.y + 8],
            ],
            { layers: [BUILDING_LAYER] },
        );
        // Fallback: the geocoded point can land just off the footprint (a
        // street entrance, or the parcel centroid for a large parcel). Widen
        // the search and take the building whose footprint centroid is nearest
        // the point, so we still light up the right building rather than none.
        if (!hits.length) {
            hits = map.queryRenderedFeatures(
                [
                    [point.x - 32, point.y - 32],
                    [point.x + 32, point.y + 32],
                ],
                { layers: [BUILDING_LAYER] },
            );
        }
        const target = nearestBuilding(hits, point);
        if (!target || target.id == null) return null;
        clearTargetHighlight();
        currentTargetBuildingId = target.id;
        map.setFeatureState(
            { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id: currentTargetBuildingId },
            { target: true },
        );
        document.body.classList.add('cmp-shifted');
        return target;
    }

    // Pick the building footprint whose centroid projects closest to `point`.
    // Falls back to the first id-bearing hit when geometry is unavailable.
    function nearestBuilding(hits, point) {
        if (!hits || !hits.length) return null;
        let best = null;
        let bestD = Infinity;
        for (const f of hits) {
            if (f.id == null) continue;
            const centroid = footprintCentroid(f.geometry);
            if (!centroid) {
                if (!best) best = f;
                continue;
            }
            const p = map.project(centroid);
            const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
            if (d < bestD) {
                bestD = d;
                best = f;
            }
        }
        return best;
    }

    function footprintCentroid(geom) {
        if (!geom) return null;
        const ring = geom.type === 'Polygon'
            ? geom.coordinates?.[0]
            : geom.type === 'MultiPolygon'
                ? geom.coordinates?.[0]?.[0]
                : null;
        if (!Array.isArray(ring) || !ring.length) return null;
        let x = 0;
        let y = 0;
        let n = 0;
        for (const pt of ring) {
            if (Array.isArray(pt) && pt.length >= 2) {
                x += pt[0];
                y += pt[1];
                n++;
            }
        }
        return n ? [x / n, y / n] : null;
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
        currentTargetCzLocal = null;
        applyZoneHighlight(map, { targetParcelId: null, czLocal: null });
    }

    async function handlePick(result) {
        if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lng)) return;
        const seq = ++pickSeq;

        await showComparison(result.label || formatLatLng(result.lat, result.lng));
        syncDeepLink(result);
        document.body.classList.add('cmp-shifted');

        // Switch the view *instantly* — jumpTo, not flyTo. The searched
        // address snaps into place on the next frame with zero fly animation.
        if (map) {
            map.jumpTo({
                center: [result.lng, result.lat],
                zoom: Math.max(16.5, map.getZoom()),
                pitch: 50,
                bearing: -25,
            });
        }

        // Pull the parcel under the searched point from the rendered tile. The
        // parcel tile carries everything the highlight needs — `cz_local` (the
        // zone) and `parcel_id` (promoted to feature.id, itself the CH-format
        // EGRID) — so we can highlight with no backend round-trip. We *poll*
        // queryRenderedFeatures rather than waiting for `idle`: the highlight
        // then appears the instant the tile under the point loads (faster than
        // waiting for the whole viewport to settle, and reliable on a cold
        // cache where `idle` can lag the actual feature availability).
        const parcelFeature = await retryUntil(
            () => pickParcelAt(result.lng, result.lat),
            () => seq === pickSeq,
        );
        if (seq !== pickSeq) return;
        currentTargetParcelId = parcelFeature?.id ?? null;
        currentTargetCzLocal = parcelFeature?.properties?.cz_local || null;

        // Instant highlight straight off the tile: the searched parcel goes
        // red, every parcel sharing its `cz_local` (similar building type)
        // goes green. No waiting on /score/similoo.
        applyZoneHighlight(map, {
            targetParcelId: currentTargetParcelId,
            czLocal: currentTargetCzLocal,
        });

        // Highlight the searched address's 3D building (red extrusion), polling
        // the building tile the same way.
        const target = await retryUntil(
            () => highlightTargetAt(result.lng, result.lat),
            () => seq === pickSeq,
        );
        if (seq !== pickSeq) return;

        // Resolve the EGRID for the comparison sidebar. The tile's parcel_id
        // is already the canonical CH-format EGRID, so prefer it directly —
        // that skips the /api/parcel network leg entirely. Only fall back to
        // the parcel_data lookup when the tile pick missed.
        let egrid = normaliseEgrid(currentTargetParcelId);
        if (!egrid) {
            try {
                const resolved = await resolveEgridFromLngLat(
                    { lng: result.lng, lat: result.lat },
                    parcelFeature ?? (target ? { properties: { parcel_id: target.id } } : null),
                );
                egrid = resolved?.egrid ?? null;
            } catch (err) {
                console.warn('egrid resolve failed:', err?.message);
            }
        }
        if (seq !== pickSeq) return;
        if (egrid) sidebar.show(egrid);
    }

    // Poll `fn` until it returns a truthy value or we exhaust the budget. Used
    // to wait for vector-tile features under the searched point to render after
    // an instant jumpTo. ~3 s budget covers a cold-cache tile fetch; in the
    // common warm case the very first call already hits.
    async function retryUntil(fn, stillCurrent, { tries = 15, gap = 200 } = {}) {
        for (let i = 0; i < tries; i++) {
            if (stillCurrent && !stillCurrent()) return null;
            const r = fn();
            if (r) return r;
            await waitMs(gap);
        }
        return (!stillCurrent || stillCurrent()) ? fn() : null;
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
