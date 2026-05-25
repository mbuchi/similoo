export function storeShadowStates(viewer) {
    return {
        shadows: viewer.shadows,
        enableLighting: viewer.scene.globe.enableLighting,
        castShadows: viewer.scene.globe.castShadows,
        receiveShadows: viewer.scene.globe.receiveShadows,
        shadowMapEnabled: viewer.shadowMap.enabled
    };
}

export function restoreShadowStates(viewer, states) {
    if (!states) return;
    
    viewer.shadows = states.shadows;
    if (viewer.scene.globe) {
        viewer.scene.globe.enableLighting = states.enableLighting;
        viewer.scene.globe.castShadows = states.castShadows;
        viewer.scene.globe.receiveShadows = states.receiveShadows;
    }
    if (viewer.shadowMap) {
        viewer.shadowMap.enabled = states.shadowMapEnabled;
    }
}