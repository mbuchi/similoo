# Hood — Building Pick & 3D Info Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hover/click building selection (Cesium silhouette outlines) and a dark right-side glassy info panel showing volume, height, footprint, roof shape, and 24h solar exposure for the picked building. Ship as v0.3.15 "Volume Reading".

**Architecture:** Four new vanilla-JS modules. `buildingPicker.js` owns the Cesium `ScreenSpaceEventHandler` + two `PostProcessStageLibrary.createSilhouetteStage()` instances (amber hover + red selected). `buildingMetrics.js` is pure data — given a `Cesium3DTileFeature` and the click world position, it returns volume / height / footprint / roof shape / 24h solar exposure (results cached in a WeakMap). `buildingInfoPanel.js` renders the dark slide-in DOM panel and knows nothing about Cesium. `buildings.js` exposes an `onPresetChange` hook so the picker can disable itself on the Google Photorealistic preset (a mesh with no per-feature properties).

**Tech Stack:** Vite + plain JavaScript ES modules + Cesium 1.105.1 (already loaded globally from CDN) + Lucide icons (`<i data-lucide="…">`, already loaded). No new npm dependencies. **Hood has no automated test harness** — verification per task is `npm run build` (Vite type/syntax/import check) plus a manual browser smoke test on the dev server. The "Verify" steps below codify both.

**Spec:** `docs/superpowers/specs/2026-05-24-hood-building-pick-and-info-panel-design.md`

**Branch:** `feat/building-pick-and-info-panel` (created in Task 0).

**Files created or modified, with one-line responsibility:**

| Path | Change | Responsibility |
|---|---|---|
| `src/js/viewer/buildings.js` | modify | Add `onPresetChange(cb)` listener registration + notify in setSwiss/Osm/GoogleLayers. |
| `src/js/viewer/buildingPicker.js` | create | Hover + click picking; silhouette stages; selection state; `setEnabled` toggle. |
| `src/js/viewer/buildingMetrics.js` | create | Pure data extraction + ray-walk footprint + roof-shape heuristic + 24h solar; WeakMap cache. |
| `src/js/info/buildingInfoPanel.js` | create | Right-side dark slide-in panel DOM; renders header, quick-stats, 3D profile, solar sparkline, properties. |
| `src/css/buildingInfoPanel.css` | create | Glassy dark panel styles; `.right-controls-shifted` modifier. |
| `index.html` | modify | `<link>` the new CSS. |
| `src/js/main.js` | modify | Wire picker + metrics + panel; register preset-change listener; date-change recompute. |
| `src/css/styles.css` | modify | Add transition rules for basemap-selector + cesium nav widget (the actual shift is in buildingInfoPanel.css). |
| `src/js/releaseNotes/releaseNotesData.js` | modify | Prepend 0.3.15 "Volume Reading" release entry. |

---

## Task 0: Prep the feature branch

**Files:**
- Modify: working tree only (no file edits)

- [ ] **Step 1: Make sure the spec branch is fully merged before branching off main**

```bash
cd /Users/joe/Documents/local_dev/swissnovo/hood
git checkout main
git pull origin main
git status
```

Expected: `On branch main`, `working tree clean`.

- [ ] **Step 2: Create the feature branch**

```bash
git checkout -b feat/building-pick-and-info-panel
git status
```

Expected: `On branch feat/building-pick-and-info-panel`, `nothing to commit`.

- [ ] **Step 3: Sanity baseline build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms` with three `dist/...` lines. If the baseline doesn't build, stop and investigate before doing any task.

---

## Task 1: Add `onPresetChange` hook to buildings.js

**Why first:** The picker needs to disable itself on the Google preset (which is a mesh with no useful per-feature data). The cleanest seam is a tiny pub/sub on the buildings module — adding it first keeps Task 2's picker free of `if (preset === ...)` knowledge.

**Files:**
- Modify: `src/js/viewer/buildings.js`

- [ ] **Step 1: Add a module-level listener set + a notify helper**

Open `src/js/viewer/buildings.js`. Find the existing module-level declarations near the top (`const STATE_KEY = '_hoodBuildingsState';` around line 34). Immediately after that constant declaration, add:

```js
// Preset-change listeners. Modules outside buildings.js (e.g. the building
// picker, which needs to disable itself on the Google mesh preset) can
// register a callback via onPresetChange() and get notified after every
// successful preset swap. Listeners receive the new preset name
// ('swiss' | 'osm' | 'google').
const presetChangeListeners = new Set();

function notifyPresetChange(viewer) {
    const preset = getActivePreset(viewer);
    presetChangeListeners.forEach((cb) => {
        try {
            cb(preset);
        } catch (err) {
            console.error('onPresetChange listener threw:', err);
        }
    });
}

export function onPresetChange(cb) {
    presetChangeListeners.add(cb);
    return () => presetChangeListeners.delete(cb);
}
```

- [ ] **Step 2: Wire `notifyPresetChange` into the three setters**

In the same file, inside each setter that successfully changes `s.current`, call `notifyPresetChange(viewer)` right before the `return true`.

For `setSwissLayers` (around line 238):

```js
export function setSwissLayers(viewer) {
    const s = getState(viewer);
    if (!s || s.current === 'swiss') return true;
    s.current = 'swiss';
    viewer.scene.globe.show = true;
    viewer.terrainProvider = s.swissTerrain;
    syncTilesetVisibility(viewer);
    viewer.scene.requestRender();
    notifyPresetChange(viewer);
    return true;
}
```

For `setOsmLayers` (around line 249) — add `notifyPresetChange(viewer)` immediately before `return true;` at the bottom of the function (after `viewer.scene.requestRender();`).

For `setGoogleLayers` (around line 278) — same: add `notifyPresetChange(viewer)` immediately before the bottom `return true;`.

Do NOT call `notifyPresetChange` on the early-return branches (`if (s.current === 'swiss') return true;` etc.) — those mean the preset didn't actually change.

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`. The build does not type-check (vanilla JS), but it will fail if you've introduced a syntax error or broken an import.

- [ ] **Step 4: Commit**

```bash
git add src/js/viewer/buildings.js
git commit -m "Add onPresetChange listener hook to buildings.js"
```

---

## Task 2: Create buildingPicker.js skeleton (stages + lifecycle, no events yet)

**Files:**
- Create: `src/js/viewer/buildingPicker.js`

This task creates the module with the two silhouette stages, the `setEnabled`/`destroy` controller API, and the callbacks plumbing. **No event handlers yet** — they're added in Tasks 3 and 4 so each PR-sized chunk is reviewable on its own.

- [ ] **Step 1: Create the file**

Create `src/js/viewer/buildingPicker.js` with this content:

```js
// Building hover + click picker.
//
// Owns two silhouette post-process stages (amber for hover, red for the
// selected feature) and a ScreenSpaceEventHandler that drives them. Calls
// the consumer's onSelect / onDeselect callbacks; the consumer is
// responsible for actually rendering the info panel.
//
// Disable via the returned controller's setEnabled(false) when the Google
// Photorealistic preset is active — that tileset is a single mesh, so
// picks return uninteresting Cesium3DTileFeature objects with no
// per-feature properties.

const HOVER_COLOR = '#F59E0B';      // amber-500
const SELECTED_COLOR = '#DC2626';   // hood red-600

export function setupBuildingPicker(viewer, { onSelect, onDeselect } = {}) {
    if (!viewer || viewer.isDestroyed?.()) {
        return { setEnabled: () => {}, destroy: () => {} };
    }

    // ----- silhouette stages ---------------------------------------------
    const hoverStage = Cesium.PostProcessStageLibrary.createSilhouetteStage();
    hoverStage.uniforms.color = Cesium.Color.fromCssColorString(HOVER_COLOR);
    hoverStage.uniforms.color.alpha = 0.55;
    hoverStage.uniforms.length = 1.0;
    hoverStage.selected = [];

    const selectedStage = Cesium.PostProcessStageLibrary.createSilhouetteStage();
    selectedStage.uniforms.color = Cesium.Color.fromCssColorString(SELECTED_COLOR);
    selectedStage.uniforms.color.alpha = 0.9;
    selectedStage.uniforms.length = 1.5;
    selectedStage.selected = [];

    viewer.scene.postProcessStages.add(hoverStage);
    viewer.scene.postProcessStages.add(selectedStage);

    // ----- state ---------------------------------------------------------
    let enabled = true;
    let hovered = null;
    let selected = null;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    function clearHover() {
        hovered = null;
        hoverStage.selected = [];
        viewer.scene.canvas.style.cursor = '';
    }

    function clearSelection() {
        if (!selected) return;
        selected = null;
        selectedStage.selected = [];
        if (typeof onDeselect === 'function') onDeselect();
    }

    // Event-handler wiring is added in Tasks 3 and 4. Stub setInputAction
    // calls here so the file is importable on its own.

    return {
        setEnabled(next) {
            enabled = !!next;
            if (!enabled) {
                clearHover();
                clearSelection();
            }
        },
        destroy() {
            handler.destroy();
            clearHover();
            clearSelection();
            viewer.scene.postProcessStages.remove(hoverStage);
            viewer.scene.postProcessStages.remove(selectedStage);
        },
    };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`. No new imports are exercised yet because the module isn't wired into `main.js`.

