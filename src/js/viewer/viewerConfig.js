import { createTerrainProvider, createImageryProvider } from './providers.js';
import { setupCameraMonitor } from './cameraMonitor.js';
import { getInitialMapState, updateUrlParams } from '../mapUrlState.js';
import { setIdleMode } from './renderMode.js';
import { setupBasemaps } from './basemap.js';
import { setupBuildings } from './buildings.js';

export async function initializeViewer(containerId) {
    const terrainProvider = await createTerrainProvider();
    const imageryProvider = await createImageryProvider();
    
    const viewer = createViewer(containerId, terrainProvider, imageryProvider);
    
    await initializeViewerComponents(viewer);
    
    return viewer;
}

function createViewer(containerId, terrainProvider, imageryProvider) {
    const viewer = new Cesium.Viewer(containerId, {
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(imageryProvider),
        terrainProvider: terrainProvider,
        // animation + timeline widgets are CSS-hidden in hood and we drive
        // the clock from the day-tour button, so don't construct them.
        animation: false,
        // Cesium's default BaseLayerPicker renders a black thumbnail tile that
        // clashes with the suite UI; hood has its own basemap selector mounted
        // by controls/basemapSelector.js (Satellite / Hillshade).
        baseLayerPicker: false,
        fullscreenButton: true,
        homeButton: false,
        // Disable Cesium's default InfoBox + selection indicator. Clicking a
        // 3D Tile feature would otherwise pop up Cesium's raw-property panel
        // and the green selection box; hood has its own dark info panel
        // (info/buildingInfoPanel.js) + red silhouette outline that replace
        // both, so the defaults would just stack on top.
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        geocoder: true,
        navigationHelpButton: false,
        vrButton: true,
        clockViewModel: new Cesium.ClockViewModel(),
        // The viewer boots in idle render mode (see renderMode.js). The
        // around/day-tour buttons flip the clock back on when they need it.
        shouldAnimate: false
    });

    setupNavigationWidget(viewer);

    return viewer;
}

/**
 * Adds the circular compass + zoom-ring + distance-legend widget from the
 * viewerCesiumNavigationMixin plugin (loaded globally in index.html).
 * The compass replaces hood's old hand-rolled zoom/tilt buttons:
 *  - drag the outer ring to rotate (heading)
 *  - drag the inner gyroscope to orbit/tilt the camera
 *  - the +/- ring zooms in and out
 */
function setupNavigationWidget(viewer) {
    if (!Cesium.viewerCesiumNavigationMixin) {
        console.warn('viewerCesiumNavigationMixin not loaded; skipping compass widget');
        return;
    }
    viewer.extend(Cesium.viewerCesiumNavigationMixin, {
        enableCompass: true,
        enableZoomControls: true,
        enableDistanceLegend: true
    });
}

async function initializeViewerComponents(viewer) {
    viewer.scene.highDynamicRange = true;
    configureViewer(viewer);
    configureShadows(viewer);
    setInitialView(viewer);
    setupCameraMonitor(viewer);
    setupUrlSync(viewer);
    
    try {
        await Promise.all([
            loadTerrain(viewer),
            setupBuildings(viewer),
            setupBasemaps(viewer)
        ]);
        console.log('All assets loaded successfully');
    } catch (error) {
        console.error('Error during loading:', error);
        throw error;
    }

    // Apply idle render-mode now that the tileset is in the scene — the
    // tileset MSE setter needs the primitive to be present.
    setIdleMode(viewer);
}

async function loadTerrain(viewer) {
    await viewer.terrainProvider.readyPromise;
    console.log('Terrain loaded successfully');
}

export function configureViewer(viewer) {
    configureScene(viewer.scene);
    configureCamera(viewer.scene.screenSpaceCameraController);
    configureGlobe(viewer.scene.globe);
    configureGeocoder(viewer._geocoder);
}

function configureScene(scene) {
    scene.globe.depthTestAgainstTerrain = true;
    scene.globe.baseColor = Cesium.Color.WHITE;
    scene.backgroundColor = Cesium.Color.WHITE;
}

function configureCamera(controller) {
    controller.enableLook = true;
    controller.enableTranslate = true;
    controller.enableCollisionDetection = true;
    controller.enableZoom = true;
    controller.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
    controller.enableRotate = true;
    controller.enableTilt = true;
    
    controller.minimumZoomDistance = 5.0;
    controller.minimumCollisionTerrainHeight = 10.0;
    controller.constrainedAxis = Cesium.Cartesian3.UNIT_Z;
    controller._minimumCollisionTerrainHeight = 10.0;
    controller.minimumTrackBallHeight = 10.0;
}

function configureGlobe(globe) {
    globe.enableCollisionDetection = true;
    globe.translucency.enabled = false;
    globe.translucency.frontFaceAlpha = 1.0;
    globe.translucency.backFaceAlpha = 1.0;
}

function configureGeocoder(geocoder) {
    if (geocoder?.container) {
        geocoder.container.style.left = '10px';
        geocoder.container.style.right = 'auto';
    }
}

export function configureShadows(viewer) {
    viewer.shadows = true;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.castShadows = true;
    viewer.scene.globe.receiveShadows = true;
    viewer.shadowMap.enabled = true;
    viewer.shadowMap.softShadows = true;
    viewer.shadowMap.size = 2048;
    viewer.shadowMap.darkness = 0.3;
}

export function setInitialView(viewer) {
    const { center, zoom } = getInitialMapState();
    const [lng, lat] = center;
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, zoom),
        orientation: {
            pitch: Cesium.Math.toRadians(-20)
        }
    });
}

function setupUrlSync(viewer) {
    const sync = () => {
        const carto = viewer.camera.positionCartographic;
        if (!carto) return;
        updateUrlParams(
            Cesium.Math.toDegrees(carto.latitude),
            Cesium.Math.toDegrees(carto.longitude),
            carto.height
        );
    };
    viewer.camera.moveEnd.addEventListener(sync);
    sync();
}