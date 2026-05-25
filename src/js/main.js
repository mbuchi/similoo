import { initializeViewer } from './viewer/viewerConfig.js';
import { setupControls } from './controls.js';
import { initializeTour } from './tour.js';
import { initReleaseNotes } from './releaseNotes/releaseNotesPanel.js';
import { setupAuth } from './auth/index.js';
import { setupBuildingPicker } from './viewer/buildingPicker.js';
import { hideAddressHeader } from './viewer/geocoder.js';
import {
    computeBuildingMetrics,
    invalidateBuildingMetrics,
} from './viewer/buildingMetrics.js';
import { createBuildingInfoPanel } from './info/buildingInfoPanel.js';
import { onPresetChange, getActivePreset } from './viewer/buildings.js';
import { applyTranslations, bindLocaleSelect, t } from './i18n.js';
import { createComparisonSidebar } from './comparison/sidebar.js';
import { resolveEgridFromWorldPos } from './comparison/parcelLookup.js';
import './cesiumConfig.js';

// Apply translations as soon as the static DOM is parsed — before window.onload
// fires — so users don't see a flash of English text while Cesium boots up.
// The pre-paint script in index.html has already set <html lang>, this sweeps
// every [data-i18n] / [data-i18n-attr] node in the navbar + dock + meta tags.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        applyTranslations(document);
        bindLocaleSelect('locale-select');
    });
} else {
    applyTranslations(document);
    bindLocaleSelect('locale-select');
}

window.onload = async function() {
    try {
        const authPromise = setupAuth();

        if (typeof Cesium === 'undefined') {
            throw new Error(t('error.cesium_missing'));
        }

        const viewer = await initializeViewer('cesiumContainer');
        setupControls(viewer);
        initializeTour();
        initReleaseNotes();

        setupBuildingInfoFlow(viewer);

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
        authPromise.catch((err) => console.error('Auth setup failed:', err));

        const errorMessage = document.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    } catch (e) {
        console.error('Error initializing application:', e);
        const container = document.getElementById('cesiumContainer');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); ' +
                                   'background: rgba(255, 0, 0, 0.1); color: #DC2626; padding: 1rem; ' +
                                   'border: 1px solid #DC2626; border-radius: 4px; text-align: center;';
            errorDiv.textContent = t('error.viewer_load', { message: e.message });
            container.appendChild(errorDiv);
        }
    }
};

// Wires the building picker, metrics module, and the comparison sidebar
// into one flow. similoo's headline surface is "comparable buildings",
// not a single-building info dump, so the comparison sidebar takes the
// right-edge slot — it already shows the target parcel's metrics in its
// top section, which subsumes the bip's quickstats. The hood-style info
// panel is kept instantiated (but stays hidden) so we can still cache
// computed metrics per feature for the future "details" sub-view.
//
//   * Hover/click on the map drives the picker.
//   * Click → compute metrics (cache) → resolve EGRID → show comparison
//            sidebar → shift right-side controls.
//   * Deselect → hide sidebar → unshift controls.
//   * Date change in Setup → invalidate metrics cache.
//   * Google preset active → disable picker (mesh has no useful props).
//   * Escape key → close sidebar.
function setupBuildingInfoFlow(viewer) {
    let currentFeature = null;
    let currentClickPos = null;
    let resolveSeq = 0;

    // Kept around so the metrics cache stays warm — see comment above.
    const panel = createBuildingInfoPanel({ onClose: () => {} });
    panel.hide();

    const comparison = createComparisonSidebar({
        viewer,
        onClose: () => {
            currentFeature = null;
            currentClickPos = null;
            resolveSeq++;
            document.body.classList.remove('cmp-shifted');
            picker.clearSelection();
            hideAddressHeader();
        },
    });

    const picker = setupBuildingPicker(viewer, {
        onSelect: async (feature, clickWorldPosition) => {
            currentFeature = feature;
            currentClickPos = clickWorldPosition;
            // Pre-warm the per-feature metrics cache so a future "details"
            // sub-view inside the comparison sidebar can read it sync.
            computeBuildingMetrics(feature, viewer, clickWorldPosition);
            document.body.classList.add('cmp-shifted');
            hideAddressHeader();

            // Resolve EGRID then drive the comparison sidebar. Tagged with
            // a seq so a rapid second pick wins the race.
            const seq = ++resolveSeq;
            try {
                const { egrid } = await resolveEgridFromWorldPos(clickWorldPosition, feature);
                if (seq !== resolveSeq) return;
                if (egrid) comparison.show(egrid);
            } catch (err) {
                console.warn('EGRID resolve failed:', err);
            }
        },
        onDeselect: () => {
            currentFeature = null;
            currentClickPos = null;
            resolveSeq++;
            comparison.hide();
            document.body.classList.remove('cmp-shifted');
            hideAddressHeader();
        },
    });

    // Disable picking on the Google Photorealistic preset.
    picker.setEnabled(getActivePreset(viewer) !== 'google');
    onPresetChange((preset) => {
        picker.setEnabled(preset !== 'google');
    });

    // When the user changes the Setup date, re-run solar exposure for the
    // currently-open feature (if any) so the metrics cache stays fresh.
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            if (!currentFeature || !currentClickPos) return;
            invalidateBuildingMetrics(currentFeature);
            computeBuildingMetrics(currentFeature, viewer, currentClickPos);
        });
    }

    // Escape closes the sidebar.
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentFeature) {
            currentFeature = null;
            currentClickPos = null;
            resolveSeq++;
            comparison.hide();
            document.body.classList.remove('cmp-shifted');
            picker.clearSelection();
        }
    });
}