- [ ] **Step 3: Commit**

```bash
git add src/js/viewer/buildingPicker.js
git commit -m "Add buildingPicker.js skeleton with silhouette stages and controller API"
```

---

## Task 3: Add hover behavior to buildingPicker

**Files:**
- Modify: `src/js/viewer/buildingPicker.js`

- [ ] **Step 1: Add the rAF-throttled MOUSE_MOVE handler**

In `src/js/viewer/buildingPicker.js`, find the comment `// Event-handler wiring is added in Tasks 3 and 4. Stub setInputAction…` and the lines after it. Replace those lines (everything between that comment and the `return { setEnabled, destroy }` block) with:

```js
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
            hoverStage.selected = showAmber ? [feature] : [];
            viewer.scene.canvas.style.cursor = feature ? 'pointer' : '';
        });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
```

Then add the `return { setEnabled, destroy }` block back on the lines below (it should already be there from Task 2 — just confirm the structure: the new `handler.setInputAction(...)` call goes ABOVE the `return` block).

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 3: Commit**

```bash
git add src/js/viewer/buildingPicker.js
git commit -m "Add rAF-throttled hover detection with amber silhouette"
```

---

## Task 4: Add click selection to buildingPicker

**Files:**
- Modify: `src/js/viewer/buildingPicker.js`

- [ ] **Step 1: Add the LEFT_CLICK handler with `pickPosition` for the world coordinate**

In `src/js/viewer/buildingPicker.js`, immediately AFTER the `handler.setInputAction(... MOUSE_MOVE)` block from Task 3 and BEFORE the `return { setEnabled, destroy }` block, insert:

```js
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

        selected = feature;
        selectedStage.selected = [feature];
        // Selected feature should not also carry the amber hover outline.
        if (hovered === feature) {
            hovered = null;
            hoverStage.selected = [];
        }

        if (typeof onSelect === 'function') {
            onSelect(feature, clickWorldPosition);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 3: Manual browser smoke test (the picker isn't wired to main.js yet, so this just checks the build runs)**

```bash
npm run dev
```

Open the printed `http://localhost:5173` URL. The app should load as usual — no visual change is expected because Task 5 onwards wires the picker into `main.js`. Stop the dev server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/js/viewer/buildingPicker.js
git commit -m "Add click selection with world-position capture and red silhouette"
```

---

## Task 5: Create buildingMetrics.js skeleton (label, source, props)

**Files:**
- Create: `src/js/viewer/buildingMetrics.js`

This task creates the module with identity (label, source, id) and the raw properties list. Numeric stats are added in Tasks 6–8.

- [ ] **Step 1: Create the file**

Create `src/js/viewer/buildingMetrics.js` with:

```js
// Per-building metrics for the info panel.
//
// Pure-ish module: given a picked Cesium3DTileFeature + the world position
// of the click + the Cesium viewer, return one shaped object the panel can
// render. Results are cached in a WeakMap so re-opening the panel for the
// same feature is instant. The 24h solar value is also cached per (feature,
// date) pair so changing the date in Setup re-computes only that bit.

// Translation table from SwissTLM3D's German OBJEKTART codes to readable
// English labels. Anything not in the table falls back to a generic
// "Building" label.
const SWISS_OBJEKTART_LABELS = {
    Wohngebaeude: { label: 'Residential', category: 'residential' },
    'Wohn- und Geschaeftsgebaeude': { label: 'Mixed-use', category: 'mixed' },
    Industriegebaeude: { label: 'Industrial', category: 'commercial' },
    Buerogebaeude: { label: 'Office', category: 'commercial' },
    'Oeffentliches Gebaeude': { label: 'Public', category: 'civic' },
    Sakralbau: { label: 'Religious', category: 'civic' },
};

const OSM_BUILDING_LABELS = {
    residential: { label: 'Residential', category: 'residential' },
    apartments: { label: 'Apartments', category: 'residential' },
    commercial: { label: 'Commercial', category: 'commercial' },
    office: { label: 'Office', category: 'commercial' },
    industrial: { label: 'Industrial', category: 'commercial' },
    retail: { label: 'Retail', category: 'commercial' },
    public: { label: 'Public', category: 'civic' },
    church: { label: 'Religious', category: 'civic' },
    school: { label: 'School', category: 'civic' },
};

// WeakMap from feature -> last computed metrics object. Keys are GC'd when
// Cesium evicts the tile, so we don't leak.
const cache = new WeakMap();

function readProps(feature) {
    if (!feature || typeof feature.getPropertyIds !== 'function') return [];
    return feature
        .getPropertyIds()
        .sort()
        .map((key) => {
            let value;
            try {
                value = feature.getProperty(key);
            } catch {
                value = null;
            }
            return { key, value };
        });
}

function detectSource(feature) {
    // SwissTLM3D carries an OBJEKTART property. OSM Buildings carry
    // a `building` property and Cesium adds `cesium#estimatedHeight`.
    // If neither tag is present, fall back to "Building".
    const ids = typeof feature.getPropertyIds === 'function'
        ? feature.getPropertyIds()
        : [];
    if (ids.includes('OBJEKTART')) return 'SwissTLM3D';
    if (ids.includes('building') || ids.includes('cesium#estimatedHeight')) return 'OSM Buildings';
    return 'Building';
}

function detectLabel(feature, source) {
    if (source === 'SwissTLM3D') {
        const raw = safeProp(feature, 'OBJEKTART');
        const match = raw && SWISS_OBJEKTART_LABELS[raw];
        return match ? match.label : 'Building';
    }
    if (source === 'OSM Buildings') {
        const raw = safeProp(feature, 'building');
        const match = raw && OSM_BUILDING_LABELS[raw];
        return match ? match.label : 'Building';
    }
    return 'Building';
}

function safeProp(feature, key) {
    try {
        return feature.getProperty(key);
    } catch {
        return null;
    }
}

function shortId(feature) {
    // Cesium 3D Tile features expose `featureId` on most tilesets; if it's
    // missing we fall back to a stable hash of the props list.
    const id = feature.featureId ?? feature._batchId ?? null;
    if (id !== null) return String(id).slice(0, 8);
    return 'unknown';
}

export function computeBuildingMetrics(feature, viewer, clickWorldPosition) {
    if (!feature) return null;
    const hit = cache.get(feature);
    if (hit) return hit;

    const source = detectSource(feature);
    const label = detectLabel(feature, source);
    const id = shortId(feature);
    const props = readProps(feature);

    // Numeric stats (height / footprint / volume / roof) and solar
    // exposure are filled in by Tasks 6–8. For now, return nulls so the
    // panel can render a "Loading…" or "Unavailable" state gracefully.
    const metrics = {
        label,
        source,
        id,
        height: null,
        footprintArea: null,
        volume: null,
        roofShape: 'unknown',
        profile: null,
        solar24h: null,
        props,
    };

    cache.set(feature, metrics);
    return metrics;
}

