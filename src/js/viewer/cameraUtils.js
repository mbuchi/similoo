export function calculateCameraPosition(viewer, centerPoint, radius, angle, height = 75) {
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(centerPoint);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const offset = new Cesium.Cartesian3(x, y, height);
    const cameraPosition = new Cesium.Cartesian3();
    Cesium.Matrix4.multiplyByPoint(transform, offset, cameraPosition);
    
    return {
        position: cameraPosition,
        direction: calculateDirection(centerPoint, cameraPosition),
        up: calculateUpVector(viewer, cameraPosition)
    };
}

export function calculateDirection(centerPoint, cameraPosition) {
    const direction = Cesium.Cartesian3.subtract(
        centerPoint,
        cameraPosition,
        new Cesium.Cartesian3()
    );
    return Cesium.Cartesian3.normalize(direction, direction);
}

export function calculateUpVector(viewer, position) {
    return Cesium.Cartesian3.normalize(
        viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(position),
        new Cesium.Cartesian3()
    );
}

export function getGroundPoint(viewer) {
    const ray = viewer.camera.getPickRay(new Cesium.Cartesian2(
        viewer.canvas.clientWidth / 2,
        viewer.canvas.clientHeight / 2
    ));
    return viewer.scene.globe.pick(ray, viewer.scene);
}

export function setCamera(viewer, position, direction, up, pitch = -45) {
    viewer.camera.setView({
        destination: position,
        orientation: {
            direction: direction,
            up: up,
            pitch: Cesium.Math.toRadians(pitch)
        }
    });
}