// Capturing a WebGL canvas via `toBlob` only works when the context was
// created with preserveDrawingBuffer:true. Cesium ships with it disabled
// for perf reasons, so we render once and read pixels off the GL context
// directly the same frame.
export async function captureCesiumScreenshot(viewer, options = {}) {
    const { type = 'image/webp', quality = 0.85 } = options;
    if (!viewer || viewer.isDestroyed?.()) {
        throw new Error('Cesium viewer is not available');
    }

    return new Promise((resolve, reject) => {
        const scene = viewer.scene;
        const removePost = scene.postRender.addEventListener(function listener() {
            try {
                removePost();
                const canvas = scene.canvas;
                const w = canvas.width;
                const h = canvas.height;
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                let sourceCanvas = canvas;
                if (gl) {
                    const pixels = new Uint8Array(w * h * 4);
                    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    // WebGL gives us bottom-up rows; flip to top-down for canvas2d.
                    const flipped = new Uint8ClampedArray(w * h * 4);
                    const stride = w * 4;
                    for (let y = 0; y < h; y++) {
                        const src = (h - 1 - y) * stride;
                        flipped.set(pixels.subarray(src, src + stride), y * stride);
                    }
                    const out = document.createElement('canvas');
                    out.width = w;
                    out.height = h;
                    out.getContext('2d').putImageData(new ImageData(flipped, w, h), 0, 0);
                    sourceCanvas = out;
                }
                const encode = (mime) =>
                    new Promise((res) => sourceCanvas.toBlob(res, mime, quality));
                encode(type).then((blob) => {
                    if (blob) return resolve(blob);
                    // Older Safari (<14) can't encode WebP — fall back to PNG.
                    if (type !== 'image/png') {
                        encode('image/png').then((png) => {
                            if (png) resolve(png);
                            else reject(new Error('Failed to encode screenshot'));
                        });
                    } else {
                        reject(new Error('Failed to encode screenshot'));
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
        scene.requestRender();
    });
}

export function extensionForBlob(blob) {
    const subtype = (blob.type || 'image/png').split('/')[1] || 'png';
    return subtype === 'jpeg' ? 'jpg' : subtype;
}

// Pull camera state out of the Cesium viewer in the same shape as the
// roofs screenshot metadata so screenshots from hood remain queryable
// alongside the other apps.
export function getCesiumMetadata(viewer) {
    if (!viewer || viewer.isDestroyed?.()) return {};
    const camera = viewer.camera;
    const carto = camera.positionCartographic;
    if (!carto) return { is_3d_mode: true };
    return {
        central_lat: Cesium.Math.toDegrees(carto.latitude),
        central_lng: Cesium.Math.toDegrees(carto.longitude),
        zoom: carto.height,
        tilt_degree: Cesium.Math.toDegrees(camera.pitch),
        bearing_degree: Cesium.Math.toDegrees(camera.heading),
        is_3d_mode: true,
    };
}
