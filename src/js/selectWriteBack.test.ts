/** @vitest-environment jsdom */

import { afterEach, expect, it, vi } from 'vitest';

// `?select=` is a WRITTEN param, not only a read one (@aireon/shared v1.185.0,
// URL_PARAMS_STANDARD.md, "Open with the parcel selected"). The address bar has
// to state what is ON SCREEN rather than what the page booted with, so that the
// link the visitor copies — and the one the navbar's "Share this view" button
// puts on the clipboard verbatim — reopens the view they were looking at:
//
//   • the comparison opens  → `…&q=…&egrid=…&select=parcel`
//   • the panel is closed   → `…&select=off`, identity dropped, camera kept
//   • the map is panned     → unchanged; a camera move is not a selection event
//
// deepLinkSelect.test.ts covers the READ half (which links owe a selection).
// This file covers the WRITE half, end to end: the real engine, the real shared
// writer and a real jsdom URL, with only the map, the sidebar and the address
// resolver stubbed. The three writers are the ones that get this wrong in the
// suite, so each is driven for real rather than asserted against source text.

const engine = vi.hoisted(() => ({
  initializeViewer: vi.fn(),
  applyZoneHighlight: vi.fn(),
  sidebar: {
    hide: vi.fn(),
    show: vi.fn(),
    setAddress: vi.fn(),
  },
  // The options createComparisonSidebar was built with, so the test can fire
  // the panel's own close button instead of reaching past it.
  sidebarOptions: null as { onClose?: () => void } | null,
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
  createComparisonSidebar: (options: { onClose?: () => void }) => {
    engine.sidebarOptions = options;
    return engine.sidebar;
  },
}));

vi.mock('./comparison/parcelLookup.js', () => ({
  resolveEgridFromLngLat: vi.fn(async () => null),
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

vi.mock('./deepLinkAddress.js', () => ({
  readDeepLinkAddress: () => ({ hint: null, authoritative: false }),
  resolveDeepLinkLabel: vi.fn(async () => null),
  deepLinkLabelExtra: (label: string | null) => ({ q: label, label: null }),
}));

const TARGET = { lat: 46.946774, lng: 7.444192 };
const TILE_EGRID = 'CH294676423526';

/** Handlers the engine registered with `map.on`, so the test can fire them. */
const handlers: Record<string, (...args: unknown[]) => void> = {};

function createLoadedMap() {
  const parcel = {
    id: TILE_EGRID,
    properties: { parcel_id: TILE_EGRID, cz_local: 'Wohnzone, Bauklasse 4' },
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
  // The camera the map reports. Mutable: panning is simulated by moving it and
  // firing the engine's own `moveend` handler.
  let center = { lat: TARGET.lat, lng: TARGET.lng };

  return {
    panTo(next: { lat: number; lng: number }) {
      center = next;
      handlers.moveend?.();
    },
    jumpTo: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    getLayer: vi.fn(() => true),
    getZoom: vi.fn(() => 17),
    getCenter: vi.fn(() => center),
    getContainer: vi.fn(() => document.getElementById('mapContainer')),
    getSource: vi.fn(() => null),
    setPaintProperty: vi.fn(),
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

async function bootAt(url: string, { selfWritten = false } = {}) {
  document.body.innerHTML = `
    <section id="landingView"></section>
    <section id="comparisonView" hidden>
      <div id="mapContainer"></div>
    </section>
  `;
  window.history.replaceState(selfWritten ? { aireonSelfWritten: true } : null, '', url);
  const { __resetUrlStateForTests } = await import('@aireon/shared/url-params');
  __resetUrlStateForTests();
  vi.resetModules();
  const { boot } = await import('./main.js');
  boot();
}

function params() {
  return new URLSearchParams(window.location.search);
}

afterEach(() => {
  vi.useRealTimers();
  engine.initializeViewer.mockReset();
  engine.applyZoneHighlight.mockReset();
  engine.sidebar.show.mockReset();
  engine.sidebarOptions = null;
  for (const key of Object.keys(handlers)) delete handlers[key];
});

it('says select=parcel in the address bar once the comparison is open', async () => {
  engine.initializeViewer.mockResolvedValue(createLoadedMap());

  await bootAt(`/?lat=${TARGET.lat}&lng=${TARGET.lng}&zoom=17&egrid=${TILE_EGRID}`);
  await vi.waitFor(() => expect(engine.sidebar.show).toHaveBeenCalled());

  expect(params().get('select')).toBe('parcel');
  expect(params().get('egrid')).toBe(TILE_EGRID);
});

// The camera write-back drops the label and the EGRID as soon as the map leaves
// the point they describe — and a null identity is exactly what the shared
// writer reads as a deselect when nobody tells it otherwise. So the writer that
// runs on EVERY drag is the one that would announce a dismissal the visitor
// never made, with the comparison still open beside them.
it('leaves select alone when the visitor merely pans the map', async () => {
  const map = createLoadedMap();
  engine.initializeViewer.mockResolvedValue(map);

  await bootAt(`/?lat=${TARGET.lat}&lng=${TARGET.lng}&zoom=17&egrid=${TILE_EGRID}`);
  await vi.waitFor(() => expect(engine.sidebar.show).toHaveBeenCalled());
  expect(params().get('select')).toBe('parcel');

  map.panTo({ lat: 46.96, lng: 7.47 });

  // The identity goes (those coordinates no longer name that parcel) but the
  // panel is still open, so the claim stands.
  expect(params().get('select')).toBe('parcel');
  expect(params().has('egrid')).toBe(false);
  expect(params().get('lat')).toBe('46.960000');
});

// The half a visitor notices: they dismiss the panel, copy the link, and the
// recipient gets the clean map they were looking at rather than the comparison
// they had just closed.
it('stamps select=off when the panel is closed, and that URL reloads unselected', async () => {
  engine.initializeViewer.mockResolvedValue(createLoadedMap());

  await bootAt(`/?lat=${TARGET.lat}&lng=${TARGET.lng}&zoom=17&egrid=${TILE_EGRID}`);
  await vi.waitFor(() => expect(engine.sidebarOptions?.onClose).toBeTypeOf('function'));
  await vi.waitFor(() => expect(engine.sidebar.show).toHaveBeenCalled());

  engine.sidebarOptions?.onClose?.();

  expect(params().get('select')).toBe('off');
  expect(params().has('egrid')).toBe(false);
  expect(params().has('q')).toBe(false);
  // The camera is still what the visitor is looking at.
  expect(params().get('lat')).toBe('46.946774');
  expect(params().get('lng')).toBe('7.444192');
  expect(params().get('zoom')).toBe('17.00');

  // Round trip: reload exactly what the address bar now holds. `select=off`
  // is what carries the dismissal across the reload — without it a self-written
  // reload would be free to re-run the comparison on the parcel under the camera.
  const closedUrl = `/${window.location.search}`;
  engine.sidebar.show.mockReset();
  engine.applyZoneHighlight.mockReset();
  vi.useFakeTimers();
  engine.initializeViewer.mockResolvedValue(createLoadedMap());

  await bootAt(closedUrl, { selfWritten: true });
  await vi.advanceTimersByTimeAsync(20000);

  expect(document.getElementById('comparisonView')?.hidden).toBe(false);
  expect(engine.sidebar.show).not.toHaveBeenCalled();
  expect(engine.applyZoneHighlight).not.toHaveBeenCalled();
});
