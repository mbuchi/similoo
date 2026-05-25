# Hood — Building pick, highlight, and 3D info panel

**Date:** 2026-05-24
**Author:** Joe (swissnovo@zeroo.ch) + Claude
**Repo:** `mbuchi/hood`
**Target version:** 0.3.15 "Volume Reading"

## 1. Goal

Make individual buildings in hood's 3D viewer feel **inspectable**. Today the
viewer renders the whole SwissTLM3D / OSM Buildings tilesets as a single mass —
you can fly around them and watch the sun move, but you can't single one out.

After this work:

- **Hover** a building → soft amber silhouette outline appears under the cursor.
- **Click** a building → red silhouette + a dark, glassy right-side info panel
  slides in showing the building's 3D profile (volume, height, footprint, roof
  shape) and a 24-hour solar exposure infographic for the currently-selected
  date.
- The panel and highlight match the look of the rest of the SwissNovo suite
  (Groove-style dark glass overlay, hood red accents).

This deepens hood's "3D Neighborhood Check" identity — the app stops being a
read-only diorama and starts being a tool you query.

## 2. Non-goals

- **Not** a real cadastral / valuation lookup. We don't query the swisstopo
  identify API for EGID, parcel number, owner, etc. Other suite apps (valoo,
  groove) do that; hood stays focused on the 3D experience.
- **Not** persistent. There is no "save building" or PRM integration; closing
  the panel forgets the selection.
- **Not** multi-select. One building selected at a time.
- **Not** edits or annotations on the building. Read-only inspection only.
- **Not** integration with Google Photorealistic 3D Tiles. That tileset is a
  mesh with no per-feature properties, so picking gets `Cesium3DTileFeature`
  with nothing useful on it. Picking is disabled while the Google preset is
  active.

## 3. Scope

In scope (this spec):

- Hover + click picking on `Cesium3DTileFeature` objects from the Swiss
  SwissTLM3D and OSM Buildings tilesets.
- Two silhouette post-process stages (hover = amber, selected = red).
- A right-side, full-height, dark slide-in info panel matching Groove's
  visual language but built in vanilla JS (hood is a Vite + plain-JS app).
- A 5-section panel content: Header → Quick Stats → 3D Profile bars →
  Solar Exposure sparkline → Raw Properties (collapsed by default).
- A `body.right-controls-shifted` class that animates the basemap selector
  and Cesium compass/zoom widget left when the panel is open.

Out of scope (future work):

- Google preset picking.
- "Walk inside" / interior view.
- Comparing two buildings side-by-side.
- Exporting the building stats.

## 4. User flow

```
[user flying through neighborhood]
        │
        ▼
[cursor enters a building]
        │
        ▼
        building gets amber silhouette outline
        cursor becomes a pointer
        │
        ▼
[user clicks]
        │
        ▼
        amber outline turns red
        right-side panel slides in (200ms)
        basemap selector + compass shift left
        panel renders:
          - header (name, source)
          - quick-stat tiles (volume / height / footprint)
          - 3D profile bars (vs Swiss residential baseline)
          - 24h solar exposure sparkline (current date in Setup)
          - properties list (collapsed)
        │
        ▼
[user clicks same building]    [user clicks empty space]    [user clicks ✕]
        │                              │                          │
        └──────────────────────────────┴──────────────────────────┘
                                  │
                                  ▼
                          panel slides out
                          silhouettes clear
                          right-side controls slide back
```

## 5. Architecture

### 5.1 Module layout

Four new vanilla-JS modules + one CSS file. No React, no shared package
changes.

```
src/js/viewer/
  buildingPicker.js     # owns: ScreenSpaceEventHandler, both silhouette stages,
                        # selection state, cursor management. Exposes
                        # setupBuildingPicker(viewer, { onSelect, onDeselect }).
  buildingMetrics.js    # pure (mostly) functions. Given a Cesium3DTileFeature
                        # and the viewer, returns { label, source, height,
                        # footprintArea, volume, roofShape, solar24h, props }.
                        # Caches results on a WeakMap keyed by feature.

src/js/info/
  buildingInfoPanel.js  # renders + manages the DOM panel. Exposes
                        # createBuildingInfoPanel() -> { show(metrics),
                        # hide(), destroy() }. Knows nothing about Cesium.

src/css/
  buildingInfoPanel.css # scoped to .bip-* classes.
```

