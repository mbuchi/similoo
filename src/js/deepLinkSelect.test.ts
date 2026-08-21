/** @vitest-environment jsdom */

import { afterEach, expect, it, vi } from 'vitest';

// "Open with the parcel already selected" — the suite select standard
// (aireon-shared/docs/URL_PARAMS_STANDARD.md, "Open with the parcel selected").
//
// similoo always opened its comparison on a `?lat/?lng` link, so the half most
// apps were missing was already here. What it did not have was the GATE: it
// read the coordinates straight off the URL, which answers "is there a place in
// this link?" when the question is "does this page load owe the visitor a
// SELECTION?". Three URLs got the wrong answer:
//
//   • `?select=off` — the documented opt-out for a clean screenshot or an embed
//     was ignored outright.
//   • a reload of a bare self-written coordinate — the panel had been dismissed
//     (releasePick() cleared the identity from the URL), and reloading conjured
//     the comparison back on whatever the camera happened to be over.
//   • a reload of a self-written URL still naming a parcel — right answer, but
//     by luck: the coordinates carried it, not the identity.
//
// These drive the REAL shared gate (`getParcelAutoSelect`) and the REAL shared
// chooser (`pickDeepLinkFeature`) against real URLs; only the map, the sidebar
// and the address resolver are stubs.

const engine = vi.hoisted(() => ({
  initializeViewer: vi.fn(),
  applyZoneHighlight: vi.fn(),
  updateMapUrl: vi.fn(),
  sidebar: {
    hide: vi.fn(),
    show: vi.fn(),
    setAddress: vi.fn(),
  },
}));

vi.mock('maplibre-gl', () => ({
  Marker: class FakeMarker {},
}));

vi.mock('./viewer/viewerConfig.js', () => ({
  initializeViewer: engine.initializeViewer,
  BUILDING_SOURCE: 'buildings',
  BUILDING_SOURCE_LAYER: 'building-source-layer',
  BUILDING_LAYER: 'building-layer',
  PARCEL_FILL_LAYER: 'parcel-fill-layer',
  CMP_HOVER_SOURCE: 'comparable-hover',
  CMP_HOVER_FILL_LAYER: 'comparable-hover-fill',
  CMP_HOVER_GLOW_LAYER: 'comparable-hover-glow',
  CMP_HOVER_LINE_LAYER: 'comparable-hover-line',
  applyZoneHighlight: engine.applyZoneHighlight,
}));

vi.mock('./viewer/overlayOpacity.js', () => ({
  initOverlayOpacity: vi.fn(),
  registerOverlayLayers: vi.fn(),
}));

vi.mock('./i18n.js', () => ({
  applyTranslations: vi.fn(),
  t: (key: string) => key,
}));

vi.mock('./comparison/sidebar.js', () => ({
  createComparisonSidebar: () => engine.sidebar,
}));

vi.mock('./comparison/parcelLookup.js', () => ({
  resolveEgridFromLngLat: vi.fn(async () => null),
  // The real one uppercases, trims and demands the CH+12 EGRID shape; identity
  // is enough here and keeps the fixtures readable.
  normaliseEgrid: (value: unknown) => value ?? null,
}));

vi.mock('./detail/buildingDetailModal.js', () => ({
  createBuildingDetailModal: vi.fn(),
}));

vi.mock('./viewer/mapLegend.js', () => ({
  createMapLegend: vi.fn(),
}));

vi.mock('./help/methodologyPanel.js', () => ({
  initMethodologyHelp: vi.fn(),
}));

// The address heal is a network leg with its own spec (deepLinkAddress.test.ts).
vi.mock('./deepLinkAddress.js', () => ({
  readDeepLinkAddress: () => ({ hint: null, authoritative: false }),
  resolveDeepLinkLabel: vi.fn(async () => null),
  deepLinkLabelExtra: (label: string | null) => ({ q: label, label: null }),
}));

const TARGET = { lat: 46.946774, lng: 7.444192 };
const TILE_EGRID = 'CH294676423526';

// The camera a deep link produces: the point, street level, similoo's own 3D
// framing. `?select=off` must produce exactly this one, just with no panel.
const DEEP_LINK_CAMERA = {
  center: [TARGET.lng, TARGET.lat],
  zoom: 17,
  pitch: 50,
  bearing: -25,
};

function createLoadedMap(parcelId = TILE_EGRID) {
  const parcel = {
    id: parcelId,
    properties: { parcel_id: parcelId, cz_local: 'Wohnzone, Bauklasse 4' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[7.43, 46.94], [7.46, 46.94], [7.46, 46.96], [7.43, 46.96], [7.43, 46.94]]],
    },
  };
  const building = {
    id: 'building-1',
    geometry: {
      type: 'Polygon',
      coordinates: [[[7.44, 46.945], [7.45, 46.945], [7.45, 46.95], [7.44, 46.95], [7.44, 46.945]]],
    },
  };

  return {
    jumpTo: vi.fn(),
    on: vi.fn(),
    getLayer: vi.fn(() => true),
    getZoom: vi.fn(() => 17),
    getCenter: vi.fn(() => ({ lat: TARGET.lat, lng: TARGET.lng })),
    getContainer: vi.fn(() => document.getElementById('mapContainer')),
    project: vi.fn(([lng, lat]: [number, number]) => ({ x: lng * 100, y: lat * 100 })),
    queryRenderedFeatures: vi.fn((first: { layers?: string[] }, second?: { layers?: string[] }) => {
      const layer = (second?.layers ?? first?.layers)?.[0];
      if (layer === 'parcel-fill-layer') return [parcel];
      if (layer === 'building-layer') return [building];
      return [];
    }),
    setFeatureState: vi.fn(),
  };
}

