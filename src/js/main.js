import './i18n.js';

// ⚠ NAMESPACE import, not a default one: MapLibre GL v6 is ESM-only and ships no
// default export, so `import maplibregl from 'maplibre-gl'` resolves to
// undefined and `new maplibregl.Marker(...)` below throws at runtime. The tile
// worker URL is wired once in viewer/viewerConfig.js, which this module imports
// below — see the seam comment there before moving either import.
import * as maplibregl from 'maplibre-gl';
import {
    initializeViewer,
    BUILDING_SOURCE,
    BUILDING_SOURCE_LAYER,
    BUILDING_LAYER,
    PARCEL_FILL_LAYER,
    CMP_HOVER_SOURCE,
    CMP_HOVER_FILL_LAYER,
    CMP_HOVER_GLOW_LAYER,
    CMP_HOVER_LINE_LAYER,
    applyZoneHighlight,
} from './viewer/viewerConfig.js';
// Overlay opacity (?opacity=0..100) — single owner of the factor, shared with
// the React shell's URL sync provider. See viewer/overlayOpacity.js.
import { initOverlayOpacity, registerOverlayLayers } from './viewer/overlayOpacity.js';
import { applyTranslations, t } from './i18n.js';
import { createComparisonSidebar } from './comparison/sidebar.js';
import { resolveEgridFromLngLat, normaliseEgrid } from './comparison/parcelLookup.js';
import { createBuildingDetailModal } from './detail/buildingDetailModal.js';
import { createMapLegend } from './viewer/mapLegend.js';
import { initMethodologyHelp } from './help/methodologyPanel.js';
// Suite deep-link URL parameter standard (docs/URL_PARAMS_STANDARD.md in
// aireon-shared). Pure ESM, safe to import from this vanilla-JS engine.
import {
    getUrlState,
    getParcelAutoSelect,
    applyUrlUiModes,
    DEEP_LINK_MIN_ZOOM,
    isAddressGateBypassed,
} from '@aireon/shared/url-params';
// Which of the stacked parcel polygons under the deep-linked point the link
// meant. The shared chooser owns the `?egrid=` preference AND the
// `requireIdMatch` rule behind it (URL_PARAMS_STANDARD.md, "Which polygon").
import { pickDeepLinkFeature } from '@aireon/shared/map-interaction';
// The one writer for a confirmed pick: coordinates + the parcel's EGRID + the
// parcel's own address, through the canonical shared writer. See
// confirmedLocation.js.
import { clearConfirmedParcelUrl, stampConfirmedParcelUrl } from './confirmedLocation.js';
// Address precedence: the URL's text is a hint, the coordinates are identity.
// See deepLinkAddress.js (and URL_PARAMS_STANDARD.md, "Address precedence").
import {
    readDeepLinkAddress,
    resolveDeepLinkLabel,
} from './deepLinkAddress.js';
// Country-wide "pick a place" camera for a map opened with no address yet.
import { CH_OVERVIEW } from '@aireon/shared/map-defaults';
// The one zone label per parcel (PARCEL_ZONE_STANDARD.md, @aireon/shared
// v1.177.0): the MUNICIPAL designation (`cz_local`, "Wohnzone, Bauklasse 4").
// The federal category (`cz_harmonized`, "Wohnzonen") is a filter, never the
// label; the shared resolver owns the fallback chain and the legal-reference
// guard.
import { resolveZoneLabel } from '@aireon/shared/parcel-zone';

