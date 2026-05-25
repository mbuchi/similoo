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

// Wires the building picker, metrics module, and info panel into one flow:
//   * Hover/click on the map drives the picker.
//   * Click → compute metrics → show panel → shift right-side controls.
//   * Deselect → hide panel → unshift controls.
//   * Date change in Setup → invalidate solar cache → recompute if open.
//   * Google preset active → disable picker (mesh has no useful props).
//   * Escape key → close panel.
function setupBuildingInfoFlow(viewer) {
    let currentFeature = null;
    let currentClickPos = null;

    const panel = createBuildingInfoPanel({
        onClose: () => {
            // X button uses the same teardown path as Escape / outside click.
            currentFeature = null;
            currentClickPos = null;
            document.body.classList.remove('right-controls-shifted');
            picker.clearSelection();
        },
    });

    const picker = setupBuildingPicker(viewer, {
        onSelect: (feature, clickWorldPosition) => {
            currentFeature = feature;
            currentClickPos = clickWorldPosition;
            const metrics = computeBuildingMetrics(feature, viewer, clickWorldPosition);
            panel.show(metrics);
            document.body.classList.add('right-controls-shifted');
            hideAddressHeader();
        },
        onDeselect: () => {
            currentFeature = null;
            currentClickPos = null;
            panel.hide();
            document.body.classList.remove('right-controls-shifted');
            hideAddressHeader();
        },
    });

    // Disable picking on the Google Photorealistic preset.
    picker.setEnabled(getActivePreset(viewer) !== 'google');
    onPresetChange((preset) => {
        picker.setEnabled(preset !== 'google');
    });

    // When the user changes the Setup date, re-run solar exposure for the
    // currently-open building (if any) and re-render only the panel.
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            if (!currentFeature || !currentClickPos) return;
            invalidateBuildingMetrics(currentFeature);
            const fresh = computeBuildingMetrics(currentFeature, viewer, currentClickPos);
            panel.show(fresh);
        });
    }

    // Escape closes the panel (mirrors the close button).
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentFeature) {
            currentFeature = null;
            currentClickPos = null;
            panel.hide();
            document.body.classList.remove('right-controls-shifted');
            picker.clearSelection();
        }
    });
}
