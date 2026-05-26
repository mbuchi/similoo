import './i18n.js';

import {
    initializeViewer,
    PARCEL_SOURCE,
    PARCEL_SOURCE_LAYER,
    BUILDING_SOURCE,
    BUILDING_SOURCE_LAYER,
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

// Wires the parcel click → EGRID → comparison sidebar flow on top of the
// MapLibre map. similoo's headline surface is "comparable buildings", so
// the comparison sidebar takes the right-edge slot and the map's job is
// to feed it a parcel and host the target/comparable highlight.
//
//   * Hover on a parcel → soft amber overlay (feature-state hover=true).
//   * Click on a parcel  → resolve EGRID via /api/parcel → show sidebar →
//                          paint target parcel red.
//   * Close sidebar      → clear all paint states.
//   * Escape key         → close sidebar.
function setupComparisonFlow(map) {
    let currentTargetId = null;
    let currentComparableIds = [];
    let hoverId = null;
    let resolveSeq = 0;

    const comparison = createComparisonSidebar({
        map,
        onClose: () => {
            clearTarget();
            clearComparables();
            document.body.classList.remove('cmp-shifted');
            resolveSeq++;
        },
        onFlyTo: null,
    });

    // Pointer affordance + hover feature-state for parcels.
    map.on('mousemove', 'parcels-fill', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        if (hoverId !== null && hoverId !== f.id) {
            map.setFeatureState(
                { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: hoverId },
                { hover: false },
            );
        }
        hoverId = f.id;
        map.setFeatureState(
            { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: hoverId },
            { hover: true },
        );
    });

    map.on('mouseleave', 'parcels-fill', () => {
        map.getCanvas().style.cursor = '';
        if (hoverId !== null) {
            map.setFeatureState(
                { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: hoverId },
                { hover: false },
            );
            hoverId = null;
        }
    });

    map.on('click', 'parcels-fill', async (e) => {
        const f = e.features?.[0];
        if (!f) return;

        clearTarget();
        clearComparables();
        currentTargetId = f.id;
        map.setFeatureState(
            { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: currentTargetId },
            { target: true },
        );
        document.body.classList.add('cmp-shifted');

        const seq = ++resolveSeq;
        try {
            const { egrid } = await resolveEgridFromLngLat(e.lngLat, f);
            if (seq !== resolveSeq) return;
            if (egrid) {
                comparison.show(egrid);
            }
        } catch (err) {
            console.warn('EGRID resolve failed:', err);
        }
    });

    function clearTarget() {
        if (currentTargetId !== null) {
            map.setFeatureState(
                { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id: currentTargetId },
                { target: false },
            );
            currentTargetId = null;
        }
    }

    function clearComparables() {
        for (const id of currentComparableIds) {
            map.setFeatureState(
                { source: PARCEL_SOURCE, sourceLayer: PARCEL_SOURCE_LAYER, id },
                { comparable: false },
            );
        }
        currentComparableIds = [];
    }

    // Escape closes the sidebar.
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentTargetId !== null) {
            comparison.hide();
            clearTarget();
            clearComparables();
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
