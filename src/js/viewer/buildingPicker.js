// Building hover + click picker.
//
// Owns two edge-detection stages (amber for hover, red for the selected
// feature), wraps them in one silhouette composite, and drives them from a
// ScreenSpaceEventHandler. Calls the consumer's onSelect / onDeselect; the
// consumer renders the info panel.
//
// Disable via the returned controller's setEnabled(false) when the Google
// Photorealistic preset is active — that tileset is a single mesh, so
// picks return uninteresting Cesium3DTileFeature objects with no
// per-feature properties.
//
// IMPORTANT: `Cesium.PostProcessStageLibrary.createSilhouetteStage()` MUST
// be called with an explicit `edgeDetectionStages` array. Without one, the
// returned stage runs a different fragment shader that ignores `.selected`
// entirely and blends its color across the whole scene — which is exactly
// what painted the map orange in v0.3.18/0.3.19. The correct pattern is
// the one used here.

const HOVER_COLOR = '#F59E0B';      // amber-500
const SELECTED_COLOR = '#DC2626';   // hood red-600

export function setupBuildingPicker(viewer, { onSelect, onDeselect } = {}) {
    if (!viewer || viewer.isDestroyed?.()) {
        return { setEnabled: () => {}, clearSelection: () => {}, destroy: () => {} };
    }

    // ----- silhouette stages ---------------------------------------------
    const hoverEdge = Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
    hoverEdge.uniforms.color = Cesium.Color.fromCssColorString(HOVER_COLOR).withAlpha(0.9);
    hoverEdge.uniforms.length = 0.02;
    hoverEdge.selected = [];

    const selectedEdge = Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
    selectedEdge.uniforms.color = Cesium.Color.fromCssColorString(SELECTED_COLOR).withAlpha(0.95);
    selectedEdge.uniforms.length = 0.025;
    selectedEdge.selected = [];

    const silhouetteComposite = Cesium.PostProcessStageLibrary.createSilhouetteStage([
        hoverEdge,
        selectedEdge,
    ]);
    viewer.scene.postProcessStages.add(silhouetteComposite);

    // Update an edge-detection stage's `selected` array. With the composite
    // approach above, an empty array correctly means "no edges" — no whole-
    // scene tinting. We also call scene.requestRender() because hood runs
    // in idle render mode — without an explicit request, the stage's
    // internal feature-mask texture is rebuilt lazily and the second /
    // third selection can keep painting the first building's outline.
    function setSilhouette(edgeStage, feature) {
        edgeStage.selected = feature ? [feature] : [];
        viewer.scene.requestRender();
    }

    // ----- state ---------------------------------------------------------
    let enabled = true;
    let hovered = null;
    let selected = null;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    function clearHover() {
        hovered = null;
        setSilhouette(hoverEdge, null);
        viewer.scene.canvas.style.cursor = '';
    }

    function clearSelection() {
        if (!selected) return;
        selected = null;
        setSilhouette(selectedEdge, null);
        if (typeof onDeselect === 'function') onDeselect();
    }

    // ----- hover ---------------------------------------------------------
    // rAF-throttle so we don't pick on every mousemove event (Cesium scenes
    // can fire dozens per second). A single pending pick per frame is
    // plenty for the hover outline to feel responsive.
    let rafPending = false;
    let lastMovePosition = null;

    handler.setInputAction((movement) => {
        if (!enabled) return;
        lastMovePosition = movement.endPosition;
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            if (!enabled || !lastMovePosition) return;
            const picked = viewer.scene.pick(lastMovePosition);
            const feature = picked instanceof Cesium.Cesium3DTileFeature ? picked : null;

            if (feature === hovered) return;
            hovered = feature;
            // never draw the amber outline on top of the red selected one
            const showAmber = feature && feature !== selected;
            setSilhouette(hoverEdge, showAmber ? feature : null);
            viewer.scene.canvas.style.cursor = feature ? 'pointer' : '';
        });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // ----- click selection ----------------------------------------------
    handler.setInputAction((click) => {
        if (!enabled) return;
        const picked = viewer.scene.pick(click.position);
        const feature = picked instanceof Cesium.Cesium3DTileFeature ? picked : null;

        if (!feature) {
            // Empty / terrain click: deselect.
            clearSelection();
            return;
        }

        if (feature === selected) {
            // Re-clicking the already-selected building closes the panel.
            clearSelection();
            return;
        }

        // Capture the world position of the click so the metrics module
        // can ray-walk for footprint area without re-picking.
        const clickWorldPosition = viewer.scene.pickPosition(click.position);

        // Clear any stale hover state BEFORE swapping the selection — the
        // old `hovered` reference may be a different feature from a tile
        // that was reloaded between clicks, and leaving it stuck on the
        // hover stage was painting the previous building amber forever
        // even after a new selection landed.
        hovered = null;
        setSilhouette(hoverEdge, null);

        selected = feature;
        setSilhouette(selectedEdge, feature);

        if (typeof onSelect === 'function') {
            onSelect(feature, clickWorldPosition);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return {
        setEnabled(next) {
            enabled = !!next;
            if (!enabled) {
                clearHover();
                clearSelection();
            }
        },
        clearSelection() {
            clearSelection();
        },
        destroy() {
            handler.destroy();
            clearHover();
            clearSelection();
            viewer.scene.postProcessStages.remove(silhouetteComposite);
        },
    };
}
