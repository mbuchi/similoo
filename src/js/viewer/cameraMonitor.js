import { locationState } from '../locationState.js';
import { sampleSurfaceHeight } from './buildings.js';
import { t, onLocaleChange } from '../i18n.js';

export function setupCameraMonitor(viewer) {
    const monitorDiv = document.createElement('div');
    monitorDiv.className = 'camera-monitor';
    document.body.appendChild(monitorDiv);

    async function updateCameraInfo() {
        const camera = viewer.camera;
        const position = camera.positionCartographic;
        try {
            // sampleSurfaceHeight handles the Google preset (depth-picks the
            // photogrammetric mesh) so the readout reflects the visible
            // ground, not the hidden ellipsoid below it.
            const terrainHeight = await sampleSurfaceHeight(
                viewer,
                Cesium.Math.toDegrees(position.longitude),
                Cesium.Math.toDegrees(position.latitude)
            );
            const heightAboveTerrain = position.height - terrainHeight;
            
            // Get current location info
            const location = locationState.getLocation();
            const addressInfo = location.status === 'found' ? {
                [t('camera.address')]: location.displayName
            } : {};

            const info = {
                ...addressInfo,
                [t('camera.position')]: {
                    [t('camera.longitude')]: Cesium.Math.toDegrees(position.longitude).toFixed(6) + '°',
                    [t('camera.latitude')]: Cesium.Math.toDegrees(position.latitude).toFixed(6) + '°',
                    [t('camera.height_above_terrain')]: heightAboveTerrain.toFixed(2) + 'm',
                    [t('camera.terrain_height')]: terrainHeight.toFixed(2) + 'm'
                },
                [t('camera.orientation')]: {
                    [t('camera.heading')]: Cesium.Math.toDegrees(camera.heading).toFixed(2) + '°',
                    [t('camera.pitch')]: Cesium.Math.toDegrees(camera.pitch).toFixed(2) + '°',
                    [t('camera.roll')]: Cesium.Math.toDegrees(camera.roll).toFixed(2) + '°'
                }
            };
            monitorDiv.textContent = JSON.stringify(info, null, 2);
        } catch (error) {
            console.error('Error updating camera info:', error);
        }
    }
    
    let updateTimeout;
    viewer.camera.changed.addEventListener(() => {
        if (!updateTimeout) {
            updateTimeout = setTimeout(() => {
                updateCameraInfo();
                updateTimeout = null;
            }, 100);
        }
    });
    
    updateCameraInfo();

    // Refresh the readout when the locale changes so the dictionary keys
    // ("Position", "Heading", …) come back in the new language.
    onLocaleChange(() => updateCameraInfo());

    return monitorDiv;
}