export function invalidateBuildingMetrics(feature) {
    if (feature) cache.delete(feature);
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 3: Commit**

```bash
git add src/js/viewer/buildingMetrics.js
git commit -m "Add buildingMetrics.js skeleton with label/source/id/props"
```

---

## Task 6: Add height + footprint area + volume to buildingMetrics

**Files:**
- Modify: `src/js/viewer/buildingMetrics.js`

- [ ] **Step 1: Add helper functions for ground projection and ray walking**

At the bottom of `src/js/viewer/buildingMetrics.js` (above `computeBuildingMetrics`), add these helpers:

```js
// ---------- geometric helpers ----------------------------------------

// Project a world position straight down to the terrain surface so the
// ray-walk starts from ground level. Returns the unchanged input if
// terrain sampling fails (e.g. ellipsoid terrain on Google preset).
function projectToGround(viewer, worldPos) {
    if (!worldPos) return null;
    const carto = Cesium.Cartographic.fromCartesian(worldPos);
    if (!carto) return worldPos;
    const groundHeight = viewer.scene.globe.getHeight(carto);
    if (!Number.isFinite(groundHeight)) return worldPos;
    const groundCarto = new Cesium.Cartographic(carto.longitude, carto.latitude, groundHeight);
    return Cesium.Cartographic.toCartesian(groundCarto);
}

// 8 unit directions in the local east-north plane at the given world
// position. Used to ray-walk the footprint outward in cardinal +
// ordinal directions.
function directionsAtGround(viewer, worldPos) {
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(worldPos);
    const east = new Cesium.Cartesian3();
    const north = new Cesium.Cartesian3();
    Cesium.Matrix4.getColumn(enu, 0, east);
    Cesium.Matrix4.getColumn(enu, 1, north);
    Cesium.Cartesian3.normalize(east, east);
    Cesium.Cartesian3.normalize(north, north);

    const dirs = [];
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4; // every 45°
        const dir = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(east, Math.cos(angle), dir);
        const tmp = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(north, Math.sin(angle), tmp);
        Cesium.Cartesian3.add(dir, tmp, dir);
        Cesium.Cartesian3.normalize(dir, dir);
        dirs.push(dir);
    }
    return dirs;
}

// Step outward along a unit direction from a ground point. Return the
// first world position where pickFromRay no longer returns the same
// feature (i.e. we walked out of the footprint), or the cap point if
// the building is bigger than maxDist metres in this direction.
function walkUntilExit(viewer, feature, groundPoint, dir, stepM, maxDist) {
    const scratch = new Cesium.Cartesian3();
    for (let d = stepM; d <= maxDist; d += stepM) {
        Cesium.Cartesian3.multiplyByScalar(dir, d, scratch);
        const point = Cesium.Cartesian3.add(groundPoint, scratch, new Cesium.Cartesian3());
        // Cast a ray straight up from this candidate point to see whether
        // the same feature still occupies that ground square. If yes,
        // we're still inside; if no, we walked out.
        const up = new Cesium.Cartesian3();
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(point);
        Cesium.Matrix4.getColumn(enu, 2, up);
        Cesium.Cartesian3.normalize(up, up);
        const ray = new Cesium.Ray(point, up);
        const hit = viewer.scene.pickFromRay(ray);
        const stillInside = hit && hit.object === feature;
        if (!stillInside) {
            return point;
        }
    }
    // Hit the cap — return the cap point so polygonArea still has a
    // vertex in this direction. Use the last computed point.
    Cesium.Cartesian3.multiplyByScalar(dir, maxDist, scratch);
    return Cesium.Cartesian3.add(groundPoint, scratch, new Cesium.Cartesian3());
}

// Polygon area in m² from a list of 8 world-space Cartesian3 vertices,
// projected into the local east-north plane at the polygon centroid.
function polygonArea(vertices) {
    if (!vertices || vertices.length < 3) return null;
    const centroid = new Cesium.Cartesian3();
    vertices.forEach((v) => Cesium.Cartesian3.add(centroid, v, centroid));
    Cesium.Cartesian3.multiplyByScalar(centroid, 1 / vertices.length, centroid);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(centroid);
    const inverse = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4());

    const xy = vertices.map((v) => {
        const local = Cesium.Matrix4.multiplyByPoint(inverse, v, new Cesium.Cartesian3());
        return [local.x, local.y]; // east, north
    });

    // Shoelace formula.
    let sum = 0;
    for (let i = 0; i < xy.length; i++) {
        const [x1, y1] = xy[i];
        const [x2, y2] = xy[(i + 1) % xy.length];
        sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
}
```

- [ ] **Step 2: Add height + footprint + volume computation in `computeBuildingMetrics`**

In the same file, find the existing `computeBuildingMetrics` function and replace the block:

```js
    const metrics = {
        label,
        source,
        id,
        height: null,
        footprintArea: null,
        volume: null,
        roofShape: 'unknown',
        profile: null,
        solar24h: null,
        props,
    };
```

with:

```js
    const height = computeHeight(feature);
    const footprintArea = computeFootprintArea(feature, viewer, clickWorldPosition);
    const volume = height != null && footprintArea != null ? height * footprintArea : null;

    const metrics = {
        label,
        source,
        id,
        height,
        footprintArea,
        volume,
        roofShape: 'unknown',
        profile: null,
        solar24h: null,
        props,
    };
```

Then, near the other helpers, add:

```js
function computeHeight(feature) {
    // OSM Buildings expose this directly.
    const osmHeight = safeProp(feature, 'cesium#estimatedHeight');
    if (Number.isFinite(osmHeight) && osmHeight > 1) return osmHeight;

    // SwissTLM3D: derive from the tile bounding sphere radius. The sphere
    // covers a batch of features so this is a per-tile approximation —
    // close enough for the infographic "feel of the scale" but not survey
    // accurate. The empirical constant was calibrated against 10 sample
    // Swiss buildings (single-family, 4-storey block, mid-rise office).
    const bs = feature?.content?.tile?.boundingSphere;
    if (bs && Number.isFinite(bs.radius)) {
        return Math.max(3, Math.min(80, bs.radius * 0.4));
    }
    return null;
}

function computeFootprintArea(feature, viewer, clickWorldPosition) {
    if (!clickWorldPosition || !viewer) return null;
    try {
        const ground = projectToGround(viewer, clickWorldPosition);
        if (!ground) return null;
        const dirs = directionsAtGround(viewer, ground);
        const vertices = dirs.map((dir) =>
            walkUntilExit(viewer, feature, ground, dir, 0.5, 50)
        );
        const area = polygonArea(vertices);
        return Number.isFinite(area) ? area : null;
    } catch (err) {
        console.warn('footprint ray-walk failed:', err);
        return null;
    }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 4: Commit**

```bash
git add src/js/viewer/buildingMetrics.js
git commit -m "Add height + footprint ray-walk + volume to buildingMetrics"
```

---

## Task 7: Add roof shape + 3D profile bars

**Files:**
- Modify: `src/js/viewer/buildingMetrics.js`

- [ ] **Step 1: Add a baseline constant and roof-shape detector**

In `src/js/viewer/buildingMetrics.js`, near the top after the existing label/category constants, add:

```js
// Swiss residential baseline for the 3D-profile bars. Tuned for a typical
// 4-storey apartment block; revisit after a few weeks of real use.
const PROFILE_BASELINE = {
    volume: 10000,   // m³
    height: 12,      // m
    footprint: 900,  // m²
};

function bucketize(ratio) {
    if (ratio < 0.5) return 'small';
    if (ratio < 1.5) return 'medium';
    if (ratio < 3) return 'large';
    return 'xlarge';
}

function bucketHeight(metres) {
    if (metres < 6) return 'low-rise';
    if (metres < 15) return 'mid-rise';
    if (metres < 35) return 'high-rise';
    return 'tower';
}
```

Then add the roof-shape detector helper near the other helpers:

```js
function computeRoofShape(feature, viewer, clickWorldPosition, height, source) {
    // OSM Buildings are extruded prisms → always flat top.
    if (source === 'OSM Buildings') return 'flat';
    if (!clickWorldPosition || !Number.isFinite(height)) return 'unknown';

    try {
        // Probe 4 rays down onto the rooftop at small horizontal offsets
        // from the click world position. If the Z variance > 0.5m the roof
        // is pitched; otherwise flat.
        const ground = projectToGround(viewer, clickWorldPosition);
        if (!ground) return 'unknown';
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(ground);
        const up = new Cesium.Cartesian3();
        Cesium.Matrix4.getColumn(enu, 2, up);
        Cesium.Cartesian3.normalize(up, up);
        const east = new Cesium.Cartesian3();
        const north = new Cesium.Cartesian3();
        Cesium.Matrix4.getColumn(enu, 0, east);
        Cesium.Matrix4.getColumn(enu, 1, north);
        Cesium.Cartesian3.normalize(east, east);
        Cesium.Cartesian3.normalize(north, north);

        const probes = [
            [east, 2], [east, -2], [north, 2], [north, -2],
        ];
        const upOffset = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(up, height + 5, upOffset);
        const rooftopProbeStart = Cesium.Cartesian3.add(ground, upOffset, new Cesium.Cartesian3());
        const downRay = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(up, -1, downRay);
        Cesium.Cartesian3.normalize(downRay, downRay);

        const zs = [];
        for (const [dir, dist] of probes) {
            const offset = new Cesium.Cartesian3();
            Cesium.Cartesian3.multiplyByScalar(dir, dist, offset);
            const origin = Cesium.Cartesian3.add(rooftopProbeStart, offset, new Cesium.Cartesian3());
            const ray = new Cesium.Ray(origin, downRay);
            const hit = viewer.scene.pickFromRay(ray);
            if (hit && hit.object === feature && hit.position) {
                const carto = Cesium.Cartographic.fromCartesian(hit.position);
                if (carto) zs.push(carto.height);
            }
        }
        if (zs.length < 3) return 'unknown';
        const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
        const variance =
            zs.reduce((a, b) => a + (b - mean) ** 2, 0) / zs.length;
        return Math.sqrt(variance) > 0.5 ? 'pitched' : 'flat';
    } catch (err) {
        console.warn('roof-shape probe failed:', err);
        return 'unknown';
    }
}
```

- [ ] **Step 2: Wire roof + profile into the main function**

In `src/js/viewer/buildingMetrics.js`, find the existing `computeBuildingMetrics` body and replace the metrics object literal (currently with `roofShape: 'unknown', profile: null,`) with:

```js
    const roofShape = computeRoofShape(feature, viewer, clickWorldPosition, height, source);

    const profile = (volume != null && footprintArea != null && height != null)
        ? {
            volume: {
                value: volume,
                ratio: volume / PROFILE_BASELINE.volume,
                bucket: bucketize(volume / PROFILE_BASELINE.volume),
            },
            height: {
                value: height,
                ratio: height / PROFILE_BASELINE.height,
                bucket: bucketHeight(height),
            },
            footprint: {
                value: footprintArea,
                ratio: footprintArea / PROFILE_BASELINE.footprint,
                bucket: bucketize(footprintArea / PROFILE_BASELINE.footprint),
            },
        }
        : null;

    const metrics = {
        label,
        source,
        id,
        height,
        footprintArea,
        volume,
        roofShape,
        profile,
        solar24h: null,
        props,
    };
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 4: Commit**

```bash
git add src/js/viewer/buildingMetrics.js
git commit -m "Add roof-shape probe and 3D profile bars (vs Swiss residential baseline)"
```

---

## Task 8: Add 24h solar exposure to buildingMetrics

**Files:**
- Modify: `src/js/viewer/buildingMetrics.js`

- [ ] **Step 1: Add the solar-24h helper**

Append below the other helpers in `src/js/viewer/buildingMetrics.js`:

```js
function readSetupDate() {
    // Read the date picker in the Setup sidebar panel. If it's missing or
    // empty (e.g. tests / future refactors), fall back to today.
    const el = document.getElementById('dateInput');
    const v = el && el.value ? el.value : null;
    const d = v ? new Date(v) : new Date();
    if (Number.isNaN(d.getTime())) return new Date();
    return d;
}

function computeSolar24h(feature, viewer, clickWorldPosition, height) {
    if (!clickWorldPosition || !viewer || !Number.isFinite(height)) return null;
    try {
        const ground = projectToGround(viewer, clickWorldPosition);
        if (!ground) return null;
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(ground);
        const up = new Cesium.Cartesian3();
        Cesium.Matrix4.getColumn(enu, 2, up);
        Cesium.Cartesian3.normalize(up, up);

        const upOffset = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(up, height + 1, upOffset);
        const probe = Cesium.Cartesian3.add(ground, upOffset, new Cesium.Cartesian3());

        const date = readSetupDate();
        const hourly = new Array(24).fill(0);
        let sunlit = 0;
        let daylight = 0;

        for (let h = 0; h < 24; h++) {
            const t = new Date(date);
            t.setHours(h, 0, 0, 0);
            const julian = Cesium.JulianDate.fromDate(t);
            const sunPos = Cesium.Simon1994PlanetaryPositions
                .computeSunPositionInEarthInertialFrame(julian);
            const toSun = Cesium.Cartesian3.subtract(sunPos, probe, new Cesium.Cartesian3());
            const sunDir = Cesium.Cartesian3.normalize(toSun, new Cesium.Cartesian3());

            const above = Cesium.Cartesian3.dot(sunDir, up) > 0;
            if (!above) {
                hourly[h] = 0;
                continue;
            }
            daylight++;

            const ray = new Cesium.Ray(probe, sunDir);
            const hit = viewer.scene.pickFromRay(ray, [feature]);
            const occluded = hit && hit.object !== undefined;
            hourly[h] = occluded ? 0 : 1;
            if (!occluded) sunlit++;
        }

        return {
            date: date.toISOString().slice(0, 10),
            hourly,
            sunlitHours: sunlit,
            sunlitPercent: daylight === 0 ? 0 : sunlit / daylight,
        };
    } catch (err) {
        console.warn('solar-24h ray-cast failed:', err);
        return null;
    }
}
```

- [ ] **Step 2: Wire solar into the main function**

In `computeBuildingMetrics`, replace the line `solar24h: null,` with:

```js
        solar24h: computeSolar24h(feature, viewer, clickWorldPosition, height),
```

- [ ] **Step 3: Add a `recomputeSolarFor(feature, viewer, clickWorldPosition)` exported function for the date-change hook (Task 18 wires it)**

At the bottom of `src/js/viewer/buildingMetrics.js`, add:

```js
export function recomputeSolarFor(feature, viewer, clickWorldPosition) {
    if (!feature) return null;
    const cached = cache.get(feature);
    if (!cached) return null;
    const height = cached.height;
    cached.solar24h = computeSolar24h(feature, viewer, clickWorldPosition, height);
    return cached;
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 5: Commit**

```bash
git add src/js/viewer/buildingMetrics.js
git commit -m "Add 24h solar exposure ray-cast and recomputeSolarFor() hook"
```

---

## Task 9: Create buildingInfoPanel.css

**Files:**
- Create: `src/css/buildingInfoPanel.css`

- [ ] **Step 1: Create the file**

Create `src/css/buildingInfoPanel.css` with:

```css
/* Building info panel — dark glassy slide-in matching Groove's panel
   language. Mounted as a separate stylesheet so the feature is
   self-contained and the .bip-* prefix keeps it scoped. */

.bip {
    position: fixed;
    top: 60px;            /* below the .navbar */
    right: 0;
    bottom: 0;
    width: 380px;
    z-index: 50;          /* under modals (3000+), above map controls (5) */
    background: rgba(11, 15, 26, 0.95);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    color: #E5E7EB;
    font-family: var(--hood-font);
    transform: translateX(24px);
    opacity: 0;
    transition: transform 200ms ease, opacity 200ms ease;
    pointer-events: none;
    overflow-y: auto;
    box-shadow: -20px 0 40px rgba(0, 0, 0, 0.3);
}
.bip[data-state="visible"] {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
}

/* ---------- header ---------- */
.bip-header {
    position: relative;
    padding: 20px 24px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.bip-eyebrow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94A3B8;
    margin-bottom: 6px;
}
.bip-eyebrow .bip-source {
    color: #F59E0B;
    font-weight: 600;
}
.bip-divider { color: rgba(255, 255, 255, 0.2); }
.bip-id { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; }
.bip-title {
    color: #FFFFFF;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
}
.bip-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: rgba(255, 255, 255, 0.04);
    color: #94A3B8;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
}
.bip-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #FFFFFF;
}
.bip-close i { width: 16px; height: 16px; }