// similoo's imperative engine entry point.
//
// This module owns the full app behaviour: map setup, the Giro3D point-cloud
// detail modal, the comparison sidebar + panels, deep-linking, theme/locale/
// overflow navbar wiring, auth and the bug-report widget. Address search is
// React-owned (the shared WelcomeAddressCard on the landing, AppNavbar's own
// search box once loaded) — both feed picks in here via the `similoo:search`
// window-event listener below, same as a plain handlePick() call. It was
// the vanilla `<script type="module">` entry; in the React shell it is invoked
// once from a useEffect after App.tsx has rendered the static DOM scaffold
// (navbar / landing view / comparison view) with the same ids/classes the
// vanilla index.html had — so every getElementById / querySelector below
// resolves exactly as before. The shell is React; the engine is preserved
// verbatim. `boot()` is idempotent-guarded by the caller.
export function boot() {
    // similoo has no shared AuthProvider in its imperative-engine boot path
    // (React mounts AuthProvider around <App>, but this engine's own effects —
    // including the deep-link bootstrap below — run before AuthProvider's own
    // mount effect fires, per React's child-before-parent effect order). Call
    // the idempotent DOM applier directly so mode=screenshot/embed/kiosk chrome
    // hiding and motion freeze are in place before this function does any more
    // work. AuthProvider still calls it too later — harmless, it's idempotent.
    applyUrlUiModes();
    applyTranslations(document);
    // Methodology help keeps its Esc / hash / deep-link handling here; its open
    // trigger is the React navbar Help button (see App.tsx). The navbar, theme,
    // locale switch, account menu, release notes and bug report are now owned by
    // the shared suite chrome in the React shell — boot() no longer wires them.
    initMethodologyHelp();

    // #landingView / #comparisonView are the show/hide contract showComparison()
    // toggles below — LandingView.tsx now renders the shared WelcomeAddressCard
    // inside #landingView (its own search replaces the old #landingSearchInput /
    // #landingResults form this engine used to bind directly), but the section
    // keeps the same root id so this lookup — and the toggle — keep working.
    const landingView = document.getElementById('landingView');
    const comparisonView = document.getElementById('comparisonView');

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
    // One shared promise owns first-time startup. A second address can be
    // picked while MapLibre is still loading its style; it must await the same
    // map rather than constructing a competing instance that can finish later
    // and restore the stale camera.
    let mapLoading = null;
    // Overlay-opacity controller. Created before the map exists — it reads the
    // live instance through this getter, because initializeViewer() is async.
    initOverlayOpacity(() => map);
    let sidebar = null;
    let detailModal = null;
    let legend = null;
    // True once the user has actually picked an address. The moveend writer is
    // gated on it: with no pick the camera is a browse view (see showEmptyMap),
    // and stamping it would make a reloaded link run a full comparison wherever
    // the user happened to pan — boot()'s bootstrap feeds ?lat/?lng straight
    // into handlePick(). Same "no camera write-back while targetless" ruling
    // boost carries (URL_PARAMS_STANDARD.md).
    let hasPick = false;
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
    // Hovered-comparable parcel spotlight state (see showComparableParcelHover).
    let comparableHoverActive = false;
    let comparableHoverRaf = 0;
    let comparableHoverStart = 0;
    let comparableHoverBeacon = null;
    // The point the published IDENTITY describes, recorded by syncDeepLink()
    // when the pick is written. A label and an EGRID are only ever true for the
    // coordinates they were written with: the moveend writer must re-assert
    // them while the camera still names that exact point and clear them the
    // moment the camera names another, otherwise a copied link opens one parcel
    // titled — or worse, identified — as a different one. This is what keeps a
    // fly-to on a comparable card from leaving the subject parcel's EGRID glued
    // to the comparable's coordinates.
    // Shape: { lat: '47.376888', lng: '8.541694', label: 'Bahnhofstrasse 1, …',
    //          egrid: 'CH294676423526' } (coordinates stored pre-rounded to the
    // 6 decimals the shared writer serialises at).
    let confirmedPick = null;

    // The precision the shared writer serialises lat/lng at (toFixed(6),
    // ~0.11 m). Comparing at exactly that precision makes the question "does
    // the URL we are about to write still name the confirmed point?" rather
    // than a distance guess, and absorbs the sub-nanodegree drift of a MapLibre
    // camera round-trip so a plain zoom or compass reset never drops a valid
    // identity.
    const URL_COORD_EPSILON = 1e-6;

    // The confirmed identity, but only while the camera still names the point
    // it was confirmed at. Returns null otherwise, which makes the caller write
    // bare coordinates.
    function pickForCenter(center) {
        if (!confirmedPick) return null;
        if (Math.abs(Number(confirmedPick.lat) - center.lat) > URL_COORD_EPSILON) return null;
        if (Math.abs(Number(confirmedPick.lng) - center.lng) > URL_COORD_EPSILON) return null;
        return confirmedPick;
    }

    async function ensureMap(initialCamera) {
        if (map) return map;
        if (mapLoading) return mapLoading;
        mapLoading = (async () => {
            try {
                map = await initializeViewer('mapContainer', initialCamera);
                window.__similooMap = map; // exposed for browser-driven tests
                // Every data layer is declared in the INITIAL style (similoo never
                // calls setStyle), so this single registration brings the parcel
                // fill, the parcel outline and the building masses onto the
                // ?opacity= factor for the life of the page. The only re-register
                // needed afterwards is at the applyZoneHighlight call sites, which
                // re-author the zone fill's fill-opacity from scratch.
                registerOverlayLayers();
                // Both the comparable footprints and the searched parcel's own
                // buildings can only be coloured once their tile has rendered, so
                // re-probe whenever the map settles — this lights them up the moment
                // the user pans/flies them into view (and on a cold tile cache).
                map.on('idle', refreshHighlightsOnIdle);
                // Suite view write-back (URL_PARAMS_STANDARD.md): keep the URL
                // naming the camera the user is actually looking at, not just the
                // last address they picked. Until now nothing wrote on movement,
                // so panning, the zoom buttons, the compass reset, a comparable
                // fly-to and the right-click "center here" all left the link
                // frozen. The shared writer also stamps the sync providers App.tsx
                // registers (lang/theme) and preserves every unrelated param,
                // including the quiet-boot flags. The parcel IDENTITY is what it
                // must not leave alone: see pickForCenter() above. The address and
                // the EGRID ride along only while the camera still names the point
                // they describe, and are deleted otherwise so the link never titles
                // — or identifies — one parcel as another. Boot then falls back to
                // the coordinates.
                map.on('moveend', () => {
                    // No pick, no write-back. Under ?search_modal=off the map opens
                    // targetless at CH_OVERVIEW, and every param this writer stamps
                    // (lat/lng above all) is read back by the deep-link bootstrap as
                    // an address to run a comparison on. Writing a browse camera
                    // would turn a copied link into a comparison of whatever the
                    // user last panned over. showComparison() sets the flag.
                    if (!hasPick) return;
                    const center = map.getCenter();
                    const pick = pickForCenter(center);
                    stampConfirmedParcelUrl({
                        lat: center.lat,
                        lng: center.lng,
                        zoom: map.getZoom(),
                        label: pick?.label ?? null,
                        egrid: pick?.egrid ?? null,
                    });
                });
                map.on('contextmenu', (event) => {
                    event.originalEvent.preventDefault();
                    window.dispatchEvent(new CustomEvent('similoo:map-context', {
                        detail: {
                            lat: event.lngLat.lat,
                            lng: event.lngLat.lng,
                            x: event.originalEvent.clientX,
                            y: event.originalEvent.clientY,
                            zoom: map.getZoom(),
                        },
                    }));
                });
                // Bottom-left legend explaining the red/green/pink highlights.
                legend = createMapLegend(map.getContainer());
                return map;
            } catch (e) {
                mapLoading = null;
                console.error('Error initializing viewer:', e);
                throw e;
            }
        })();
        return mapLoading;
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
        // The comparable's zone, resolved by the shared rule: the municipal
        // designation the /score/similoo row carries as `cz_local`, guarded
        // against legal cross-references, never a raw field read here.
        const zone = resolveZoneLabel(c);
        if (zone) parts.push(zone);
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
                hideComparableParcelHover();
                document.body.classList.remove('cmp-shifted');
                releasePick();
            },
            onSelectComparable: (c) => openDetail(c),
            // Hovering a comparable card spotlights its parcel on the map with
            // an animated amber outline (replacing the old red pin marker).
            onHoverComparable: (c) => showComparableParcelHover(c),
            onUnhoverComparable: () => hideComparableParcelHover(),
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
                // `cz_local` here is the comparables' cohort KEY (municipal
                // zone type). Since @aireon/shared v1.177.0 it is also the
                // designation the sidebar's zone pill prints, but the pill goes
                // through the shared resolver; this raw read stays an analytics
                // key and must never be relabelled.
                const czLocal = currentTargetCzLocal || data?.target?.cz_local || null;
                if (czLocal && czLocal !== currentTargetCzLocal) {
                    currentTargetCzLocal = czLocal;
                }
                applyZoneHighlight(map, {
                    targetParcelId: currentTargetParcelId,
                    czLocal,
                });
                // That write re-authors the zone fill's fill-opacity, which
                // would wipe the ?opacity factor; re-register to put it back.
                registerOverlayLayers();
            },
        });
        return sidebar;
    }

    async function showComparison(label, lat, lng, initialCamera) {
        // From here on the camera names a real pick, so the moveend writer may
        // stamp it into the URL again (see the `hasPick` note above).
        hasPick = true;
        landingView.hidden = true;
        comparisonView.hidden = false;
        emitAddress(label, lat, lng);
        await ensureMap(initialCamera);
        ensureSidebar();
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    // The map with NOTHING selected. Same #landingView/#comparisonView show/hide
    // contract as showComparison, minus everything that needs a target — no
    // emitAddress (there is no address), no sidebar (there are no comparables),
    // and deliberately no `hasPick`, so panning writes nothing to the URL. The
    // navbar search drives handlePick exactly as it does from the landing view,
    // so the user picks the normal flow up from here.
    //
    // Two callers, distinguished by `camera`:
    //   • ?search_modal=off (alias of ?welcome=off) with no coordinates — no
    //     camera, so the country overview. Flat on purpose: an overview, not a
    //     scene.
    //   • a link that names coordinates but owes no selection (?select=off, or
    //     a reload of a bare self-written coordinate) — the camera the URL
    //     names, in the app's normal 3D framing, so it is the SAME view the
    //     selecting link produces with the panel left closed.
    async function showEmptyMap(camera = null) {
        landingView.hidden = true;
        comparisonView.hidden = false;
        const view = camera
            || { center: CH_OVERVIEW.center, zoom: CH_OVERVIEW.zoom, pitch: 0, bearing: 0 };
        // initializeViewer() opens on Zurich at street level and does not fly
        // anywhere after load, so this jump is the last camera move and nothing
        // fights it. With a camera we also hand it to the constructor so the
        // first painted frame is already the right place.
        const m = await ensureMap(camera || undefined);
        m.jumpTo(view);
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

    window.addEventListener('similoo:center', (e) => {
        const r = e?.detail;
        if (!r || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
        void ensureMap().then((activeMap) => {
            activeMap.easeTo({ center: [r.lng, r.lat], duration: 500, essential: true });
        });
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

    // --- Hovered-comparable parcel spotlight --------------------------------
    //
    // Hovering a comparable card lights up its whole parcel on the map with an
    // animated amber outline (superseding the old single red pin). We resolve
    // the match's parcel polygon from the rendered parcel tiles at its centroid
    // and feed it into the `cmp-hover` GeoJSON source, then run a short rAF loop
    // that grows the outline in (~220 ms) and gently breathes it. When the
    // parcel isn't rendered (the comparable is panned off-screen) there is no
    // polygon to trace, so we fall back to an amber "waypoint" beacon pinned at
    // the coordinate — still amber, never the old red box.
    function parcelFeatureAt(lng, lat) {
        if (!map || !map.getLayer(PARCEL_FILL_LAYER)) return null;
        const p = map.project([lng, lat]);
        // Widen the probe in steps — a comparable's coordinate can sit a few
        // metres off its parcel centroid (near an edge), so a tight box alone
        // would miss.
        for (const pad of [4, 16, 40]) {
            const hits = map.queryRenderedFeatures(
                [[p.x - pad, p.y - pad], [p.x + pad, p.y + pad]],
                { layers: [PARCEL_FILL_LAYER] },
            );
            if (hits.length) return hits[0];
        }
        return null;
    }

    function showComparableParcelHover(c) {
        if (!map || !c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
        // Reset any prior hover (rapid card-to-card moves) before starting.
        hideComparableParcelHover();

        const feat = parcelFeatureAt(c.lng, c.lat);
        const rings = feat && feat.id != null ? collectParcelRingsById(feat.id) : [];
        const src = map.getSource(CMP_HOVER_SOURCE);
        if (rings.length && src) {
            src.setData({
                type: 'Feature',
                properties: {},
                // Each rendered ring becomes its own polygon so a tile-split or
                // multipart parcel traces fully.
                geometry: { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) },
            });
            comparableHoverActive = true;
            comparableHoverStart = performance.now();
            animateComparableHover(comparableHoverStart);
        } else {
            // Off-screen / unrendered parcel — no polygon to outline.
            showComparableBeacon(c);
        }
    }

    function animateComparableHover(ts) {
        if (!comparableHoverActive || !map) return;
        // rAF timestamps mark the frame's vsync start, which can pre-date the
        // performance.now() captured when the hover began — clamp so `elapsed`
        // (and thus every derived paint value) never dips below 0, which
        // MapLibre rejects ("less than the minimum value 0").
        const elapsed = Math.max(0, ts - comparableHoverStart);
        // Grow-in envelope, then a slow sine "breathing" pulse.
        const grow = Math.min(1, elapsed / 220);
        const pulse = 0.5 + 0.5 * Math.sin(elapsed / 520); // 0..1
        const coreW = (1.6 + 1.0 * pulse) * grow;          // px
        const glowW = (5.0 + 4.0 * pulse) * grow;          // px
        const glowO = 0.55 * grow;
        const fillO = (0.10 + 0.06 * pulse) * grow;
        try {
            map.setPaintProperty(CMP_HOVER_LINE_LAYER, 'line-width', coreW);
            map.setPaintProperty(CMP_HOVER_GLOW_LAYER, 'line-width', glowW);
            map.setPaintProperty(CMP_HOVER_GLOW_LAYER, 'line-opacity', glowO);
            map.setPaintProperty(CMP_HOVER_FILL_LAYER, 'fill-opacity', fillO);
        } catch { /* layer may be mid-teardown */ }
        comparableHoverRaf = requestAnimationFrame(animateComparableHover);
    }

    function hideComparableParcelHover() {
        comparableHoverActive = false;
        if (comparableHoverRaf) {
            cancelAnimationFrame(comparableHoverRaf);
            comparableHoverRaf = 0;
        }
        if (map) {
            try {
                map.setPaintProperty(CMP_HOVER_LINE_LAYER, 'line-width', 0);
                map.setPaintProperty(CMP_HOVER_GLOW_LAYER, 'line-width', 0);
                map.setPaintProperty(CMP_HOVER_GLOW_LAYER, 'line-opacity', 0);
                map.setPaintProperty(CMP_HOVER_FILL_LAYER, 'fill-opacity', 0);
                const src = map.getSource(CMP_HOVER_SOURCE);
                if (src) src.setData({ type: 'FeatureCollection', features: [] });
            } catch { /* no-op */ }
        }
        clearComparableBeacon();
    }

    function showComparableBeacon(c) {
        clearComparableBeacon();
        try {
            const el = document.createElement('div');
            el.className = 'cmp-hover-beacon';
            // Floating chrome — excluded from the "Save image" map capture.
            el.setAttribute('data-screenshot-ignore', 'true');
            el.innerHTML =
                '<span class="cmp-hover-beacon-ring"></span>' +
                '<span class="cmp-hover-beacon-pin"></span>';
            comparableHoverBeacon = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([c.lng, c.lat])
                .addTo(map);
        } catch (err) {
            console.warn('comparable beacon failed:', err);
        }
    }

    function clearComparableBeacon() {
        if (comparableHoverBeacon) {
            try { comparableHoverBeacon.remove(); } catch { /* no-op */ }
            comparableHoverBeacon = null;
        }
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

    // Gather a parcel's outer rings from every rendered parcel-fill feature
    // carrying the given id (a large parcel can be split across vector tiles).
    function collectParcelRingsById(id) {
        if (!map || id == null || !map.getLayer(PARCEL_FILL_LAYER)) return [];
        const feats = map.queryRenderedFeatures({ layers: [PARCEL_FILL_LAYER] });
        const rings = [];
        for (const f of feats) {
            if (f.id !== id) continue;
            collectOuterRings(f.geometry, rings);
        }
        return rings;
    }

    function collectTargetParcelRings() {
        return collectParcelRingsById(currentTargetParcelId);
    }

    // Build a GeoJSON polygon for the searched parcel from its rendered tile
    // ring(s) — the lite base geometry the buildable-massing simulator extrudes.
    // Prefers the id-gathered rings (a tile-split parcel still traces whole),
    // then the single picked tile feature's own geometry, else null (the shared
    // <BuildableMassingSection> then tries a real spare_space match off the
    // egrid/lngLat, and renders nothing when there is none).
    function buildTargetParcelGeometry(parcelFeature) {
        const rings = collectTargetParcelRings();
        if (rings.length === 1) return { type: 'Polygon', coordinates: [rings[0]] };
        if (rings.length > 1) return { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) };
        const g = parcelFeature?.geometry;
        return g && (g.type === 'Polygon' || g.type === 'MultiPolygon') ? g : null;
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
    // `preferEgrid` is the EGRID an inbound deep link named. When several parcel
    // polygons stack under the point (shared borders, a courtyard over a plot),
    // it says which one the link meant, so a shared URL restores the SAME parcel
    // the sender had open instead of whichever feature MapLibre happens to
    // return first.
    //
    // `requireIdMatch` decides what an id that matches NOTHING under the point
    // means, and comes straight from `getParcelAutoSelect()`:
    //   • false (an external link, or a plain search) — a preference only: fall
    //     back to the top hit, because whoever minted the link meant the
    //     coordinates to name the parcel and the id may be spelled differently
    //     here.
    //   • true (a reload of a URL this app wrote that names a parcel) — report
    //     a miss. The camera and the id can describe different places, and
    //     painting whatever sits under the camera centre would present the
    //     NEIGHBOUR's parcel as the one the link names. handlePick then falls
    //     back to the link's own EGRID for the panel, which is honest.
    function pickParcelAt(lng, lat, preferEgrid = null, requireIdMatch = false) {
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
        // The parcel tile promotes `parcel_id` (itself the CH-format EGRID) to
        // feature.id. The shared chooser reads PROPERTIES, so match the promoted
        // id here first, then hand the rest to it: the other property spellings,
        // the trimmed case-insensitive compare, and — the reason this argument
        // exists — what a preferred id that matches NOTHING is allowed to mean.
        if (preferEgrid) {
            const promoted = hits.find((f) => normaliseEgrid(f.id) === preferEgrid);
            if (promoted) return promoted;
        }
        return pickDeepLinkFeature(hits, preferEgrid, undefined, requireIdMatch);
    }

    function clearZoneHighlight() {
        currentTargetParcelId = null;
        currentTargetCzLocal = null;
        applyZoneHighlight(map, { targetParcelId: null, czLocal: null });
        registerOverlayLayers();
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
            hideComparableParcelHover();
            sidebar?.hide();
        }

        const targetCamera = {
            center: [result.lng, result.lat],
            // Suite convention: a deep-linked / searched address opens at
            // street level (zoom >= DEEP_LINK_MIN_ZOOM) so the target
            // building reads. An explicit ?zoom=/?z= on the deep-link wins.
            zoom: Number.isFinite(result.zoom)
                ? result.zoom
                : Math.max(DEEP_LINK_MIN_ZOOM, map ? map.getZoom() : DEEP_LINK_MIN_ZOOM),
            pitch: 50,
            bearing: -25,
        };

        // On the first search, construct MapLibre at the selected address.
        // Previously it rendered the hard-coded Zurich camera while its style
        // loaded, then jumped here after initializeViewer() resolved.
        await showComparison(
            result.label || formatLatLng(result.lat, result.lng),
            result.lat,
            result.lng,
            targetCamera,
        );
        // A newer search may have arrived while the first map was loading.
        // Only the latest pick may publish a URL or move the shared camera.
        if (seq !== pickSeq) return;
        syncDeepLink(result);
        document.body.classList.add('cmp-shifted');

        // Switch the view *instantly* — jumpTo, not flyTo. The searched
        // address snaps into place on the next frame with zero fly animation.
        if (map) {
            map.jumpTo(targetCamera);
        }

        // Pull the parcel under the searched point from the rendered tile. The
        // parcel tile carries everything the highlight needs — `cz_local` (the
        // municipal zone type the comparables cohort is keyed on) and
        // `parcel_id` (promoted to feature.id, itself the CH-format EGRID) — so
        // we can highlight with no backend round-trip. We *poll*
        // queryRenderedFeatures rather than waiting for `idle`: the highlight
        // then appears the instant the tile under the point loads (faster than
        // waiting for the whole viewport to settle, and reliable on a cold
        // cache where `idle` can lag the actual feature availability).
        const linkEgrid = normaliseEgrid(result.egrid);
        // Only the deep-link bootstrap sets this, and only for a reload of a URL
        // this app wrote that still names a parcel: there the id is the identity
        // and the coordinates merely track the camera, so a point that carries
        // no polygon with that id must resolve to nothing rather than to the
        // neighbour. A navbar search carries no id at all and is unaffected.
        const requireIdMatch = result.requireIdMatch === true;
        const parcelFeature = await retryUntil(
            () => pickParcelAt(result.lng, result.lat, linkEgrid, requireIdMatch),
            () => seq === pickSeq,
        );
        if (seq !== pickSeq) return;
        // The link named a parcel, the point does not carry it. Nothing under
        // these coordinates may be presented as the named parcel — not the
        // parcel, and not a building either.
        const idMissed = requireIdMatch && !!linkEgrid && !parcelFeature;
        currentTargetParcelId = parcelFeature?.id ?? null;
        currentTargetCzLocal = parcelFeature?.properties?.cz_local || null;

        // Instant highlight straight off the tile: the searched parcel goes
        // red, every parcel sharing its `cz_local` (the municipal zone type,
        // i.e. the comparables' cohort) goes green. No waiting on /score/similoo.
        applyZoneHighlight(map, {
            targetParcelId: currentTargetParcelId,
            czLocal: currentTargetCzLocal,
        });
        registerOverlayLayers();

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
        if (!painted && !idMissed) {
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
            // The link's own EGRID is the next-best answer: it names a parcel
            // outright, where the cadastre lookup below only names whatever sits
            // under a coordinate.
            egrid = linkEgrid;
        }
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
        // The parcel is now identified, so the address bar can name it. This is
        // the write that turns a bare ?lat/?lng link into one that says WHICH
        // parcel — including for a navbar search, which never reaches the
        // address-healing write further down.
        syncDeepLink({ ...result, egrid });
        // Capture the searched parcel's polygon (the lite base for the buildable-
        // massing simulator) plus its centroid, so the sidebar can feed the shared
        // <BuildableMassingSection>. The rings are gathered by parcel id (across a
        // tile split); geometry falls back to the picked tile feature, then null.
        const parcelGeometry = buildTargetParcelGeometry(parcelFeature);
        const parcelLngLat = [result.lng, result.lat];
        // A deep link's text is a HINT, never the answer: it was minted
        // elsewhere, and ?lat/?lng can name a parcel the text does not. Ask the
        // parcel instead — the EGRID resolved above, or, if the tile pick
        // missed, the cadastre under the point. Started here and awaited after
        // the panel opens, so the lookup overlaps the comparables fetch instead
        // of delaying the panel. See deepLinkAddress.js.
        const resolving = result.labelIsHint
            ? resolveDeepLinkLabel({ egrid, lat: result.lat, lng: result.lng })
            : null;

        // Pass the searched address so the sidebar's parcel identity header can
        // title the subject card with it (falling back to the municipality).
        // A synthetic "CH…"-shaped label from formatLatLng isn't a real address,
        // so only forward a label that came from an actual geocoder pick.
        // The tile's properties ride along for the zone pill: the tile carries
        // every zone column (`cz_local`, `cz_harmonized`, `cz_canton`), so the
        // shared resolver has its full fallback chain even where the
        // /score/similoo row is thin.
        if (egrid) {
            sidebar.show(
                egrid,
                addressLabelFor(result),
                parcelGeometry,
                parcelLngLat,
                parcelFeature?.properties ?? null,
            );
        }

        if (!resolving) return;
        const resolved = await resolving;
        if (seq !== pickSeq) return;
        // No answer at all (cadastre outage, a point on no parcel): keep
        // whatever the URL offered, which still beats a blank header.
        if (!resolved) return;
        // Overwrite the hint everywhere it landed: the navbar box, the parcel
        // identity header, the PRM save record — then publish the resolved
        // value so the link, and every copy of it, heals itself.
        emitAddress(resolved, result.lat, result.lng);
        sidebar.setAddress(resolved);
        syncDeepLink({ ...result, label: resolved, egrid });
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

    // Publish the pick into the URL through the canonical shared writer instead
    // of a hand-rolled replaceState, so it also stamps the registered sync
    // providers (lang/theme) and the self-written history marker.
    //
    // What goes in is the CONFIRMED identity: the coordinates, the parcel's own
    // address under the canonical `q`, and — once handlePick has resolved it —
    // the parcel's EGRID. That is what makes the address bar copyable to the
    // parcel on screen, and what "Share this view" (it copies
    // window.location.href verbatim) now carries. The EGRID rides on the calls
    // made AFTER it resolves; the first call, fired before the parcel tile has
    // been probed, passes through whatever the inbound link already carried so
    // a deep link's own `?egrid=` is never wiped and re-added.
    //
    // The label must always come from the PARCEL (the tile, or
    // resolveDeepLinkLabel's EGRID lookup), never a reverse geocode of the
    // coordinate — that returns whichever feature geo.admin ranks first within
    // ~20 m and would relabel the parcel with a neighbour's address.
    function syncDeepLink(result) {
        // addressLabelFor drops formatLatLng's "47.52150, 8.58329" string: a
        // coordinate is not an address, and publishing one as `?q` invents a
        // label the parcel never claimed. With nothing real to say, say nothing
        // and let the identity speak.
        const label = addressLabelFor(result);
        const egrid = result.egrid || null;
        // Record which point this identity describes before writing, so the
        // moveend writer can tell "still the picked parcel" from "the camera has
        // moved on". handlePick() calls us just before its jumpTo(), so the
        // moveend that jump fires already sees the fresh pick.
        confirmedPick = (label || egrid)
            ? { lat: result.lat.toFixed(6), lng: result.lng.toFixed(6), label, egrid }
            : null;
        // No zoom: the pick does not know the settled camera yet (handlePick
        // jumps right after this call), and the moveend that jump fires stamps
        // the real one. Sampling a mid-jump zoom here would write a wrong value.
        stampConfirmedParcelUrl({ lat: result.lat, lng: result.lng, label, egrid });
    }

    // Dismissing the comparison panel retracts the claim: nothing is selected
    // any more, so the URL must stop naming a parcel and the camera write-back
    // must stop stamping one. The coordinates stay — they are still the view the
    // user is looking at, and they are what "Share this view" has to share.
    function releasePick() {
        confirmedPick = null;
        hasPick = false;
        // Guard the map: a null identity DELETES those params, and a call
        // before the map exists would clear an inbound deep link on boot.
        if (!map) return;
        const center = map.getCenter();
        clearConfirmedParcelUrl({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    }

    // The landing's own search (the shared WelcomeAddressCard, see
    // LandingView.tsx) and the navbar search both call the same React
    // `handleNavSearch`, which dispatches `similoo:search` — caught by the
    // listener above and fed into handlePick. No DOM-level binding needed here
    // any more (see the #landingView/#comparisonView comment near the top).

    // Deep-link bootstrap: a link that names a place skips the landing view and
    // renders the map immediately — with the comparison open on the named parcel
    // when the shared select gate below says this load owes the visitor one.
    // Useful for sharing and headless tests.
    // lat/lng/zoom now come off the shared, suite-wide URL parser (adds the
    // ±85/±180 clamp and the ?z alias for free).
    //
    // The address text in the link (similoo's legacy `?label`, or the canonical
    // `?q` the shared search and context menu write) is rendered straight away
    // so nothing flashes blank, but it is only a HINT: the coordinates are the
    // identity, and handlePick resolves the real address from them and
    // overwrites it. See deepLinkAddress.js.
    //
    // Zoom floor, matching the shared getInitialMapState(): a zoom that came in
    // from OUTSIDE (a pasted or shared link) is floored at DEEP_LINK_MIN_ZOOM so
    // the target building reads and the parcel tile is actually rendered when
    // handlePick probes it. A zoom this app wrote itself is used raw:
    // updateMapUrl stamps history.state.aireonSelfWritten for exactly this, and
    // history state survives a same-tab reload, so zooming out to see the
    // municipality and hitting reload must reopen at that zoom rather than snap
    // back to street level. Writing a zoom we then refuse to restore would make
    // the URL lie.
    try {
        const urlState = getUrlState();
        // Does THIS page load owe the visitor a selection? The suite-wide gate
        // answers it in one place (URL_PARAMS_STANDARD.md, "Open with the parcel
        // selected") so every app agrees on the answer:
        //   • an EXTERNAL ?lat/?lng — yes, the historical deep link.
        //   • a self-written URL that still names a parcel (?egrid/?parcel_id) —
        //     yes: an id in the address bar asserts a parcel is open, so a
        //     reload or a restored tab has to bring the comparison back.
        //   • a self-written BARE coordinate — no. That is a camera, not a
        //     selection: the panel was dismissed (releasePick() cleared the
        //     identity) and reloading must not conjure the comparison back.
        //   • ?select=off — no, whatever else the URL says. The opt-out for a
        //     clean wide screenshot or an embed.
        // Reading urlState.lat/lng directly here is exactly the check that got
        // the last two cases wrong.
        const autoSelect = getParcelAutoSelect();
        const zoom = urlState.zoom === null
            ? undefined
            : (urlState.selfWritten ? urlState.zoom : Math.max(urlState.zoom, DEEP_LINK_MIN_ZOOM));
        if (autoSelect.enabled) {
            const { hint } = readDeepLinkAddress();
            const label = hint || formatLatLng(autoSelect.lat, autoSelect.lng);
            // `?egrid=` (or its `?parcel_id=` spelling) is the identity the
            // selection writer stamps, so a shared link round-trips to the exact
            // parcel the sender had open: it disambiguates which polygon under
            // the point the link meant, and stands in as the answer if the
            // parcel tile has not rendered there at all. `preferId` is the
            // shared spelling-agnostic read of both. Coordinates still lead —
            // the gate only fires on ?lat/?lng, so an EGRID-only link would
            // restore nothing.
            handlePick({
                lat: autoSelect.lat,
                lng: autoSelect.lng,
                label,
                zoom,
                egrid: autoSelect.preferId,
                labelIsHint: true,
                requireIdMatch: autoSelect.requireIdMatch,
            });
        } else if (urlState.lat !== null && urlState.lng !== null) {
            // Coordinates the app must honour, with no selection owed. Open the
            // map on them with nothing picked and no panel: same view, minus the
            // comparison. Without this branch ?select=off would fall through to
            // the address gate and lose the camera entirely.
            void showEmptyMap({
                center: [urlState.lng, urlState.lat],
                zoom: Number.isFinite(zoom) ? zoom : DEEP_LINK_MIN_ZOOM,
                pitch: 50,
                bearing: -25,
            });
        } else if (isAddressGateBypassed()) {
            // ?search_modal=off / ?welcome=off with no coordinates: skip the
            // landing view and open the map at a country overview instead of
            // the address gate. Coordinates keep winning above — a deep link
            // that already names a location must still run its comparison.
            void showEmptyMap();
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
