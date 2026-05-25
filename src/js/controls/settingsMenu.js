import {
    DEFAULT_BUILDINGS_MIN_ZOOM,
    getActiveBuildingsTileset,
    getActivePreset,
    hasCesiumIonToken,
    hasGoogleApiKey,
    hasOsmBuildings,
    setBuildingsMinZoom,
    setGoogleLayers,
    setOsmLayers,
    setSwissLayers
} from '../viewer/buildings.js';
import { t, onLocaleChange } from '../i18n.js';

// Wires the Display + Tools toggles. The Setup container itself is now a
// sidebar panel (see controls/sidebar.js) rather than a modal — this module
// only owns the controls' behaviour, not their show/hide chrome.
export function setupSettingsMenu(viewer) {
    const elements = {
        hdrToggle: document.getElementById('hdrToggle'),
        recordVideoToggle: document.getElementById('recordVideoToggle'),
        cameraInfoToggle: document.getElementById('cameraInfoToggle'),
        shadowsToggle: document.getElementById('shadowsToggle'),
        swissLayersToggle: document.getElementById('swissLayersToggle'),
        osmLayersToggle: document.getElementById('osmLayersToggle'),
        googleLayersToggle: document.getElementById('googleLayersToggle'),
        buildingsMinZoomInput: document.getElementById('buildingsMinZoomInput'),
        gpsToggle: document.getElementById('gpsToggle')
    };

    setupToggles(viewer, elements);
    setupGPSFeatures(viewer, elements.gpsToggle);

    return {
        isRecordingEnabled: () => elements.recordVideoToggle.checked
    };
}

function setupToggles(viewer, elements) {
    const {
        hdrToggle,
        shadowsToggle,
        cameraInfoToggle,
        swissLayersToggle,
        osmLayersToggle,
        googleLayersToggle,
        buildingsMinZoomInput
    } = elements;

    hdrToggle.addEventListener('change', () => {
        viewer.scene.highDynamicRange = hdrToggle.checked;
    });

    shadowsToggle.addEventListener('change', () => {
        updateShadowSettings(viewer, shadowsToggle.checked);
    });

    setupCameraInfoToggle(cameraInfoToggle);
    setupLayerPresetToggles(viewer, swissLayersToggle, osmLayersToggle, googleLayersToggle);
    setupBuildingsMinZoomInput(viewer, buildingsMinZoomInput);
}

function setupBuildingsMinZoomInput(viewer, input) {
    if (!input) return;
    input.value = String(DEFAULT_BUILDINGS_MIN_ZOOM);
    setBuildingsMinZoom(viewer, DEFAULT_BUILDINGS_MIN_ZOOM);
    input.addEventListener('change', () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        setBuildingsMinZoom(viewer, v);
    });
}

function disableToggle(toggle, reasonKey, hintKey) {
    if (!toggle) return;
    toggle.checked = false;
    toggle.disabled = true;
    const label = toggle.parentElement;
    label.classList.add('is-disabled');
    label.title = t(reasonKey);
    if (hintKey) {
        // Inline "set VITE_X to enable" subtitle — more discoverable than
        // a hover-only tooltip, especially on touch where there's no hover.
        const hintEl = document.createElement('span');
        hintEl.className = 'settings-option-hint';
        hintEl.textContent = t(hintKey);
        hintEl.dataset.i18nKey = hintKey;
        label.appendChild(hintEl);
    }
    // Stash the reason key on the label so we can re-translate on locale flip.
    label.dataset.i18nReasonKey = reasonKey;
}

// Re-translate every disabled-toggle's title + inline hint when the locale
// changes. The labels were built via JS so the static [data-i18n] sweep can't
// reach them.
onLocaleChange(() => {
    document.querySelectorAll('.settings-option.is-disabled').forEach((label) => {
        const reasonKey = label.dataset.i18nReasonKey;
        if (reasonKey) label.title = t(reasonKey);
        const hintEl = label.querySelector('.settings-option-hint');
        if (hintEl && hintEl.dataset.i18nKey) {
            hintEl.textContent = t(hintEl.dataset.i18nKey);
        }
    });
});