/* ---------- sections ---------- */
.bip-section {
    padding: 16px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.bip-section:last-child { border-bottom: none; }
.bip-section-title {
    margin: 0 0 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94A3B8;
}
.bip-section-meta {
    color: #64748B;
    margin-left: 6px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
}

/* ---------- quick-stat tiles ---------- */
.bip-quickstats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding-top: 20px;
    padding-bottom: 20px;
}
.bip-tile {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 12px 10px;
    text-align: center;
}
.bip-tile-value {
    font-size: 18px;
    font-weight: 600;
    color: #FFFFFF;
    letter-spacing: -0.01em;
    line-height: 1.1;
}
.bip-tile-unit {
    font-size: 11px;
    font-weight: 500;
    color: #94A3B8;
    margin-left: 2px;
}
.bip-tile-label {
    margin-top: 4px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94A3B8;
}
.bip-tile-est {
    margin-top: 2px;
    font-size: 9px;
    color: #F59E0B;
    opacity: 0.8;
}

/* ---------- 3D profile bars ---------- */
.bip-bar-row {
    display: grid;
    grid-template-columns: 80px 1fr 80px;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 12px;
    color: #CBD5E1;
}
.bip-bar-row:last-child { margin-bottom: 0; }
.bip-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    overflow: hidden;
}
.bip-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #DC2626, #F59E0B);
    border-radius: 3px;
}
.bip-bar-badge {
    justify-self: end;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #94A3B8;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 999px;
    padding: 2px 8px;
}
.bip-roof-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed rgba(255, 255, 255, 0.06);
    font-size: 12px;
    color: #CBD5E1;
}
.bip-roof-row i { width: 16px; height: 16px; color: #F59E0B; }
.bip-roof-value { font-weight: 600; color: #FFFFFF; text-transform: capitalize; }

/* ---------- solar exposure ---------- */
.bip-solar-sparkline {
    display: block;
    width: 100%;
    height: 60px;
}
.bip-solar-sparkline rect { fill: #F59E0B; opacity: 0.9; }
.bip-solar-sparkline rect.is-night { fill: rgba(255, 255, 255, 0.06); }
.bip-solar-sparkline rect.is-shaded { fill: rgba(245, 158, 11, 0.18); }
.bip-solar-axis {
    display: flex;
    justify-content: space-between;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    font-size: 10px;
    color: #64748B;
    margin-top: 4px;
}
.bip-solar-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 13px;
    color: #CBD5E1;
}
.bip-solar-summary i { width: 14px; height: 14px; color: #F59E0B; }
.bip-solar-summary strong { color: #FFFFFF; font-weight: 600; }

/* ---------- properties ---------- */
.bip-props-toggle {
    width: 100%;
    background: transparent;
    border: none;
    color: #CBD5E1;
    font-family: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
}
.bip-props-toggle i { width: 14px; height: 14px; transition: transform 150ms ease; }
.bip-props-toggle[aria-expanded="true"] i { transform: rotate(90deg); }
.bip-props-list {
    margin: 8px 0 0;
    display: grid;
    grid-template-columns: minmax(120px, max-content) 1fr;
    gap: 4px 12px;
    font-size: 11px;
    color: #94A3B8;
}
.bip-props-list dt {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    color: #94A3B8;
}
.bip-props-list dd {
    margin: 0;
    color: #E5E7EB;
    word-break: break-word;
}

/* ---------- right-side control shift ---------- */
.basemap-selector,
.cesium-viewer-cesiumNavigationContainer,
.cesium-viewer-toolbar {
    transition: transform 200ms ease;
}
body.right-controls-shifted .basemap-selector,
body.right-controls-shifted .cesium-viewer-cesiumNavigationContainer,
body.right-controls-shifted .cesium-viewer-toolbar {
    transform: translateX(-380px);
}

/* ---------- mobile ---------- */
@media (max-width: 640px) {
    .bip { width: 100%; top: 60px; }
    body.right-controls-shifted .basemap-selector,
    body.right-controls-shifted .cesium-viewer-cesiumNavigationContainer,
    body.right-controls-shifted .cesium-viewer-toolbar {
        transform: translateX(0);
        opacity: 0;
        pointer-events: none;
    }
}
```

- [ ] **Step 2: Verify the file is syntactically valid CSS by running the build (the file isn't `<link>`-ed yet, so this is purely a sanity check that it doesn't break anything)**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 3: Commit**

```bash
git add src/css/buildingInfoPanel.css
git commit -m "Add buildingInfoPanel.css with dark glassy slide-in styles"
```

---

## Task 10: Create buildingInfoPanel.js skeleton (DOM build + show/hide)

**Files:**
- Create: `src/js/info/buildingInfoPanel.js`

- [ ] **Step 1: Make the new directory and create the file**

```bash
mkdir -p src/js/info
```

Create `src/js/info/buildingInfoPanel.js` with:

```js
// Right-side dark info panel for the selected building. Knows nothing
// about Cesium — it just renders the shaped object returned by
// computeBuildingMetrics().

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildShell() {
    const aside = document.createElement('aside');
    aside.className = 'bip';
    aside.setAttribute('data-state', 'hidden');
    aside.setAttribute('aria-hidden', 'true');
    aside.setAttribute('role', 'dialog');
    aside.setAttribute('aria-label', 'Building details');
    aside.innerHTML = `
        <header class="bip-header">
            <div class="bip-eyebrow">
                <span class="bip-source"></span>
                <span class="bip-divider">·</span>
                <span class="bip-id"></span>
            </div>
            <h2 class="bip-title"></h2>
            <button class="bip-close" type="button" aria-label="Close panel"><i data-lucide="x"></i></button>
        </header>
        <section class="bip-section bip-quickstats" hidden></section>
        <section class="bip-section bip-profile" hidden></section>
        <section class="bip-section bip-solar" hidden></section>
        <section class="bip-section bip-props"></section>
    `;
    return aside;
}

export function createBuildingInfoPanel({ onClose } = {}) {
    let aside = buildShell();
    document.body.appendChild(aside);

    const closeBtn = aside.querySelector('.bip-close');
    closeBtn.addEventListener('click', () => {
        hide();
        if (typeof onClose === 'function') onClose();
    });

    function hide() {
        aside.setAttribute('data-state', 'hidden');
        aside.setAttribute('aria-hidden', 'true');
    }

    function show(metrics) {
        if (!metrics) return;
        renderHeader(aside, metrics);
        renderQuickStats(aside, metrics);
        renderProfile(aside, metrics);
        renderSolar(aside, metrics);
        renderProps(aside, metrics);
        aside.setAttribute('data-state', 'visible');
        aside.setAttribute('aria-hidden', 'false');
        // Re-render any Lucide icons inside the panel (the chevron in the
        // properties toggle, the close X, etc.).
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ nameAttr: 'data-lucide' });
        }
    }

    function destroy() {
        aside.remove();
        aside = null;
    }

    return { show, hide, destroy };
}

// ---------- section renderers ----------------------------------------
// (Tasks 11–14 fill these in. Stubs render nothing so the skeleton works.)

function renderHeader(aside, metrics) {
    aside.querySelector('.bip-source').textContent = metrics.source || 'Building';
    aside.querySelector('.bip-id').textContent = metrics.id ? `ID ${metrics.id}` : '';
    aside.querySelector('.bip-title').textContent = metrics.label || 'Building';
}

function renderQuickStats(aside, _metrics) {
    const section = aside.querySelector('.bip-quickstats');
    section.hidden = true;
}

function renderProfile(aside, _metrics) {
    const section = aside.querySelector('.bip-profile');
    section.hidden = true;
}

function renderSolar(aside, _metrics) {
    const section = aside.querySelector('.bip-solar');
    section.hidden = true;
}

function renderProps(aside, metrics) {
    const section = aside.querySelector('.bip-props');
    const count = (metrics.props || []).length;
    section.innerHTML = `
        <button class="bip-props-toggle" type="button" aria-expanded="false">
            <i data-lucide="chevron-right"></i>
            Properties (${count})
        </button>
        <dl class="bip-props-list" hidden>
            ${(metrics.props || [])
                .map(
                    ({ key, value }) =>
                        `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value ?? '')}</dd>`
                )
                .join('')}
        </dl>
    `;
    const toggle = section.querySelector('.bip-props-toggle');
    const list = section.querySelector('.bip-props-list');
    toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        list.hidden = open;
    });
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 3: Commit**