### 5.2 Wiring

In `src/js/main.js`, after `initializeViewer()` completes:

```js
import { setupBuildingPicker } from './viewer/buildingPicker.js';
import { computeBuildingMetrics } from './viewer/buildingMetrics.js';
import { createBuildingInfoPanel } from './info/buildingInfoPanel.js';

const panel = createBuildingInfoPanel();
const picker = setupBuildingPicker(viewer, {
    // The picker captures the click's world position via
    // viewer.scene.pickPosition(click.position) and threads it through to
    // onSelect, so the metrics module never has to pick again.
    onSelect: (feature, clickWorldPosition) => {
        const metrics = computeBuildingMetrics(feature, viewer, clickWorldPosition);
        panel.show(metrics);
        document.body.classList.add('right-controls-shifted');
    },
    onDeselect: () => {
        panel.hide();
        document.body.classList.remove('right-controls-shifted');
    },
});

// Disable picking while Google Photorealistic preset is active (mesh, no
// useful per-feature properties). buildings.js exposes onPresetChange()
// as part of this work.
onPresetChange((preset) => picker.setEnabled(preset !== 'google'));
```

`index.html` adds one line to load the CSS:
```html
<link rel="stylesheet" href="/src/css/buildingInfoPanel.css">
```

## 6. Picking & highlight

### 6.1 Silhouette stages

We create two independent silhouette stages and add each to
`viewer.scene.postProcessStages` (each is its own PostProcessStage; the
scene paints them in insertion order). The hover stage's `selected` array
is cleared whenever the hovered feature is the same as the selected one,
so the red outline of the selected feature is never overdrawn by amber.

```js
const hoverStage = Cesium.PostProcessStageLibrary.createSilhouetteStage();
hoverStage.uniforms.color = Cesium.Color.fromCssColorString('#F59E0B'); // amber
hoverStage.uniforms.length = 1.0;
hoverStage.uniforms.color.alpha = 0.55;
hoverStage.selected = [];

const selectedStage = Cesium.PostProcessStageLibrary.createSilhouetteStage();
selectedStage.uniforms.color = Cesium.Color.fromCssColorString('#DC2626'); // hood red
selectedStage.uniforms.length = 1.5;
selectedStage.uniforms.color.alpha = 0.9;
selectedStage.selected = [];

viewer.scene.postProcessStages.add(hoverStage);    // painted first (under)
viewer.scene.postProcessStages.add(selectedStage); // painted second (on top)
```

### 6.2 ScreenSpaceEventHandler

```js
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

let hovered = null;
let selected = null;
let rafPending = false;

handler.setInputAction((movement) => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
        rafPending = false;
        const picked = viewer.scene.pick(movement.endPosition);
        const feature = picked instanceof Cesium.Cesium3DTileFeature ? picked : null;

        if (feature !== hovered) {
            hovered = feature;
            // never highlight the currently-selected feature in amber
            hoverStage.selected = feature && feature !== selected ? [feature] : [];
            viewer.scene.canvas.style.cursor = feature ? 'pointer' : '';
        }
    });
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    const feature = picked instanceof Cesium.Cesium3DTileFeature ? picked : null;

    if (!feature) {
        clearSelection();
        return;
    }

    if (feature === selected) {
        // clicking the selected building again toggles closed
        clearSelection();
        return;
    }

    selected = feature;
    selectedStage.selected = [feature];
    hoverStage.selected = []; // selected outline supersedes
    onSelect(feature);
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

function clearSelection() {
    selected = null;
    selectedStage.selected = [];
    onDeselect();
}
```

### 6.3 Disabling on Google preset

