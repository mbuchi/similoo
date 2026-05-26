import './i18n.js';

import {
    initializeViewer,
    PARCEL_SOURCE,
    PARCEL_SOURCE_LAYER,
    BUILDING_SOURCE,
    BUILDING_SOURCE_LAYER,
    PARCEL_LAYER,
    BUILDING_LAYER,
    BUILDING_OPACITY_DEFAULT,
    BUILDING_OPACITY_DIMMED,
} from './viewer/viewerConfig.js';
import { applyTranslations, bindLocaleSelect, t } from './i18n.js';
import { createComparisonSidebar } from './comparison/sidebar.js';
import { resolveEgridFromLngLat } from './comparison/parcelLookup.js';

// Apply translations as soon as the static DOM is parsed — before window.onload
// fires — so users don't see a flash of English text while the map boots.
// The pre-paint script in index.html has already set <html lang>, this
// sweeps every [data-i18n] / [data-i18n-attr] node in the navbar + meta tags.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        applyTranslations(document);
        bindLocaleSelect('locale-select');
    });
} else {
    applyTranslations(document);
    bindLocaleSelect('locale-select');
}

window.onload = async function () {
    try {
        const map = await initializeViewer('mapContainer');
        window.__similooMap = map; // exposed for browser-driven tests

        setupComparisonFlow(map);
        setupThemeToggle();

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    } catch (e) {
        console.error('Error initializing application:', e);
        const container = document.getElementById('mapContainer');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText =
                'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); ' +
                'background: rgba(255, 0, 0, 0.1); color: #DC2626; padding: 1rem; ' +
                'border: 1px solid #DC2626; border-radius: 4px; text-align: center;';
            errorDiv.textContent = t('error.viewer_load', { message: e.message });
            container.appendChild(errorDiv);
        }
    }
};