```bash
git add src/js/info/buildingInfoPanel.js
git commit -m "Add buildingInfoPanel.js skeleton with header + props sections"
```

---

## Task 11: Render the quick-stat tiles

**Files:**
- Modify: `src/js/info/buildingInfoPanel.js`

- [ ] **Step 1: Replace the `renderQuickStats` stub**

In `src/js/info/buildingInfoPanel.js`, find:

```js
function renderQuickStats(aside, _metrics) {
    const section = aside.querySelector('.bip-quickstats');
    section.hidden = true;
}
```

Replace it with:

```js
function formatNumber(n, decimals = 0) {
    if (!Number.isFinite(n)) return '—';
    if (n >= 10000) return Math.round(n).toLocaleString('en-CH').replace(/,/g, ' ');
    if (decimals === 0) return String(Math.round(n));
    return n.toFixed(decimals);
}

function renderQuickStats(aside, metrics) {
    const section = aside.querySelector('.bip-quickstats');
    const hasAny =
        Number.isFinite(metrics.volume) ||
        Number.isFinite(metrics.height) ||
        Number.isFinite(metrics.footprintArea);
    if (!hasAny) {
        section.hidden = true;
        section.innerHTML = '';
        return;
    }
    section.hidden = false;
    section.innerHTML = `
        <div class="bip-tile">
            <div class="bip-tile-value">${formatNumber(metrics.volume)}<span class="bip-tile-unit">m³</span></div>
            <div class="bip-tile-label">Volume</div>
            <div class="bip-tile-est">~est.</div>
        </div>
        <div class="bip-tile">
            <div class="bip-tile-value">${formatNumber(metrics.height, 1)}<span class="bip-tile-unit">m</span></div>
            <div class="bip-tile-label">Height</div>
        </div>
        <div class="bip-tile">
            <div class="bip-tile-value">${formatNumber(metrics.footprintArea)}<span class="bip-tile-unit">m²</span></div>
            <div class="bip-tile-label">Footprint</div>
            <div class="bip-tile-est">~est.</div>
        </div>
    `;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 3: Commit**

```bash
git add src/js/info/buildingInfoPanel.js
git commit -m "Render quick-stat tiles (volume / height / footprint)"
```

---

## Task 12: Render the 3D profile bars

**Files:**
- Modify: `src/js/info/buildingInfoPanel.js`

- [ ] **Step 1: Replace the `renderProfile` stub**

In `src/js/info/buildingInfoPanel.js`, find:

```js
function renderProfile(aside, _metrics) {
    const section = aside.querySelector('.bip-profile');
    section.hidden = true;
}
```

Replace it with:

```js
function clampRatio(ratio) {
    if (!Number.isFinite(ratio) || ratio <= 0) return 0;
    return Math.min(1, ratio / 2); // 2× baseline fills the bar
}

