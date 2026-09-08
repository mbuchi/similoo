/** @vitest-environment jsdom */

import { afterEach, expect, it, vi } from 'vitest';

// What the engine does when the visitor's browser cannot paint a map at all.
//
// maplibre-gl 6.7.0 changed how it reports a refused WebGL2 context: the
// constructor now THROWS `GPUInitializationError` instead of resolving a
// painter-less map. viewerConfig.js folds both engine behaviors into one named
// `MapStartupUnsupportedError` (see viewerConfig.test.ts); this file covers what
// ensureMap() in main.js does with it, which is the half the visitor sees.
//
// Before the guard, that error escaped as a rejected promise from a call chain
// with NO terminal catch anywhere (`handlePick(r)` from the `similoo:search`
// listener, the deep-link bootstrap, `void showEmptyMap(...)` — the bootstrap's
// synchronous `try/catch` cannot catch an async rejection). The visitor was
// switched to an empty comparison view and left there, while App.tsx's
// `errorLogger.install({ captureConsoleErrors: true })` filed TWO hub bug rows
// per WebGL2-less visit: one for the `console.error`, one for the unhandled
// rejection. `mapLoading = null` then re-armed construction, so every later
// search filed two more.
//
// Three contracts, and the third is what keeps a real bug loud.

const engine = vi.hoisted(() => ({
  initializeViewer: vi.fn(),
  applyZoneHighlight: vi.fn(),
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
  onLocaleChange: () => () => {},
}));

vi.mock('./comparison/sidebar.js', () => ({
  createComparisonSidebar: () => engine.sidebar,
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

/** Exactly what viewerConfig.js's construction gate raises for this cause. */
function mapStartupUnsupported() {
  return Object.assign(
    new Error('WebGL2 is unavailable - MapLibre returned a map with no painter'),
    { name: 'MapStartupUnsupportedError' },
  );
}

async function boot() {
  document.body.innerHTML = `
    <section id="landingView"></section>
    <section id="comparisonView" hidden>
      <div id="mapContainer"></div>
    </section>
  `;
  window.history.replaceState(null, '', '/');
  const { __resetUrlStateForTests } = await import('@aireon/shared/url-params');
  __resetUrlStateForTests();
  vi.resetModules();
  const { boot: start } = await import('./main.js');
  start();
}

function search(label: string, lat = TARGET.lat, lng = TARGET.lng) {
  window.dispatchEvent(new CustomEvent('similoo:search', { detail: { label, lat, lng } }));
}

afterEach(() => {
  vi.useRealTimers();
  engine.initializeViewer.mockReset();
  engine.sidebar.show.mockReset();
});

it('explains itself instead of leaving a blank comparison view', async () => {
  engine.initializeViewer.mockRejectedValue(mapStartupUnsupported());
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const unavailable = vi.fn();
  window.addEventListener('similoo:map-unavailable', unavailable);
  vi.useFakeTimers();

  await boot();
  search('Bahnhofstrasse 1');
  await vi.advanceTimersByTimeAsync(20000);

  // The React shell is told once, so ComparisonView can swap the empty map
  // container for the shared <MapUnavailable/> panel.
  expect(unavailable).toHaveBeenCalledTimes(1);
  // ⚠ console.WARN, never console.error: App.tsx installs the shared error
  // logger with `captureConsoleErrors: true`, so an error here files one hub bug
  // row per WebGL2-less visitor for what is a device setting, not a defect.
  expect(warn).toHaveBeenCalledWith('MapLibre startup unsupported:', expect.any(String));
  expect(error).not.toHaveBeenCalledWith('Error initializing viewer:', expect.anything());

  window.removeEventListener('similoo:map-unavailable', unavailable);
  warn.mockRestore();
  error.mockRestore();
});

it('does not re-arm construction on a device that will never paint', async () => {
  engine.initializeViewer.mockRejectedValue(mapStartupUnsupported());
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const unavailable = vi.fn();
  window.addEventListener('similoo:map-unavailable', unavailable);
  vi.useFakeTimers();

  await boot();
  search('First address');
  await vi.advanceTimersByTimeAsync(20000);
  // Two more chances to rebuild: another search, and a recenter (which reaches
  // ensureMap through its own `void ensureMap().then(...)` path).
  search('Second address', 47.376888, 8.541694);
  window.dispatchEvent(new CustomEvent('similoo:center', {
    detail: { lat: 47.376888, lng: 8.541694 },
  }));
  await vi.advanceTimersByTimeAsync(20000);

  // `mapLoading` keeps the resolved-null promise, so every later call
  // short-circuits. Re-arming would rebuild, re-warn and re-report forever.
  expect(engine.initializeViewer).toHaveBeenCalledTimes(1);
  expect(unavailable).toHaveBeenCalledTimes(1);

  window.removeEventListener('similoo:map-unavailable', unavailable);
  warn.mockRestore();
});

it('keeps a GENUINE boot failure loud, and still retries it', async () => {
  // The contract that stops the guard becoming a blanket swallow: a style fetch
  // that failed, a bad container, a real bug. None of these are "no WebGL here",
  // and none may be downgraded to a warning or silently latched off.
  engine.initializeViewer.mockRejectedValue(new TypeError('style is not valid'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const unavailable = vi.fn();
  window.addEventListener('similoo:map-unavailable', unavailable);
  vi.useFakeTimers();

  await boot();
  search('First address');
  await vi.advanceTimersByTimeAsync(20000);

  expect(error).toHaveBeenCalledWith('Error initializing viewer:', expect.any(TypeError));
  // NOT the device story — the visitor is not told their machine cannot draw maps.
  expect(unavailable).not.toHaveBeenCalled();

  // A transient failure must stay retryable: `mapLoading` is reset for this
  // cause, so the next search constructs again.
  search('Second address', 47.376888, 8.541694);
  await vi.advanceTimersByTimeAsync(20000);
  expect(engine.initializeViewer).toHaveBeenCalledTimes(2);

  window.removeEventListener('similoo:map-unavailable', unavailable);
  error.mockRestore();
});
