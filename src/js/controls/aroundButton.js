import { startRecording } from './recording.js';
import { restoreShadowStates, storeShadowStates } from '../viewer/shadowManager.js';
import { setActiveMode, setIdleMode } from '../viewer/renderMode.js';
import { t } from '../i18n.js';

export function setupAroundButton(viewer, state, settings) {
    let animationFrameId = null;
    let shadowStates = null;
    let mediaRecorder = null;
    let isRecording = false;
   
    function stopAroundAnimation() {
        if (state.isFlying) {
            state.isFlying = false;
            const aroundButton = document.getElementById('aroundButton');
            aroundButton.textContent = t('dock.around');

            // Stop recording if active
            if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            restoreShadowStates(viewer, shadowStates);
            shadowStates = null;
            setIdleMode(viewer);
        }
    }

    // Add click handlers to stop Around animation
    document.querySelectorAll('.views-option, .perspective-button').forEach(button => {
        if (button.id !== 'aroundButton') {
            button.addEventListener('click', stopAroundAnimation);
        }
    });

    // Stop Around animation on geocoder search. The navbar search form drives
    // address lookup directly (see controls/navbarSearch.js + viewer/geocoder.js)
    // — Cesium's view-model `search.afterExecute` no longer fires for hood, so
    // we listen on the form's submit event instead.
    const searchForm = document.getElementById('addressSearchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', stopAroundAnimation);
    }

    function startAroundFlight(viewer) {
        // Get current camera position and target point
        const cameraPosition = viewer.camera.position;
        const ray = viewer.camera.getPickRay(new Cesium.Cartesian2(
            viewer.canvas.clientWidth / 2,
            viewer.canvas.clientHeight / 2
        ));
        const groundPoint = viewer.scene.globe.pick(ray, viewer.scene);
        
        if (!groundPoint) {
            console.error('Could not determine ground point');
            return;
        }
        
        // Store the center point
        state.centerCartesian = groundPoint;
        
        // Calculate initial angle based on current camera position
        const cameraLocal = Cesium.Matrix4.multiplyByPoint(
            Cesium.Matrix4.inverse(
                Cesium.Transforms.eastNorthUpToFixedFrame(state.centerCartesian),
                new Cesium.Matrix4()
            ),
            cameraPosition,
            new Cesium.Cartesian3()
        );
        const initialAngle = Math.atan2(cameraLocal.y, cameraLocal.x);

        const startTime = performance.now();
        const duration = 30000; // 30 seconds for one full rotation
        const totalRadians = 2 * Math.PI;
        
        function updateCamera(time) {
            if (!state.isFlying) {
                cancelAnimationFrame(animationFrameId);
                return;
            }

            try {
                const elapsed = (time - startTime) / duration;
                const currentRadians = initialAngle + (totalRadians * (elapsed % 1));

                // Calculate new camera position on the circle
                const x = state.currentRadius * Math.cos(currentRadians);
                const y = state.currentRadius * Math.sin(currentRadians);
                const z = 75; // Fixed height above target point
                
                // Convert to east-north-up coordinates
                const transform = Cesium.Transforms.eastNorthUpToFixedFrame(state.centerCartesian);
                const offset = new Cesium.Cartesian3(x, y, z);
                const cameraPosition = new Cesium.Cartesian3();
                Cesium.Matrix4.multiplyByPoint(transform, offset, cameraPosition);
                
                // Calculate direction from camera to center
                const direction = Cesium.Cartesian3.subtract(
                    state.centerCartesian,
                    cameraPosition,
                    new Cesium.Cartesian3()
                );
                Cesium.Cartesian3.normalize(direction, direction);
                
                // Calculate up vector for level camera
                const up = Cesium.Cartesian3.normalize(
                    viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(cameraPosition),
                    new Cesium.Cartesian3()
                );
                
                // Set the camera view
                viewer.camera.setView({
                    destination: cameraPosition,
                    orientation: {
                        direction: direction,
                        up: up,
                        pitch: Cesium.Math.toRadians(-45) // Keep consistent tilt
                    }
                });
            } catch (error) {
                console.error('Error during around animation:', error);
            }
            // Continue animation
            animationFrameId = requestAnimationFrame(updateCamera);
        }

        state.isFlying = true;
        animationFrameId = requestAnimationFrame(updateCamera);
    }

    const aroundButton = document.getElementById('aroundButton');

    // Adjust the 360° orbit radius with the mouse wheel while a tour is running.
    // (Replaces the old +/- zoom buttons, now superseded by the compass widget.)
    viewer.canvas.addEventListener('wheel', function(event) {
        if (!state.isFlying) return;
        event.preventDefault();
        if (event.deltaY < 0) {
            state.currentRadius = Math.max(25, state.currentRadius * 0.8); // Minimum 25m radius
        } else if (event.deltaY > 0) {
            state.currentRadius = Math.min(500, state.currentRadius * 1.25); // Maximum 500m radius
        }
    }, { passive: false });

    aroundButton.addEventListener('click', () => {
        if (state.isFlying) {
            stopAroundAnimation();
            return;
        }

        state.currentRadius = 100; // Reset radius to initial value
        state.centerCartesian = null; // Reset center point
        shadowStates = storeShadowStates(viewer);
        setActiveMode(viewer);
        startAroundFlight(viewer);
        aroundButton.textContent = t('dock.around_stop');

        // Only start recording if enabled in settings
        if (settings.isRecordingEnabled()) {
            startRecording(viewer, (recorder) => {
                mediaRecorder = recorder;
                isRecording = true;
            });
        }
    });
}