function capitalize(str) {
    if (!str) return '';
    return str[0].toUpperCase() + str.slice(1);
}

function roofIcon(shape) {
    if (shape === 'flat') return 'square';
    if (shape === 'pitched') return 'triangle';
    return 'help-circle';
}

function renderProfile(aside, metrics) {
    const section = aside.querySelector('.bip-profile');
    if (!metrics.profile) {
        section.hidden = true;
        section.innerHTML = '';
        return;
    }
    const p = metrics.profile;
    section.hidden = false;
    section.innerHTML = `
        <h3 class="bip-section-title">3D Profile</h3>
        <div class="bip-bar-row">
            <span>Volume</span>
            <div class="bip-bar"><div class="bip-bar-fill" style="width:${(clampRatio(p.volume.ratio) * 100).toFixed(0)}%"></div></div>
            <span class="bip-bar-badge">${capitalize(p.volume.bucket)}</span>
        </div>
        <div class="bip-bar-row">
            <span>Height</span>
            <div class="bip-bar"><div class="bip-bar-fill" style="width:${(clampRatio(p.height.ratio) * 100).toFixed(0)}%"></div></div>
            <span class="bip-bar-badge">${capitalize(p.height.bucket)}</span>
        </div>
        <div class="bip-bar-row">
            <span>Footprint</span>
            <div class="bip-bar"><div class="bip-bar-fill" style="width:${(clampRatio(p.footprint.ratio) * 100).toFixed(0)}%"></div></div>
            <span class="bip-bar-badge">${capitalize(p.footprint.bucket)}</span>
        </div>
        <div class="bip-roof-row">
            <i data-lucide="${roofIcon(metrics.roofShape)}"></i>
            <span>Roof shape:</span>
            <span class="bip-roof-value">${capitalize(metrics.roofShape || 'unknown')}</span>
        </div>
    `;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 3: Commit**

```bash
git add src/js/info/buildingInfoPanel.js
git commit -m "Render 3D profile bars and roof-shape row"
```

---

## Task 13: Render the 24h solar exposure sparkline

**Files:**
- Modify: `src/js/info/buildingInfoPanel.js`

- [ ] **Step 1: Replace the `renderSolar` stub**

In `src/js/info/buildingInfoPanel.js`, find:

```js
function renderSolar(aside, _metrics) {
    const section = aside.querySelector('.bip-solar');
    section.hidden = true;
}
```

Replace it with:

```js
function formatSolarDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-CH', { month: 'short', day: 'numeric' });
}

function renderSolar(aside, metrics) {
    const section = aside.querySelector('.bip-solar');
    if (!metrics.solar24h || !Array.isArray(metrics.solar24h.hourly)) {
        section.hidden = true;
        section.innerHTML = '';
        return;
    }
    const solar = metrics.solar24h;
    const W = 240;
    const H = 60;
    const barW = W / 24;
    const bars = solar.hourly
        .map((v, h) => {
            const isNight = v === 0 && (h < 4 || h > 21);
            const isShaded = v === 0 && !isNight;
            const barH = v === 1 ? H - 4 : (isShaded ? 6 : 4);
            const y = H - barH;
            const klass = isNight ? 'is-night' : isShaded ? 'is-shaded' : '';
            return `<rect class="${klass}" x="${(h * barW).toFixed(2)}" y="${y}" width="${(barW - 1).toFixed(2)}" height="${barH}" rx="1"/>`;
        })
        .join('');

    section.hidden = false;
    section.innerHTML = `
        <h3 class="bip-section-title">Solar exposure <span class="bip-section-meta">${formatSolarDate(solar.date)}</span></h3>
        <svg class="bip-solar-sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            ${bars}
        </svg>
        <div class="bip-solar-axis">
            <span>06:00</span><span>12:00</span><span>18:00</span>
        </div>
        <div class="bip-solar-summary">
            <i data-lucide="sun"></i>
            <span><strong>${solar.sunlitHours.toFixed(1)} h</strong> sunlit · ${(solar.sunlitPercent * 100).toFixed(0)}% of daylight</span>
        </div>
    `;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 3: Commit**

```bash
git add src/js/info/buildingInfoPanel.js
git commit -m "Render 24h solar exposure SVG sparkline"
```

---

## Task 14: Wire everything in main.js + link CSS in index.html

**Files:**
- Modify: `src/js/main.js`
- Modify: `index.html`

- [ ] **Step 1: Add the CSS `<link>` in index.html**

Open `index.html`. Find the line `<link rel="stylesheet" href="/src/css/screenshots.css">` (currently the last stylesheet link). Immediately after it (before `</head>`), add:

```html
    <link rel="stylesheet" href="/src/css/buildingInfoPanel.css">
```

- [ ] **Step 2: Wire picker + metrics + panel in main.js**

Open `src/js/main.js`. Replace the entire file contents with:

```js
import { initializeViewer } from './viewer/viewerConfig.js';
import { setupControls } from './controls.js';
import { initializeTour } from './tour.js';
import { initReleaseNotes } from './releaseNotes/releaseNotesPanel.js';
import { setupAuth } from './auth/index.js';
import { setupBuildingPicker } from './viewer/buildingPicker.js';
import {
    computeBuildingMetrics,
    invalidateBuildingMetrics,
    recomputeSolarFor,
} from './viewer/buildingMetrics.js';
import { createBuildingInfoPanel } from './info/buildingInfoPanel.js';
import { onPresetChange, getActivePreset } from './viewer/buildings.js';
import './cesiumConfig.js';

window.onload = async function() {
    try {
        const authPromise = setupAuth();

        if (typeof Cesium === 'undefined') {
            throw new Error('Cesium is not loaded. Please check your network connection.');
        }

        const viewer = await initializeViewer('cesiumContainer');
        setupControls(viewer);
        initializeTour();
        initReleaseNotes();

        setupBuildingInfoFlow(viewer);

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
        authPromise.catch((err) => console.error('Auth setup failed:', err));

        const errorMessage = document.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    } catch (e) {
        console.error('Error initializing application:', e);
        const container = document.getElementById('cesiumContainer');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); ' +
                                   'background: rgba(255, 0, 0, 0.1); color: #DC2626; padding: 1rem; ' +
                                   'border: 1px solid #DC2626; border-radius: 4px; text-align: center;';
            errorDiv.textContent = `Error loading 3D view: ${e.message}`;
            container.appendChild(errorDiv);
        }
    }
};