// Wires the parcel/building click → EGRID → comparison sidebar flow on top
// of the MapLibre map. similoo's headline surface is "comparable buildings",
// so the comparison sidebar takes the right-edge slot and the map's job is
// to feed it a parcel and host the target/comparable highlight.
//
//   * Hover on a parcel   → soft amber overlay (parcel hover=true).
//   * Hover on a building → blue tint on that footprint (building hover=true).
//   * Click on a parcel   → resolve EGRID via /api/parcel, show sidebar,
//                           paint target parcel red, dim buildings so the
//                           red ground patch shows through the 3D shells.
//   * Click on a building → also paint that building red, and resolve the
//                           parcel underneath (queryRenderedFeatures hits
//                           the parcel even when a building covers it
//                           because MapLibre projects to the ground plane
//                           for fill layers).
//   * Close sidebar       → clear paint states, restore building opacity.
//   * Escape key          → close sidebar.
function setupComparisonFlow(map) {
    let currentTargetParcelId = null;
    let currentTargetBuildingId = null;
    let currentComparableIds = [];
    let hoverParcelId = null;
    let hoverBuildingId = null;
    let resolveSeq = 0;

    const comparison = createComparisonSidebar({
        map,
        onClose: () => {
            clearSelection();
            document.body.classList.remove('cmp-shifted');
            resolveSeq++;
        },
        onFlyTo: null,
    });

    // --- Parcel hover (soft amber overlay on the ground) ---
    map.on('mousemove', PARCEL_LAYER, (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f || f.id == null) return;
        if (hoverParcelId !== null && hoverParcelId !== f.id) {
            map.setFeatureState(
                { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: hoverParcelId },
                { hover: false },
            );
        }
        hoverParcelId = f.id;
        map.setFeatureState(
            { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: hoverParcelId },
            { hover: true },
        );
    });

    map.on('mouseleave', PARCEL_LAYER, () => {
        map.getCanvas().style.cursor = '';
        if (hoverParcelId !== null) {
            map.setFeatureState(
                { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: hoverParcelId },
                { hover: false },
            );
            hoverParcelId = null;
        }
    });

    // --- Building hover (blue tint on the extruded footprint) ---
    map.on('mousemove', BUILDING_LAYER, (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f || f.id == null) return;
        if (hoverBuildingId !== null && hoverBuildingId !== f.id) {
            map.setFeatureState(
                { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id: hoverBuildingId },
                { hover: false },
            );
        }
        hoverBuildingId = f.id;
        map.setFeatureState(
            { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id: hoverBuildingId },
            { hover: true },
        );
    });

    map.on('mouseleave', BUILDING_LAYER, () => {
        // Cursor reset is handled by parcel mouseleave too; only one will
        // win depending on layer order, and that's fine.
        if (hoverBuildingId !== null) {
            map.setFeatureState(
                { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id: hoverBuildingId },
                { hover: false },
            );
            hoverBuildingId = null;
        }
    });

    // --- Click on parcel layer ---
    // Both parcel and building click handlers route through selectAt(),
    // which figures out the rest (other layer's feature, EGRID resolve,
    // building dimming). Registering on each layer rather than the map
    // means we don't fire for clicks on the empty positron underlay.
    map.on('click', PARCEL_LAYER, (e) => {
        selectAt(e.lngLat, e.point, e.features?.[0] || null, null);
    });

    map.on('click', BUILDING_LAYER, (e) => {
        // Look up the parcel beneath the clicked building via the screen
        // point. parcels-fill is a 2D ground layer, so its hitbox is the
        // parcel directly beneath the cursor.
        const parcelHits = map.queryRenderedFeatures(e.point, { layers: [PARCEL_LAYER] });
        selectAt(e.lngLat, e.point, parcelHits[0] || null, e.features?.[0] || null);
    });

    async function selectAt(lngLat, point, parcelFeature, buildingFeature) {
        // If neither hit, nothing to do (shouldn't happen — both handlers
        // require a feature — but defensive).
        if (!parcelFeature && !buildingFeature) return;

        // If clicking via the parcel layer with no building feature, try
        // to find one anyway so the building on the selected parcel lights
        // up too. The user explicitly asked for "also highlight the
        // building" on click.
        if (!buildingFeature && point) {
            const hits = map.queryRenderedFeatures(point, { layers: [BUILDING_LAYER] });
            buildingFeature = hits[0] || null;
        }

        clearSelection();
        document.body.classList.add('cmp-shifted');

        // Paint target parcel red (if we have a stable id for it).
        if (parcelFeature && parcelFeature.id != null) {
            currentTargetParcelId = parcelFeature.id;
            map.setFeatureState(
                { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: currentTargetParcelId },
                { target: true },
            );
        }

        // Paint target building red.
        if (buildingFeature && buildingFeature.id != null) {
            currentTargetBuildingId = buildingFeature.id;
            map.setFeatureState(
                { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id: currentTargetBuildingId },
                { target: true },
            );
        }

        // Drop building opacity so the red parcel below punches through the
        // 3D shells. MapLibre v5's fill-extrusion-opacity isn't data-driven,
        // so we flip the whole layer. The target building's red color still
        // reads — just slightly more translucent — and unrelated buildings
        // become ghosted out of the way.
        map.setPaintProperty(BUILDING_LAYER, 'fill-extrusion-opacity', BUILDING_OPACITY_DIMMED);

        const seq = ++resolveSeq;
        try {
            const { egrid } = await resolveEgridFromLngLat(lngLat, parcelFeature);
            if (seq !== resolveSeq) return;
            if (egrid) {
                comparison.show(egrid);
            }
        } catch (err) {
            console.warn('EGRID resolve failed:', err);
        }
    }

    function clearSelection() {
        if (currentTargetParcelId !== null) {
            map.setFeatureState(
                { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: currentTargetParcelId },
                { target: false },
            );
            currentTargetParcelId = null;
        }
        if (currentTargetBuildingId !== null) {
            map.setFeatureState(
                { source: BUILDING_SOURCE, sourceLayer: BUILDING_SOURCE_LAYER, id: currentTargetBuildingId },
                { target: false },
            );
            currentTargetBuildingId = null;
        }
        for (const id of currentComparableIds) {
            map.setFeatureState(
                { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id },
                { comparable: false },
            );
        }
        currentComparableIds = [];
        map.setPaintProperty(BUILDING_LAYER, 'fill-extrusion-opacity', BUILDING_OPACITY_DEFAULT);
    }

    // Escape closes the sidebar.
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && (currentTargetParcelId !== null || currentTargetBuildingId !== null)) {
            comparison.hide();
            clearSelection();
            document.body.classList.remove('cmp-shifted');
            resolveSeq++;
        }
    });
}

// Minimal dark-mode toggle (the rest of hood's themeToggle module isn't
// pulled in because it depended on Cesium scene properties). Mirrors the
// pre-paint bootstrap in index.html — same storage key, same possible
// values — so a reload after toggling keeps the choice.
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
