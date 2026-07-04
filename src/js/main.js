import './i18n.js';

import {
    initializeViewer,
    BUILDING_SOURCE,
    BUILDING_SOURCE_LAYER,
    BUILDING_LAYER,
    PARCEL_FILL_LAYER,
    applyZoneHighlight,
} from './viewer/viewerConfig.js';
import { applyTranslations, t } from './i18n.js';
import { createComparisonSidebar } from './comparison/sidebar.js';
import { resolveEgridFromLngLat, normaliseEgrid } from './comparison/parcelLookup.js';
import { bindLandingSearch } from './landing/addressSearch.js';
import { createBuildingDetailModal } from './detail/buildingDetailModal.js';
import { createMapLegend } from './viewer/mapLegend.js';
import { initMethodologyHelp } from './help/methodologyPanel.js';

// similoo's imperative engine entry point.
//
// This module owns the full app behaviour: map setup, the Three.js building
// scene, the comparison sidebar + panels, address search, deep-linking,
// theme/locale/overflow navbar wiring, auth and the bug-report widget. It was
// the vanilla `<script type="module">` entry; in the React shell it is invoked
// once from a useEffect after App.tsx has rendered the static DOM scaffold
// (navbar / landing view / comparison view) with the same ids/classes the
// vanilla index.html had — so every getElementById / querySelector below
// resolves exactly as before. The shell is React; the engine is preserved
// verbatim. `boot()` is idempotent-guarded by the caller.
export function boot() {
    applyTranslations(document);
    // Methodology help keeps its Esc / hash / deep-link handling here; its open
    // trigger is the React navbar Help button (see App.tsx). The navbar, theme,
    // locale switch, account menu, release notes and bug report are now owned by
    // the shared suite chrome in the React shell — boot() no longer wires them.
    initMethodologyHelp();

    const landingView = document.getElementById('landingView');
    const comparisonView = document.getElementById('comparisonView');
    const input = document.getElementById('landingSearchInput');
    const list = document.getElementById('landingResults');

    // Mirror the active parcel's address up to the React navbar (its address
    // search box surfaces it). The old in-view "Search again" bar that used to
    // render the label is gone — the navbar search is the single search surface.
    // lat/lng are also forwarded so the React shell can power the "Open with" menu.
    function emitAddress(label, lat, lng) {
        const value = label || '';
        try {
            window.__similooAddress = value;
            window.dispatchEvent(new CustomEvent('similoo:address', { detail: { label: value, lat, lng } }));
        } catch { /* no CustomEvent (very old engine host) — non-fatal */ }
    }

    let map = null;
    let sidebar = null;
    let detailModal = null;
    let legend = null;
    // Every building inside the searched parcel is painted red (the `target`
    // feature-state). We track the full set of resolved building ids so we can
    // clear them all at once and so the comparable pass never recolours one.
    const targetBuildingIds = new Set();
    let currentTargetParcelId = null;
    let currentTargetCzLocal = null;
    let currentComparables = [];
    // comparable parcel EGRID → resolved building feature id (also the
    // "already painted" guard so we re-probe only the unresolved ones).
    const comparableBuildingByEgrid = new Map();
    let pickSeq = 0;

    async function ensureMap() {
        if (map) return map;
        try {
            map = await initializeViewer('mapContainer');
            window.__similooMap = map; // exposed for browser-driven tests
            // Both the comparable footprints and the searched parcel's own
            // buildings can only be coloured once their tile has rendered, so
            // re-probe whenever the map settles — this lights them up the moment
            // the user pans/flies them into view (and on a cold tile cache).
            map.on('idle', refreshHighlightsOnIdle);
            // Bottom-left legend explaining the red/green/pink highlights.
            legend = createMapLegend(map.getContainer());
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
                clearComparableHighlights();
                document.body.classList.remove('cmp-shifted');
            },
            onSelectComparable: (c) => openDetail(c),
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
                // Paint each comparable's 3D footprint pink (resolved lazily as
                // tiles render — see refreshComparableBuildingHighlights). This
                // is now the sole on-map indicator of comparables; the floating
                // mini-cube markers were removed as redundant — the sidebar list
                // (with its per-card "open 3D" button) is the way to reach them.
                setComparablesForHighlight(data?.comparables || []);
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

    async function showComparison(label, lat, lng) {
        landingView.hidden = true;
        comparisonView.hidden = false;
        emitAddress(label, lat, lng);
        await ensureMap();
        ensureSidebar();
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    // The React shell's navbar address search (the suite-standard search surface,
    // which replaced the old in-view "Search again" bar) drives the same flow as
    // the landing search: a pick dispatches `similoo:search` with {lat,lng,label},
    // which we feed straight into handlePick. handlePick now resets the previous
    // search's highlights up front, so re-searching from here — without the old
    // trip back through the landing view — leaves nothing stale behind.
    window.addEventListener('similoo:search', (e) => {
        const r = e?.detail;
        if (r && Number.isFinite(r.lat) && Number.isFinite(r.lng)) handlePick(r);
    });

    // Probe the building vector tile under (lng, lat) and return the rendered
    // footprint feature whose centroid sits nearest the point. MapLibre can
    // only resolve a feature id from a *rendered* tile, so this works for
    // anything currently on screen (the searched address, or a comparable the
    // user has panned/flown to). Returns null when no footprint renders there.
    function buildingFeatureAt(lng, lat) {
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
        // Fallback: the point can land just off the footprint (a street
        // entrance, or the parcel centroid for a large parcel). Widen the
        // search and take the building whose footprint centroid is nearest
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
        return nearestBuilding(hits, point);
    }

    // Fallback single-building highlight: paints just the building nearest
    // (lng, lat) red via the `target` feature-state read by the building layer's
    // paint expression. Used only when the parcel polygon is unavailable or
    // holds no resolvable footprint, so the searched address still reads.
    // Additive — the caller clears the previous search's set beforehand.
    function highlightTargetAt(lng, lat) {
        const target = buildingFeatureAt(lng, lat);
        if (!target || target.id == null) return null;
        addTargetBuilding(target.id);
        document.body.classList.add('cmp-shifted');
        return target;
    }

    function addTargetBuilding(id) {
        if (id == null || targetBuildingIds.has(id)) return;
        targetBuildingIds.add(id);
        map.setFeatureState(
            { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id },
            { target: true },
        );
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
        if (map) {
            for (const id of targetBuildingIds) {
                map.setFeatureState(
                    { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id },
                    { target: false },
                );
            }
        }
        targetBuildingIds.clear();
    }

    // --- Comparable building highlights -------------------------------------
    //
    // The comparable list from /score/similoo carries each match's parcel
    // EGRID + centroid lat/lng but *not* a building id, and the footprint tile
    // has no parcel column to match on — so (unlike the same-zone parcel wash,
    // which paints off a tile property) we can only colour a comparable's 3D
    // footprint once it has rendered. We resolve each comparable's building id
    // by probing the tile at its centroid and set the `comparable` feature-
    // state the building layer paints pink (the sole on-map cue for a match).
    //
    // Resolution is lazy + sticky: comparables off-screen at search time light
    // up the moment the user pans/flies them into view (we re-probe on every
    // map `idle`), and MapLibre keeps the feature-state across tile reloads, so
    // each building stays pink once discovered. `comparableBuildingByEgrid`
    // doubles as the "already resolved" guard so we never re-probe a hit.
    function refreshComparableBuildingHighlights() {
        if (!map || !map.getLayer(BUILDING_LAYER) || !currentComparables.length) return;
        for (const c of currentComparables) {
            const key = c?.egrid || null;
            if (!key || comparableBuildingByEgrid.has(key)) continue;
            if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
            const feat = buildingFeatureAt(c.lng, c.lat);
            if (!feat || feat.id == null) continue;
            // Never recolour a searched-parcel building — its red `target` paint wins.
            if (targetBuildingIds.has(feat.id)) continue;
            comparableBuildingByEgrid.set(key, feat.id);
            map.setFeatureState(
                { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id: feat.id },
                { comparable: true },
            );
        }
    }

    function setComparablesForHighlight(list) {
        clearComparableHighlights();
        currentComparables = Array.isArray(list) ? list : [];
        refreshComparableBuildingHighlights();
    }

    function clearComparableHighlights() {
        if (map) {
            for (const id of comparableBuildingByEgrid.values()) {
                map.setFeatureState(
                    { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id },
                    { comparable: false },
                );
            }
        }
        comparableBuildingByEgrid.clear();
        currentComparables = [];
    }

    // --- Target-parcel building highlights ----------------------------------
    //
    // The product ask: paint EVERY building in the searched parcel red, not just
    // the single footprint under the search point. The footprint tile carries no
    // parcel column to match on, so we resolve membership geometrically — take
    // the searched parcel's polygon (gathered from the rendered parcel tiles by
    // id, so a tile-split parcel still counts) and paint every building whose
    // footprint centroid falls inside it. Like the comparable pass this is lazy
    // + sticky: buildings that render late (cold tile cache, or panned into view)
    // light up on the next map `idle`, and MapLibre keeps the feature-state
    // across tile reloads. Returns the running count so the pick loop can poll
    // until at least one building resolves. Idempotent — safe to re-run.
    function highlightBuildingsInTargetParcel() {
        if (!map || !map.getLayer(BUILDING_LAYER) || currentTargetParcelId == null) {
            return targetBuildingIds.size;
        }
        const rings = collectTargetParcelRings();
        if (!rings.length) return targetBuildingIds.size;

        const bbox = parcelScreenBbox(rings);
        if (!bbox) return targetBuildingIds.size;

        const hits = map.queryRenderedFeatures(bbox, { layers: [BUILDING_LAYER] });
        for (const f of hits) {
            if (f.id == null || targetBuildingIds.has(f.id)) continue;
            const c = footprintCentroid(f.geometry);
            if (!c || !pointInRings(c[0], c[1], rings)) continue;
            addTargetBuilding(f.id);
        }
        if (targetBuildingIds.size) document.body.classList.add('cmp-shifted');
        return targetBuildingIds.size;
    }

    // Gather the searched parcel's outer rings from every rendered parcel-fill
    // feature carrying its id (a large parcel can be split across vector tiles).
    function collectTargetParcelRings() {
        if (!map || currentTargetParcelId == null || !map.getLayer(PARCEL_FILL_LAYER)) return [];
        const feats = map.queryRenderedFeatures({ layers: [PARCEL_FILL_LAYER] });
        const rings = [];
        for (const f of feats) {
            if (f.id !== currentTargetParcelId) continue;
            collectOuterRings(f.geometry, rings);
        }
        return rings;
    }

    // Screen-space bounding box (padded) of a set of geographic rings, used to
    // bound the building queryRenderedFeatures. The pad covers the pitch lean of
    // tall extrusions so footprints near the parcel edge aren't queried out.
    function parcelScreenBbox(rings) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const ring of rings) {
            for (const pt of ring) {
                const p = map.project([pt[0], pt[1]]);
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
        }
        if (!Number.isFinite(minX)) return null;
        const PAD = 40;
        return [[minX - PAD, minY - PAD], [maxX + PAD, maxY + PAD]];
    }

    function refreshHighlightsOnIdle() {
        refreshComparableBuildingHighlights();
        highlightBuildingsInTargetParcel();
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

        // Re-searching from the navbar reaches handlePick directly (the old
        // "Search again" bar used to clear state on the way back to landing).
        // Wipe the previous search's highlights and sidebar before loading the
        // new parcel. `map` is null on the very first search, when there is
        // nothing to clear.
        if (map) {
            clearTargetHighlight();
            clearZoneHighlight();
            clearComparableHighlights();
            sidebar?.hide();
        }

        await showComparison(result.label || formatLatLng(result.lat, result.lng), result.lat, result.lng);
        syncDeepLink(result);
        document.body.classList.add('cmp-shifted');

        // Switch the view *instantly* — jumpTo, not flyTo. The searched
        // address snaps into place on the next frame with zero fly animation.
        if (map) {
            map.jumpTo({
                center: [result.lng, result.lat],
                // Suite convention: a deep-linked / searched address opens at
                // street level (zoom >= 17) so the target building reads.
                zoom: Math.max(17, map.getZoom()),
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

        // Clear any red buildings left from the previous search before painting
        // this parcel's set.
        clearTargetHighlight();

        // Highlight EVERY building inside the searched parcel (red extrusion),
        // resolved geometrically from the parcel polygon. Poll until at least
        // one resolves — the parcel/building tiles under the point may still be
        // streaming on a cold cache.
        const painted = await retryUntil(
            () => {
                const n = highlightBuildingsInTargetParcel();
                return n > 0 ? n : null;
            },
            () => seq === pickSeq,
        );
        if (seq !== pickSeq) return;

        // Fallback: no parcel polygon (or no building resolved inside it) — light
        // up just the building nearest the searched point so the address still
        // reads, and seed the EGRID fallback below with that building.
        let fallbackBuilding = null;
        if (!painted) {
            fallbackBuilding = await retryUntil(
                () => highlightTargetAt(result.lng, result.lat),
                () => seq === pickSeq,
            );
            if (seq !== pickSeq) return;
        }

        // Resolve the EGRID for the comparison sidebar. The tile's parcel_id
        // is already the canonical CH-format EGRID, so prefer it directly —
        // that skips the /api/parcel network leg entirely. Only fall back to
        // the parcel_data lookup when the tile pick missed.
        let egrid = normaliseEgrid(currentTargetParcelId);
        if (!egrid) {
            try {
                const resolved = await resolveEgridFromLngLat(
                    { lng: result.lng, lat: result.lat },
                    parcelFeature ?? (fallbackBuilding ? { properties: { parcel_id: fallbackBuilding.id } } : null),
                );
                egrid = resolved?.egrid ?? null;
            } catch (err) {
                console.warn('egrid resolve failed:', err?.message);
            }
        }
        if (seq !== pickSeq) return;
        // Pass the searched address so the sidebar's parcel identity header can
        // title the subject card with it (falling back to the municipality).
        // A synthetic "CH…"-shaped label from formatLatLng isn't a real address,
        // so only forward a label that came from an actual geocoder pick.
        if (egrid) sidebar.show(egrid, addressLabelFor(result));
    }

    // The searched address to title the identity header. handlePick receives
    // `result.label` from a geocoder pick (navbar or landing search) or, for a
    // bare ?lat/?lng deep-link, a "lat, lng" string from formatLatLng — which is
    // NOT a street address, so we drop it and let the header fall back to the
    // municipality.
    function addressLabelFor(result) {
        const label = result?.label;
        if (!label || typeof label !== 'string') return null;
        // formatLatLng output looks like "46.94821, 7.44743" — pure coords.
        if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(label.trim())) return null;
        return label;
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

// Collect the outer ring(s) of a GeoJSON Polygon / MultiPolygon geometry.
// Holes are ignored — parcels rarely have them, and ignoring them only ever
// over-includes, which is harmless for the "is this building in the parcel" test.
function collectOuterRings(geom, out) {
    if (!geom) return;
    if (geom.type === 'Polygon') {
        const ring = geom.coordinates?.[0];
        if (Array.isArray(ring) && ring.length >= 3) out.push(ring);
    } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates || []) {
            const ring = poly?.[0];
            if (Array.isArray(ring) && ring.length >= 3) out.push(ring);
        }
    }
}

// Ray-casting point-in-polygon on [lng, lat] coordinates. A planar test is fine
// at parcel scale (a few hundred metres) where the geographic distortion is
// negligible. `ring` is an array of [lng, lat] pairs.
function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];
        const intersect = ((yi > lat) !== (yj > lat))
            && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function pointInRings(lng, lat, rings) {
    for (const ring of rings) {
        if (pointInRing(lng, lat, ring)) return true;
    }
    return false;
}

// The mobile-overflow (⋯) menu and the imperative dark-mode toggle that used to
// live here were removed when the navbar moved to the shared suite chrome: the
// MapToolbar collapses into its own ⋯ menu below 768px, and the theme toggle is
// now a React control (App.tsx) that drives both `.dark` and `data-theme`.