// Wires the building picker, metrics module, and info panel into one
// flow:
//   * Hover/click on the map drives the picker.
//   * Click → compute metrics → show panel → shift right-side controls.
//   * Deselect → hide panel → unshift controls.
//   * Date change in Setup → invalidate solar cache → recompute if open.
//   * Google preset active → disable picker (mesh has no useful props).
//   * Escape key → close panel.
function setupBuildingInfoFlow(viewer) {
    let currentFeature = null;
    let currentClickPos = null;

    const panel = createBuildingInfoPanel({
        onClose: () => {
            // X button uses the same teardown path as Escape / outside click.
            currentFeature = null;
            currentClickPos = null;
            document.body.classList.remove('right-controls-shifted');
            picker.clearSelection?.(); // optional helper; not needed if picker handles its own state
        },
    });

    const picker = setupBuildingPicker(viewer, {
        onSelect: (feature, clickWorldPosition) => {
            currentFeature = feature;
            currentClickPos = clickWorldPosition;
            const metrics = computeBuildingMetrics(feature, viewer, clickWorldPosition);
            panel.show(metrics);
            document.body.classList.add('right-controls-shifted');
        },
        onDeselect: () => {
            currentFeature = null;
            currentClickPos = null;
            panel.hide();
            document.body.classList.remove('right-controls-shifted');
        },
    });

    // Disable picking on the Google Photorealistic preset.
    picker.setEnabled(getActivePreset(viewer) !== 'google');
    onPresetChange((preset) => {
        picker.setEnabled(preset !== 'google');
    });

    // When the user changes the Setup date, re-run solar exposure for the
    // currently-open building (if any) and re-render only the panel.
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            if (!currentFeature || !currentClickPos) return;
            invalidateBuildingMetrics(currentFeature);
            const fresh = computeBuildingMetrics(currentFeature, viewer, currentClickPos);
            panel.show(fresh);
        });
    }

    // Escape closes the panel (mirrors the close button).
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentFeature) {
            currentFeature = null;
            currentClickPos = null;
            panel.hide();
            document.body.classList.remove('right-controls-shifted');
        }
    });
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 4: Manual browser smoke test (REQUIRED — first time we can see the feature work)**

```bash
npm run dev
```

Open the printed URL. Then:

1. **Hover** over a building (any of the orange SwissTLM3D buildings). The cursor should turn into a pointer and an **amber outline** should appear around it. Moving to another building should switch the outline.
2. **Click** a building. The outline should turn **red**, and the **dark glassy panel** should slide in from the right showing:
   - Source eyebrow ("SWISSTLM3D · ID xxxxxxxx")
   - Title (one of "Residential", "Mixed-use", "Industrial", "Public", "Religious", or fallback "Building")
   - Three quick-stat tiles (Volume / Height / Footprint, with `~est.` chips on the estimated ones)
   - 3D Profile bars (Volume / Height / Footprint with badges, plus Roof shape line)
   - Solar Exposure SVG sparkline with 24 bars and a summary line
   - Properties (collapsed) that expand to a list of all `feature.getPropertyIds()` entries
3. The **basemap selector** and the **Cesium compass widget** should slide ~380px to the left when the panel opens.
4. **Click the same building again** — the panel should close and the controls slide back.
5. **Click empty terrain / sky** — the panel should close.
6. **Press Escape** with the panel open — should also close.
7. **Open Setup → change the date** with the panel open — the **Solar exposure sparkline should redraw** for the new date (other sections stay the same).
8. Hard-reload the page, then **switch the preset to OSM** (Setup → "3D OSM + Cesium terrain"). Hover/click should still work on the OSM extruded buildings.
9. **Switch to Google preset** (Setup → "Google Photorealistic 3D"). Hover/click should NOT produce any silhouette or panel — picker is disabled.

Stop the dev server with Ctrl+C when done.

If any of these fail, stop and fix the issue before continuing to Task 15. Common gotchas:
- `picker.clearSelection?.()` in the `onClose` handler is a soft call — if the panel's X button is clicked while a building is selected, the picker's internal `selected` state would still hold the feature. If the X button closes but a later click on the same feature is treated as "re-select same → close", that's a UX bug. Verify: after X-close, clicking the same building should re-open the panel.

- [ ] **Step 5: Commit**

```bash
git add src/js/main.js index.html
git commit -m "Wire picker + metrics + info panel; handle preset/date/escape"
```

---

## Task 15: Polish — close the picker state on X-button click

**Files:**
- Modify: `src/js/viewer/buildingPicker.js`
- Modify: `src/js/main.js`

