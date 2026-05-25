// Idle vs. active render mode.
//
// hood spends most of its time *idle*: a Cesium 3D scene that the user is
// reading or rotating-by-hand with no animation running. Cesium's defaults
// repaint every frame at 60 fps and re-render on every clock tick, so the
// viewer kept a CPU core and the GPU busy even while nothing was visibly
// changing — and the user only really wants the heavy render pipeline when
// the "Around" orbit or the "24hrs" day-tour are actually running.
//
//   * idle   — render-on-demand (requestRenderMode), frame rate capped at
//              30 fps, resolution scaled to 0.75, coarser terrain + tileset
//              LOD, clock paused so shadows don't re-cost a render on every
//              tick. Cesium only repaints when the camera moves, imagery
//              streams in, or something explicitly calls
//              `scene.requestRender()`.
//
//   * active — continuous render at full resolution and the original LOD,
//              clock animating so shadows update each frame, and the
//              render-on-demand gate disabled so the orbit / day-tour stay
//              smooth.
//
// The viewer boots into idle (see viewerConfig.js). aroundButton +
// dayTourButton wrap their start/stop transitions with these helpers.

const TILESET_IDLE_SSE = 24;
const TILESET_ACTIVE_SSE = 16;

function findTilesets(viewer) {
    const ps = viewer?.scene?.primitives;
    if (!ps) return [];
    const out = [];
    for (let i = 0; i < ps.length; i++) {
        const p = ps.get(i);
        if (p instanceof Cesium.Cesium3DTileset) out.push(p);
    }
    return out;
}

export function setIdleMode(viewer) {
    if (!viewer || viewer.isDestroyed?.()) return;
    const scene = viewer.scene;

    scene.requestRenderMode = true;
    // Infinity here means "a clock advance never, on its own, schedules a
    // render". Combined with `shouldAnimate=false` the clock is double-locked:
    // it isn't ticking, and even if something nudged it the scene wouldn't
    // repaint until a camera move or explicit `requestRender()`.
    scene.maximumRenderTimeChange = Infinity;

    viewer.targetFrameRate = 30;
    viewer.resolutionScale = 0.75;
    scene.globe.maximumScreenSpaceError = 4;

    for (const tileset of findTilesets(viewer)) {
        tileset.maximumScreenSpaceError = TILESET_IDLE_SSE;
    }

    viewer.clock.shouldAnimate = false;

    // Force one frame so the new settings + frozen-clock shadow position are
    // visible right away rather than waiting for the next camera move.
    scene.requestRender();
}

export function setActiveMode(viewer) {
    if (!viewer || viewer.isDestroyed?.()) return;
    const scene = viewer.scene;

    scene.requestRenderMode = false;
    scene.maximumRenderTimeChange = 0.0;

    viewer.targetFrameRate = 60;
    viewer.resolutionScale = 1.0;
    scene.globe.maximumScreenSpaceError = 2;

    for (const tileset of findTilesets(viewer)) {
        tileset.maximumScreenSpaceError = TILESET_ACTIVE_SSE;
    }

    viewer.clock.shouldAnimate = true;
}