/**
 * Boot the engine against a URL.
 *
 * `selfWritten` stamps the same `history.state` marker the shared writer does,
 * which is how the gate tells a reload of the app's own URL from a link that
 * arrived from outside.
 */
async function bootAt(url: string, { selfWritten = false } = {}) {
  document.body.innerHTML = `
    <section id="landingView"></section>
    <section id="comparisonView" hidden>
      <div id="mapContainer"></div>
    </section>
  `;
  window.history.replaceState(selfWritten ? { aireonSelfWritten: true } : null, '', url);
  // The shared parser caches `location.search` and lives in an externalised
  // dependency `vi.resetModules()` does not reach, so its own hook is what
  // re-reads the URL. Same dance as deepLinkAddress.test.ts.
  const { __resetUrlStateForTests } = await import('@aireon/shared/url-params');
  __resetUrlStateForTests();
  vi.resetModules();
  const { boot } = await import('./main.js');
  boot();
}

afterEach(() => {
  vi.useRealTimers();
  engine.initializeViewer.mockReset();
  engine.applyZoneHighlight.mockReset();
  engine.sidebar.show.mockReset();
});

it('opens the comparison on the linked parcel for an external deep link', async () => {
  engine.initializeViewer.mockResolvedValue(createLoadedMap());

  await bootAt(`/?lat=${TARGET.lat}&lng=${TARGET.lng}&zoom=17&egrid=${TILE_EGRID}`);

  await vi.waitFor(() => {
    expect(engine.initializeViewer).toHaveBeenCalledWith('mapContainer', DEEP_LINK_CAMERA);
    // The panel — not just the camera — is the half a recipient notices.
    expect(engine.sidebar.show).toHaveBeenCalledWith(
      TILE_EGRID,
      null,
      expect.objectContaining({ type: 'Polygon' }),
      [TARGET.lng, TARGET.lat],
      expect.objectContaining({ cz_local: 'Wohnzone, Bauklasse 4' }),
    );
  });
  expect(document.getElementById('comparisonView')?.hidden).toBe(false);
});

it('honours ?select=off: same view, nothing selected, no panel', async () => {
  engine.initializeViewer.mockResolvedValue(createLoadedMap());
  // Fake timers, then drain: "no panel" is only worth asserting once the whole
  // selection chain (two ~3 s hit-test retry budgets) has had its chance to run.
  // Asserting right after boot would pass against the very code this replaces,
  // which opens the panel several awaits later.
  vi.useFakeTimers();

  await bootAt(`/?lat=${TARGET.lat}&lng=${TARGET.lng}&zoom=17&egrid=${TILE_EGRID}&select=off`);
  await vi.advanceTimersByTimeAsync(20000);

  // The map is revealed at the linked camera…
  expect(engine.initializeViewer).toHaveBeenCalledWith('mapContainer', DEEP_LINK_CAMERA);
  expect(document.getElementById('comparisonView')?.hidden).toBe(false);
  // …and that is all: no comparison, no selection highlight.
  expect(engine.sidebar.show).not.toHaveBeenCalled();
  expect(engine.applyZoneHighlight).not.toHaveBeenCalled();
});

it('does not conjure a selection back on a reload of a bare self-written coordinate', async () => {
  engine.initializeViewer.mockResolvedValue(createLoadedMap());
  vi.useFakeTimers();

  // What the URL looks like after the visitor dismissed the panel: the camera
  // survives, the identity was cleared by releasePick().
  await bootAt(`/?lat=${TARGET.lat}&lng=${TARGET.lng}&zoom=17`, { selfWritten: true });
  await vi.advanceTimersByTimeAsync(20000);

  expect(engine.initializeViewer).toHaveBeenCalledWith('mapContainer', DEEP_LINK_CAMERA);
  expect(engine.sidebar.show).not.toHaveBeenCalled();
  expect(engine.applyZoneHighlight).not.toHaveBeenCalled();
});

it('reopens the panel on a reload of a self-written URL that still names a parcel', async () => {
  engine.initializeViewer.mockResolvedValue(createLoadedMap());

  await bootAt(
    `/?lat=${TARGET.lat}&lng=${TARGET.lng}&zoom=17&egrid=${TILE_EGRID}`,
    { selfWritten: true },
  );

  await vi.waitFor(() => {
    expect(engine.sidebar.show).toHaveBeenCalledWith(
      TILE_EGRID,
      null,
      expect.objectContaining({ type: 'Polygon' }),
      [TARGET.lng, TARGET.lat],
      expect.anything(),
    );
  });
});

it('refuses the neighbour when a self-written reload names a parcel that is not under the point', async () => {
  // The drift case v1.184.0 names: the id says one parcel, the coordinates have
  // moved on to another. similoo's own moveend writer drops the EGRID the moment
  // the camera leaves the confirmed point, so its own links cannot get here —
  // a hand-edited or truncated one can.
  const neighbour = createLoadedMap('CH999999999999');
  engine.initializeViewer.mockResolvedValue(neighbour);
  vi.useFakeTimers();

  await bootAt(
    `/?lat=${TARGET.lat}&lng=${TARGET.lng}&zoom=17&egrid=${TILE_EGRID}`,
    { selfWritten: true },
  );
  // Both hit-test retry budgets (~3 s each) drain without a match.
  await vi.advanceTimersByTimeAsync(20000);

  // The parcel under the point is NOT presented as the one the link names.
  expect(engine.applyZoneHighlight).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ targetParcelId: 'CH999999999999' }),
  );
  // The panel still opens — on the EGRID the link actually names, which similoo
  // can resolve without the tile.
  expect(engine.sidebar.show).toHaveBeenCalledWith(
    TILE_EGRID,
    null,
    null,
    [TARGET.lng, TARGET.lat],
    null,
  );
});