The Google Photorealistic tileset is a single mesh — picking it returns a
`Cesium3DTileFeature` with no useful properties. `setupBuildingPicker` returns
a controller `{ setEnabled(bool), destroy() }`. `main.js` stores the
controller and registers a callback with `buildings.js`'s preset-switch
event so it can call `picker.setEnabled(preset !== 'google')`. When disabled,
the `ScreenSpaceEventHandler` actions are detached, both silhouette stages'
`selected` arrays are cleared, and the panel hidden.

If `buildings.js` does not currently expose a preset-change hook, we add one
as part of this work: a tiny `onPresetChange(cb)` registration that fires
from the existing `setSwissLayers / setOsmLayers / setGoogleLayers` paths.

## 7. Metrics computation

`computeBuildingMetrics(feature, viewer)` returns one object:

```js
{
    // Identity
    label: 'Wohngebäude',        // human-readable, EN/DE-mapped from OBJEKTART
    source: 'SwissTLM3D',        // 'SwissTLM3D' | 'OSM Buildings'
    id: 'a3c4b27d',              // first 8 chars of feature batch id

    // Numeric stats (all may be null if the dataset doesn't expose them)
    height: 14.2,                // metres
    footprintArea: 874,          // m²
    volume: 12400,               // m³ (= footprint × height)
    roofShape: 'pitched',        // 'flat' | 'pitched' | 'unknown'

    // Profile bars (each 0..1, normalised against the baseline below)
    profile: {
        volume:    { value: 12400, ratio: 1.24, bucket: 'large' },
        height:    { value: 14.2,  ratio: 1.18, bucket: 'mid-rise' },
        footprint: { value: 874,   ratio: 0.97, bucket: 'medium' },
    },

    // 24-hour solar exposure for the date in Setup → dateInput
    solar24h: {
        date: '2024-05-15',
        hourly: [0,0,0.1,0.6,0.9,1,1,1,1,0.9,0.8,...],  // 24 entries, 0..1
        sunlitHours: 9.2,
        sunlitPercent: 0.68,
    },

    // Raw property list, sorted, for the expandable "Properties" section
    props: [
        { key: 'OBJEKTART', value: 'Wohngebäude' },
        { key: 'DATUM_ERSTELLUNG', value: '2018-09-13' },
        ...
    ],
}
```

### 7.1 Label & category mapping

Switzerland's SwissTLM3D categorises buildings with the German-language
`OBJEKTART` property. We translate to readable EN labels:

| OBJEKTART (raw) | label (EN) | category |
|---|---|---|
| `Wohngebaeude` | Residential | residential |
| `Wohn- und Geschaeftsgebaeude` | Mixed-use | mixed |
| `Industriegebaeude` | Industrial | commercial |
| `Bueroge­baeude` | Office | commercial |
| `Oeffentliches Gebaeude` | Public | civic |
| `Sakralbau` | Religious | civic |
| (anything else) | Building | other |

For OSM Buildings: `feature.getProperty('building')` carries the OSM tag;
similar mapping (`residential`, `commercial`, `industrial`, …). If neither
dataset gives a category, fall back to label `"Building"`.

### 7.2 Height

```js
function getHeight(feature) {
    // OSM Buildings exposes this directly.
    const osmHeight = feature.getProperty('cesium#estimatedHeight');
    if (Number.isFinite(osmHeight) && osmHeight > 1) return osmHeight;

    // SwissTLM3D: derive from boundingSphere radius. The bounding sphere
    // contains the whole batch (multiple buildings), so this is a per-tile
    // approximation, not per-building. We accept it as a rough order-of-
    // magnitude and clamp.
    const bs = feature.content?.tile?.boundingSphere;
    if (bs) {
        // Empirical constant from calibration against 10 Swiss buildings
        // (see notes in buildingMetrics.js). Tweak after first deploy.
        return Math.max(3, Math.min(80, bs.radius * 0.4));
    }
    return null;
}
```

### 7.3 Footprint area (ray-walk)

The caller (`buildingPicker.js`) computes the click's world position via
`viewer.scene.pickPosition(click.position)` at the moment of `LEFT_CLICK`
and passes it into `computeBuildingMetrics(feature, viewer,
clickWorldPosition)` alongside the feature. The metrics module never picks
again — it only walks rays.