// Three checkboxes drive one mutually-exclusive layer preset (Swiss / OSM /
// Google). They behave like radio buttons: checking one swaps the preset and
// auto-unchecks the others; trying to uncheck the active one just re-checks
// it, since a preset must always be active.
function setupLayerPresetToggles(viewer, swissToggle, osmToggle, googleToggle) {
    if (!swissToggle || !osmToggle || !googleToggle) return;

    // OSM = Cesium Ion (OSM Buildings + World Terrain). Disable upfront if
    // the token isn't configured so we don't have to wait for an Ion 401 to
    // figure it out. If the token IS set but the tileset still failed to
    // load (quota, network), hasOsmBuildings will catch it.
    if (!hasCesiumIonToken()) {
        disableToggle(
            osmToggle,
            'settings.osm_token_missing',
            'settings.osm_token_hint'
        );
    } else if (!hasOsmBuildings(viewer)) {
        disableToggle(
            osmToggle,
            'settings.osm_load_failed',
            'settings.osm_load_failed_hint'
        );
    }
    if (!hasGoogleApiKey()) {
        disableToggle(
            googleToggle,
            'settings.google_key_missing',
            'settings.google_key_hint'
        );
    }

    const presets = [
        { toggle: swissToggle, apply: () => setSwissLayers(viewer) },
        { toggle: osmToggle,    apply: () => setOsmLayers(viewer) },
        { toggle: googleToggle, apply: () => setGoogleLayers(viewer) }
    ];

    presets.forEach((preset) => {
        preset.toggle.addEventListener('change', async () => {
            // Can't deactivate the active preset by unchecking — one must
            // always be on. Just re-check and bail.
            if (!preset.toggle.checked) {
                preset.toggle.checked = true;
                return;
            }
            const ok = await preset.apply();
            if (!ok) {
                // The swap failed (e.g. missing token, network). Re-derive
                // the checkboxes from the still-active preset.
                syncTogglesToActivePreset(viewer, presets);
                return;
            }
            // Success — uncheck the others.
            presets.forEach((other) => {
                if (other !== preset) other.toggle.checked = false;
            });
            updateShadowsForActiveTileset(viewer);
        });
    });
}

// After a failed swap, re-read which preset is actually live and reflect
// that in the checkboxes.
function syncTogglesToActivePreset(viewer, presets) {
    const activeId = {
        swiss: 'swissLayersToggle',
        osm: 'osmLayersToggle',
        google: 'googleLayersToggle'
    }[getActivePreset(viewer)];
    presets.forEach((p) => {
        p.toggle.checked = p.toggle.id === activeId;
    });
}

// After a preset swap, re-apply the current shadow setting to the newly
// active tileset so its shadow mode matches the global toggle.
function updateShadowsForActiveTileset(viewer) {
    const shadowsToggle = document.getElementById('shadowsToggle');
    if (!shadowsToggle) return;
    const tileset = getActiveBuildingsTileset(viewer);
    if (tileset instanceof Cesium.Cesium3DTileset) {
        const enabled = shadowsToggle.checked;
        tileset.shadows = enabled ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED;
        tileset.castShadows = enabled;
        tileset.receiveShadows = enabled;
    }
    viewer.scene.requestRender();
}

function updateShadowSettings(viewer, enabled) {
    viewer.shadows = enabled;
    viewer.scene.globe.enableLighting = enabled;
    viewer.scene.globe.castShadows = enabled;
    viewer.scene.globe.receiveShadows = enabled;
    viewer.shadowMap.enabled = enabled;
    viewer.terrainShadows = enabled ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED;

    // Apply to whichever buildings tileset is currently visible — primitives
    // [0] would be wrong now that two tilesets coexist in the scene.
    const tileset = getActiveBuildingsTileset(viewer);
    if (tileset instanceof Cesium.Cesium3DTileset) {
        tileset.shadows = enabled ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED;
        tileset.castShadows = enabled;
        tileset.receiveShadows = enabled;
    }

    // Idle render-on-demand mode doesn't repaint unless we ask it to, so the
    // shadow change wouldn't be visible until the next camera move otherwise.
    viewer.scene.requestRender();
}

function setupCameraInfoToggle(cameraInfoToggle) {
    const cameraMonitor = document.querySelector('.camera-monitor');
    if (cameraMonitor) {
        cameraMonitor.style.display = 'none';
        cameraInfoToggle.addEventListener('change', () => {
            cameraMonitor.style.display = cameraInfoToggle.checked ? 'block' : 'none';
        });
    }
}

function setupGPSFeatures(viewer, gpsToggle) {
    const locationButton = createLocationButton();
    
    gpsToggle.addEventListener('change', () => handleGPSToggle(gpsToggle, locationButton));
    locationButton.addEventListener('click', () => handleLocationClick(viewer));
}

function createLocationButton() {
    const button = document.createElement('button');
    button.className = 'perspective-button';
    button.innerHTML = '📍';
    button.style.display = 'none';
    button.style.position = 'absolute';
    button.style.right = '120px';
    button.style.bottom = '30px';
    button.style.zIndex = '1000';
    button.style.padding = '8px';
    button.style.minWidth = '40px';
    document.body.appendChild(button);
    return button;
}

function handleGPSToggle(gpsToggle, locationButton) {
    locationButton.style.display = gpsToggle.checked ? 'block' : 'none';

    if (gpsToggle.checked && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            () => console.log('GPS permission granted'),
            (error) => {
                console.error('GPS permission denied:', error);
                gpsToggle.checked = false;
                locationButton.style.display = 'none';
            }
        );
    }
}

function handleLocationClick(viewer) {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => flyToUserLocation(viewer, position),
            (error) => console.error('Error getting location:', error)
        );
    }
}

function flyToUserLocation(viewer, position) {
    const { latitude, longitude } = position.coords;
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1000),
        orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0
        }
    });
}