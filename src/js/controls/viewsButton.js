export function setupViewsButton(viewer, state) {
    document.querySelectorAll('.views-option').forEach(option => {
        option.addEventListener('click', () => {
            const heading = parseFloat(option.dataset.heading);
            
            // Get the ground point at the center of the screen
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
            
            // Calculate camera position on the circle
            const radians = Cesium.Math.toRadians(heading);
            const x = state.currentRadius * Math.cos(radians);
            const y = state.currentRadius * Math.sin(radians);
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
            
            // Fly to the new view
            viewer.camera.flyTo({
                destination: cameraPosition,
                orientation: {
                    direction: direction,
                    up: up
                },
                duration: 1.5,
                complete: function() {
                    // Force exact orientation after flight
                    viewer.camera.setView({
                        destination: cameraPosition,
                        orientation: {
                            direction: direction,
                            up: up,
                            pitch: Cesium.Math.toRadians(-45) // Keep consistent tilt
                        }
                    });
                }
            });
        });
    });
}