```js
function getFootprintArea(feature, viewer, clickWorldPosition) {
    if (!clickWorldPosition) return null;

    // Project the click down to terrain to get a ground-level seed point.
    // Cast 8 horizontal rays outward (every 45°) from that seed. For each
    // ray, step in 0.5m increments until pickFromRay returns a different
    // feature (or undefined), or 50m cap is reached. Each exit point is
    // a polygon vertex; the 8 vertices form the estimated footprint.

    const groundPoint = projectToGround(viewer, clickWorldPosition);
    const directions = directionsAtGround(groundPoint, 8); // 8 cardinal+ord rays
    const vertices = directions.map((dir) =>
        walkUntilExit(viewer, feature, groundPoint, dir, 0.5, 50),
    );

    return polygonArea(vertices);
}
```

We accept that concave shapes (L-shapes, courtyards) get over-counted — the
infographic is "feel of the scale", not a survey measurement. The panel
shows a small `~est.` chip next to the value to make this honest.

If the picker fails to get a world position (rare — happens at extreme
oblique angles when the pick ray exits the globe), set `footprintArea =
null` and the panel hides the footprint card.

### 7.4 Volume

`volume = footprintArea × height`. If either factor is null, volume is null
and the tile is hidden.

### 7.5 Roof shape

```js
function getRoofShape(feature, viewer, clickWorldPosition, height) {
    // OSM Buildings are extruded → always flat top.
    if (feature.tileset === osmBuildingsTileset) return 'flat';

    // Swiss SB3D: sample 4 rays from rooftop centroid at small downward
    // angles (5°, 15°). If the variance of hit Z-coordinates is < 0.5m,
    // it's flat; otherwise pitched.
    const top = clickWorldPosition + Cesium.Cartesian3.UNIT_Z * (height + 1);
    const samples = sampleRoofZ(viewer, feature, top, 4);
    const variance = zVariance(samples);
    return variance < 0.5 ? 'flat' : 'pitched';
}
```

If the sampling fails to hit the feature 4 times → `'unknown'`, and the
panel shows just the icon without the label.

### 7.6 Profile bars

The bars compare this building against a Swiss residential **baseline**:

```js
const BASELINE = {
    volume:    10000,  // m³ — typical 4-storey apartment block
    height:    12,     // m
    footprint: 900,    // m²
};

function bucketize(ratio) {
    if (ratio < 0.5) return 'small';
    if (ratio < 1.5) return 'medium';
    if (ratio < 3)   return 'large';
    return 'xlarge';
}
```

The bar fill is `min(ratio, 2)` mapped to 0–100% (so a 2× baseline building
fills the bar, a 4× building also fills it but gets the "xlarge" badge).
This keeps the bars readable; the raw number above the bar tells the truth.

The baseline values are constants in `buildingMetrics.js`. We may revise
them after a few weeks of looking at the panel in real neighborhoods.

### 7.7 Solar exposure (24h)

