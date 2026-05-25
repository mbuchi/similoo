import { startRecording } from './recording.js';
import { calculateCameraPosition, getGroundPoint, setCamera } from '../viewer/cameraUtils.js';
import { storeShadowStates, restoreShadowStates } from '../viewer/shadowManager.js';
import { setActiveMode, setIdleMode } from '../viewer/renderMode.js';
import { setHillshadeBasemap, setImageryBasemap } from '../viewer/basemap.js';
import { getActiveBuildingsTileset } from '../viewer/buildings.js';
import { t } from '../i18n.js';

export function setupDayTourButton(viewer, settings) {
    if (!settings) {
        console.error('Settings object is required for day tour functionality');
        return;
    }

    const dayButton = document.getElementById('dayButton');
    let isPlaying = false;
    let mediaRecorder = null;
    let startJulianDate;
    let endJulianDate;
    let state = {
        currentRadius: 100,
        centerCartesian: null
    };

    dayButton.addEventListener('click', () => {
        if (isPlaying) {
            stopTour();
            return;
        }
        
        const groundPoint = getGroundPoint(viewer);
        
        if (!groundPoint) {
            console.error('Could not determine ground point');
            return;
        }
        
        // Store the center point
        state.centerCartesian = groundPoint;

        // Switch to active render mode *before* the fly-to so the camera
        // animation itself runs at full resolution / LOD, and swap to the
        // hillshade basemap so the dynamic sun shadows read cleanly against
        // a neutral ground (the satellite imagery has baked solar shadows
        // that would compete with our cast shadows).
        setActiveMode(viewer);
        setHillshadeBasemap(viewer);

        // First zoom to the correct position
        zoomToPosition(viewer, groundPoint, () => {
            startTour();
        });
    });

    function stopTour() {
        dayButton.textContent = t('sun.label_24hrs');

        // Stop recording if active
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }

        isPlaying = false;
        // Pauses the clock and re-applies the low-render-cost idle profile,
        // then restore the satellite basemap (the dynamic shadows are
        // frozen on the current sun position; the user is back in browsing
        // mode where the satellite imagery looks richer).
        setIdleMode(viewer);
        setImageryBasemap(viewer);
    }
    
    function zoomToPosition(viewer, centerPoint, callback) {
        const { position, direction, up } = calculateCameraPosition(
            viewer, 
            centerPoint, 
            state.currentRadius, 
            0
        );
        
        // Fly to the position
        viewer.camera.flyTo({
            destination: position,
            orientation: {
                direction: direction,
                up: up
            },
            duration: 1.5,
            complete: function() {
                // Force exact orientation after flight
                setCamera(viewer, position, direction, up);
                if (callback) callback();
            }
        });
    }

    function startTour() {
        // Render mode was switched to active before the fly-to in the click
        // handler so the camera animation rendered at full quality. The clock
        // is set up below; setActiveMode already unpaused it.

        // Enable shadows before starting the tour
        viewer.shadows = true;
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.castShadows = true;
        viewer.scene.globe.receiveShadows = true;
        viewer.shadowMap.enabled = true;
        viewer.shadowMap.softShadows = true;
        
        // Update shadows checkbox in settings
        const shadowsToggle = document.getElementById('shadowsToggle');
        if (shadowsToggle) {
            shadowsToggle.checked = true;
        }

        // Update shadows on whichever buildings tileset is currently visible
        // (primitives[0] would be wrong now that SB3D + OSM Buildings coexist
        // in the scene — see viewer/buildings.js).
        const tileset = getActiveBuildingsTileset(viewer);
        if (tileset instanceof Cesium.Cesium3DTileset) {
            tileset.shadows = Cesium.ShadowMode.ENABLED;
            tileset.castShadows = true;
            tileset.receiveShadows = true;
        }

        // Get the selected date from settings
        const dateInput = document.getElementById('dateInput');
        const selectedDate = new Date(dateInput.value);
        
        // Set start time to sunrise (6 AM)
        selectedDate.setHours(6, 0, 0, 0);
        startJulianDate = Cesium.JulianDate.fromDate(selectedDate);
        
        // Set end time to next sunrise
        const endDate = new Date(selectedDate);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(6, 0, 0, 0);
        endJulianDate = Cesium.JulianDate.fromDate(endDate);

        // Configure the clock
        viewer.clock.startTime = startJulianDate;
        viewer.clock.stopTime = endJulianDate;
        viewer.clock.currentTime = startJulianDate;
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        viewer.clock.multiplier = 2880; // Speed up time (2880 = 1 day in 30 seconds)
        viewer.clock.shouldAnimate = true;

        // Start recording if enabled in settings
        if (settings.isRecordingEnabled()) {
            beginRecording();
        }

        dayButton.textContent = t('sun.stop');
        isPlaying = true;
    }

    function beginRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') return;
        mediaRecorder = startRecording(viewer, (recorder) => mediaRecorder = recorder);
    }
}