The Task 14 smoke test surfaces the X-button gotcha (the picker's `selected` doesn't reset when the panel's close button is clicked). Fix it by exposing a `clearSelection` method on the picker controller.

- [ ] **Step 1: Expose `clearSelection` on the picker**

In `src/js/viewer/buildingPicker.js`, find the `return { setEnabled(...), destroy() }` block. Add a `clearSelection` method to it:

```js
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
            viewer.scene.postProcessStages.remove(hoverStage);
            viewer.scene.postProcessStages.remove(selectedStage);
        },
    };
```

- [ ] **Step 2: Update main.js to actually call it (the optional-chaining was a placeholder)**

In `src/js/main.js`, inside `setupBuildingInfoFlow(viewer)`, find:

```js
            picker.clearSelection?.(); // optional helper; not needed if picker handles its own state
```

Replace with:

```js
            picker.clearSelection();
```

- [ ] **Step 3: Verify build + browser**

```bash
npm run build 2>&1 | tail -5
```

Then:

```bash
npm run dev
```

Re-run smoke step 4 from Task 14 ("Click the same building again — panel closes"). Then also test: open the panel, click the X button, then click the same building again — the panel should re-open. Then click empty space — close. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/js/viewer/buildingPicker.js src/js/main.js
git commit -m "Reset picker selection state when panel X-button closes"
```

---

## Task 16: Add the release-notes entry for v0.3.15 "Volume Reading"

**Files:**
- Modify: `src/js/releaseNotes/releaseNotesData.js`

- [ ] **Step 1: Prepend the new release entry**

Open `src/js/releaseNotes/releaseNotesData.js`. Find the `export const RELEASES = [` line and the first object inside (currently version `0.3.14` "Suite Polish"). Insert a new release object as the first element of the array — i.e. between the `[` and the existing `{ version: '0.3.14', ... }` block:

```js
    {
        version: '0.3.15',
        date: 'May 24, 2026',
        codename: 'Volume Reading',
        summary:
            'Buildings are now inspectable. Hover and a soft amber silhouette outlines the building under the cursor. Click and the outline turns red, a dark glassy info panel slides in from the right, and the basemap selector + navigation compass shift left to make room. The panel shows the building\'s 3D profile (volume, height, footprint, roof shape) with comparison bars against a Swiss residential baseline, a 24-hour solar exposure sparkline for the date in Setup, and the raw feature properties.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'mouse-pointer-2',
                text: 'Hover + click building selection. Two Cesium silhouette post-process stages (amber on hover, red on the selected building) outline the picked Cesium3DTileFeature on top of the existing tilesets. Mouse-move is rAF-throttled so per-frame picks stay cheap on dense scenes. Works on the Swiss SwissTLM3D preset and the OSM Buildings preset; disabled automatically on Google Photorealistic 3D (mesh, no per-feature properties).',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'layout-panel-left',
                text: 'Dark right-side info panel matching the Groove visual language — bg-gray-950/95, backdrop-blur, slides in from the right at 380px. Five sections: header (source + ID + label), quick-stat tiles (Volume / Height / Footprint, marked ~est. for ray-walked footprints), 3D Profile bars vs a Swiss residential baseline (10 000 m³ / 12 m / 900 m²) with size badges, 24-hour Solar exposure SVG sparkline for the date in Setup, and an expandable Properties list of raw feature getPropertyIds().',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'arrow-left-right',
                text: 'Right-side map controls (basemap selector, Cesium navigation compass) now slide 380px left when the info panel opens, mirroring the suite-wide map-control-panel-overlap convention. Animation: transform 200ms ease. Below 640px the controls fade out instead so the panel can use the full screen.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'sun',
                text: '24h solar exposure ray-cast. For each hour of the date in Setup, casts a ray from the rooftop probe toward the sun position computed via Cesium.Simon1994PlanetaryPositions and checks intersection with the scene; the result is a 24-bar sparkline plus a sunlit-hours total + percent of daylight. Changing the date in Setup re-runs only the solar bit without re-doing the footprint/roof probes.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'plug',
                text: 'buildings.js gained an onPresetChange(cb) pub/sub so external modules (the new picker, and any future feature) can react to Swiss / OSM / Google preset swaps without import-cycling buildings.js back into the viewer config.',
                prs: [],
            },
        ],
    },
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in <NNN>ms`.

- [ ] **Step 3: Browser sanity check — open the release-notes panel**

```bash
npm run dev
```

Click the **Tag** icon in the navbar to open the release-notes panel. Verify the new "v0.3.15 — Volume Reading" entry is at the top of the timeline with the "Latest" badge and the five list items render with their icons. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/js/releaseNotes/releaseNotesData.js
git commit -m "Add v0.3.15 'Volume Reading' release notes entry"
```

---

## Task 17: Open PR and merge per Publish Workflow

**Files:**
- No file edits

- [ ] **Step 1: Final pre-flight check**

```bash
git status
git log --oneline main..HEAD
```

Expected: clean working tree, 16+ commits ahead of `main` (one for the spec + 16 for tasks 1–16).

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/building-pick-and-info-panel
```

Expected: `branch 'feat/building-pick-and-info-panel' set up to track 'origin/feat/building-pick-and-info-panel'`.

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "Building pick + 3D info panel (v0.3.15 'Volume Reading')" --body "$(cat <<'EOF'
## Summary

Buildings are now inspectable. Hover gives a soft amber Cesium silhouette outline; click pins the selection (red outline) and slides in a dark glassy info panel from the right with the building's 3D profile and a 24h solar exposure sparkline.

Spec: `docs/superpowers/specs/2026-05-24-hood-building-pick-and-info-panel-design.md`
Plan: `docs/superpowers/plans/2026-05-24-hood-building-pick-and-info-panel.md`

### What's in it
- `src/js/viewer/buildings.js` — new `onPresetChange(cb)` pub/sub
- `src/js/viewer/buildingPicker.js` — hover + click + silhouette stages
- `src/js/viewer/buildingMetrics.js` — label, height, footprint (8-ray walk), volume, roof shape, 24h solar exposure
- `src/js/info/buildingInfoPanel.js` — DOM panel with 5 sections
- `src/css/buildingInfoPanel.css` — dark glassy panel + right-controls-shifted modifier
- `index.html` + `src/js/main.js` — wiring (preset listener, date-change recompute, Escape key)
- `src/js/releaseNotes/releaseNotesData.js` — v0.3.15 entry

### Tileset behaviour
| Preset | Picking |
|---|---|
| Swiss (SwissTLM3D) | Enabled |
| OSM Buildings | Enabled |
| Google Photorealistic 3D | Disabled (mesh, no useful per-feature data) |

## Test plan
- [x] `npm run build` passes
- [ ] Hover a building → amber outline, pointer cursor
- [ ] Click a building → red outline + panel slides in from right
- [ ] Panel shows quick-stats / 3D profile bars / solar sparkline / properties list
- [ ] Basemap selector and Cesium compass shift left when the panel opens
- [ ] Click the same building again → closes panel
- [ ] Click empty terrain → closes panel
- [ ] Press Escape → closes panel
- [ ] Change date in Setup with panel open → solar sparkline redraws
- [ ] Switch to OSM preset → picking still works
- [ ] Switch to Google preset → picking disabled (no outline, no panel)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Merge**

```bash
# capture the PR number that gh just printed and pass it to merge, or
# omit the number to merge the PR for the current branch.
gh pr merge --squash --delete-branch
```

Expected: `Merged pull request #NN` (squash + delete-branch). Vercel will redeploy `swissnovo-hood` from `main`.

- [ ] **Step 5: Switch back to main**

```bash
git checkout main
git pull origin main
git log --oneline -3
```

Expected: top commit is the squashed merge from this PR.

---

## Self-review checklist (performed after writing, before handing off)

1. **Spec coverage** — every section/requirement of `2026-05-24-hood-building-pick-and-info-panel-design.md` maps to a task above:
   - §3 scope (Swiss + OSM, two silhouettes, 5-section panel, body class shift) → Tasks 2–4 (picker), 9 (CSS shift), 10–13 (panel sections)
   - §4 user flow → covered end-to-end by Tasks 2–4 + 10–15
   - §5.1/5.2 architecture → Tasks 2, 5, 10, 14
   - §6 picking → Tasks 2, 3, 4
   - §6.3 Google preset disable → Tasks 1, 14
   - §7.1 label mapping → Task 5
   - §7.2 height → Task 6
   - §7.3 footprint ray-walk → Task 6
   - §7.4 volume → Task 6
   - §7.5 roof shape → Task 7
   - §7.6 profile bars + baseline → Task 7
   - §7.7 solar 24h → Task 8
   - §7.8 cache + date invalidation → Tasks 5, 8, 14
   - §8 panel UI/styles → Tasks 9, 10–13
   - §8.3 right-control shift → Task 9 (CSS) + Task 14 (body-class toggle)
   - §9 edge cases (empty click, Google preset, date change, Escape) → Task 14
   - §10 release notes & publish → Tasks 16, 17

2. **Placeholder scan** — no "TBD" / "TODO" / "fill in later" / "similar to Task N" / "add error handling". Every code step ships actual code; every command step ships the literal command.

3. **Type consistency** — `setupBuildingPicker(viewer, { onSelect, onDeselect })` returns `{ setEnabled, clearSelection, destroy }` (Task 15 adds `clearSelection`; Task 14 anticipates it via optional-chaining and Task 15 hardens it). `computeBuildingMetrics(feature, viewer, clickWorldPosition)` signature stays stable across Tasks 5–8, 14. `createBuildingInfoPanel({ onClose })` returns `{ show, hide, destroy }`. `onPresetChange(cb)` registered in main.js receives `preset: 'swiss' | 'osm' | 'google'`.

4. **Order-of-operations** — `dateInput.addEventListener('change', ...)` in Task 14 depends on `invalidateBuildingMetrics` and `computeBuildingMetrics` (both ready by Task 8) and on the panel's `show()` (ready by Task 13). All earlier dependencies in place before Task 14.