Pseudo-code (real implementation must use `Cesium.Cartesian3.add` /
`Cesium.Cartesian3.multiplyByScalar` — Cartesians don't support `+` / `*`):

```js
function getSolar24h(viewer, clickWorldPosition, height) {
    const dateInput = document.getElementById('dateInput'); // existing Setup field
    const date = new Date(dateInput.value);

    // Rooftop probe point: 1m above the picked surface in the local UP
    // direction (NOT world Z — at Swiss latitudes the difference is small
    // but principled). Use Cesium.Transforms.eastNorthUpToFixedFrame to
    // get the local UP, then offset by (height + 1).
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(clickWorldPosition);
    const up = Cesium.Matrix4.getColumn(enu, 2, new Cesium.Cartesian3());
    const offset = Cesium.Cartesian3.multiplyByScalar(up, height + 1, new Cesium.Cartesian3());
    const probe = Cesium.Cartesian3.add(clickWorldPosition, offset, new Cesium.Cartesian3());

    const hourly = new Array(24);
    let sunlit = 0;
    let daylight = 0;

    for (let h = 0; h < 24; h++) {
        const t = new Date(date);
        t.setHours(h, 0, 0, 0);

        // Sun direction in scene coordinates. Use Cesium's planetary
        // positions helper (already used by hood's day-tour shadow path).
        const sunPos = Cesium.Simon1994PlanetaryPositions
            .computeSunPositionInEarthInertialFrame(Cesium.JulianDate.fromDate(t));
        const sunDir = Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.subtract(sunPos, probe, new Cesium.Cartesian3()),
            new Cesium.Cartesian3(),
        );

        // Sun above local horizon iff dot(sunDir, up) > 0.
        const above = Cesium.Cartesian3.dot(sunDir, up) > 0;
        if (!above) { hourly[h] = 0; continue; }

        daylight++;
        const ray = new Cesium.Ray(probe, sunDir);
        // pickFromRay takes an `objectsToExclude` list. We pass the picked
        // feature itself so the building doesn't shadow its own rooftop.
        const hit = viewer.scene.pickFromRay(ray, [feature]);
        const occluded = hit !== undefined && hit.object !== undefined;
        hourly[h] = occluded ? 0 : 1;
        if (!occluded) sunlit++;
    }

    return {
        date: date.toISOString().slice(0, 10),
        hourly,
        sunlitHours: sunlit,
        sunlitPercent: daylight === 0 ? 0 : sunlit / daylight,
    };
}
```

24 ray casts × ~3 ms each = ~70 ms total — runs once on click, result is
cached. Hourly resolution; we considered 30-minute but the visual difference
in the sparkline is negligible at 380px wide.

### 7.8 Caching

```js
const cache = new WeakMap();

export function computeBuildingMetrics(feature, viewer) {
    if (cache.has(feature)) return cache.get(feature);
    const metrics = doCompute(feature, viewer);
    cache.set(feature, metrics);
    return metrics;
}
```

WeakMap so we don't leak when Cesium evicts the tile.

**Solar exposure exception:** the cached value invalidates if the user changes
the date in Setup. We hook `dateInput`'s `change` event and clear the cache,
then re-call `computeBuildingMetrics` if a panel is currently open.

## 8. Panel UI

### 8.1 DOM structure

Built in plain JS via `document.createElement`, appended to `<body>` once at
boot, kept hidden until `show(metrics)` is called.

```html
<aside class="bip" data-state="hidden" aria-hidden="true">
    <header class="bip-header">
        <div class="bip-eyebrow">
            <span class="bip-source">SwissTLM3D</span>
            <span class="bip-divider">·</span>
            <span class="bip-id">a3c4b27d</span>
        </div>
        <h2 class="bip-title">Residential</h2>
        <button class="bip-close" aria-label="Close"><i data-lucide="x"></i></button>
    </header>

    <section class="bip-section bip-quickstats">
        <div class="bip-tile">
            <div class="bip-tile-value">12 400<span class="bip-tile-unit">m³</span></div>
            <div class="bip-tile-label">Volume</div>
        </div>
        <div class="bip-tile">…Height…</div>
        <div class="bip-tile">…Footprint…</div>
    </section>

    <section class="bip-section bip-profile">
        <h3 class="bip-section-title">3D Profile</h3>
        <div class="bip-bar-row">
            <span class="bip-bar-label">Volume</span>
            <div class="bip-bar"><div class="bip-bar-fill" style="width:62%"></div></div>
            <span class="bip-bar-badge">Large</span>
        </div>
        … height, footprint, roof-shape (roof shape is icon + text, no bar)
    </section>

    <section class="bip-section bip-solar">
        <h3 class="bip-section-title">Solar exposure <span class="bip-section-meta">May 24</span></h3>
        <svg class="bip-solar-sparkline" viewBox="0 0 240 60">…24 bars…</svg>
        <div class="bip-solar-axis"><span>06:00</span><span>12:00</span><span>18:00</span></div>
        <div class="bip-solar-summary">
            <i data-lucide="sun"></i> 9.2 h sunlit · 68% of daylight
        </div>
    </section>

    <section class="bip-section bip-props">
        <button class="bip-props-toggle">
            <i data-lucide="chevron-right"></i> Properties (12)
        </button>
        <dl class="bip-props-list" hidden>
            <dt>OBJEKTART</dt><dd>Wohngebäude</dd>
            …
        </dl>
    </section>
</aside>
```

### 8.2 Styles (key values)

```css
.bip {
    position: fixed;
    top: 60px;            /* below the navbar */
    right: 0;
    bottom: 0;
    width: 380px;
    z-index: 50;          /* under modals (3000+), above map (5) */
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
}
.bip[data-state="visible"] {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
}

.bip-title {
    color: #FFFFFF;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
}
.bip-bar-fill {
    background: linear-gradient(90deg, #DC2626, #F59E0B);
    height: 6px;
    border-radius: 3px;
}
.bip-solar-sparkline rect {
    fill: #F59E0B;
    opacity: 0.85;
}
.bip-solar-sparkline rect.is-night {
    fill: rgba(255, 255, 255, 0.08);
}

@media (max-width: 640px) {
    .bip { width: 100%; }
}
```

### 8.3 Right-side control shift

```css
body.right-controls-shifted .basemap-selector,
body.right-controls-shifted .cesium-viewer-cesiumNavigationContainer {
    transform: translateX(-380px);
}
.basemap-selector,
.cesium-viewer-cesiumNavigationContainer {
    transition: transform 200ms ease;
}
```

On mobile (<640px), the panel covers the whole screen and the right-side
controls are hidden under it; no shift needed. We `display: none` the
basemap selector on mobile too while the panel is open.

## 9. Edge cases & failure modes

| Case | Behaviour |
|---|---|
| User clicks empty sky | `viewer.scene.pick` returns `undefined` → `clearSelection()`. |
| User clicks terrain (not building) | `picked` is not a `Cesium3DTileFeature` → `clearSelection()`. |
| User clicks Google Photorealistic mesh | Picker is disabled while Google preset active → no-op. |
| Feature has no readable properties | Label falls back to `"Building"`; props list shows empty state. |
| Solar ray cast hangs (very rare) | Each ray is synchronous and bounded; wrap the loop in a `try/catch` and degrade gracefully to "Solar data unavailable". |
| User changes date in Setup with a panel open | Recompute `solar24h` for the new date and re-render only the solar section. |
| User changes building preset (Swiss → OSM → Google) | Clear selection + hide panel. Stale `WeakMap` entries are GC'd with the unloaded tiles. |
| Window resize | Panel is fixed; CSS handles mobile breakpoint. No JS recalc needed. |
| Two clicks land on the same building | Treated as toggle: second click closes panel. |
| Keyboard: Escape | Closes panel (already a global listener; extend it). |

## 10. Release notes & publish

Per the suite Publish Workflow:

1. **Edit** — files above.
2. **Verify** — `npm run build` passes.
3. **Release notes** — prepend a `0.3.15 "Volume Reading"` entry to
   `src/js/releaseNotes/releaseNotesData.js`.
4. **Sync toolbox** — none of the surfaced fields change (purpose, tagline,
   ?lat/?lng support, map-first flag, AI-chat, signal flags, `<title>`).
   Skip toolbox sync.
5. **Commit** to a feature branch like `feat/building-pick-and-info-panel`.
6. **Open PR** + auto-merge per workflow.

No changes to `@swissnovo/shared` (panel is hood-local). No toolbox change.

## 11. Open questions / future work

- The Swiss height heuristic (`bs.radius * 0.4`) is a rough constant. After
  shipping, calibrate against a sample of known buildings (Zürich
  Prime Tower 126m, a 4-storey block ~12m, a single-family house ~7m) and
  switch to a piecewise function if the constant doesn't generalize.
- The 3D Profile bars currently compare against a hard-coded Swiss residential
  baseline. A future improvement: compute a per-canton or per-municipality
  baseline from the RES API (would require [[swissnovo-res-api]] integration —
  not in scope here).
- "Surrounding free space" — ruled out for this spec (computationally heavy
  and visually noisy at the panel size we have). Could revisit with a small
  4-directional radar chart in a v2.
- Multi-building compare (pin two, see them side-by-side) is a natural
  follow-on but doubles the panel design surface area.
