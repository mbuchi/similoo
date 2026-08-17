/** @vitest-environment jsdom */

import { expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({
  initializeViewer: vi.fn(),
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
  applyZoneHighlight: vi.fn(),
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
  resolveEgridFromLngLat: vi.fn(),
  normaliseEgrid: (value: unknown) => value,
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

vi.mock('@aireon/shared/url-params', () => ({
  getUrlState: () => ({ lat: null, lng: null, zoom: null, selfWritten: false }),
  applyUrlUiModes: vi.fn(),
  updateMapUrl: engine.updateMapUrl,
  DEEP_LINK_MIN_ZOOM: 17,
  isAddressGateBypassed: () => false,
}));

vi.mock('./deepLinkAddress.js', () => ({
  readDeepLinkAddress: () => ({ hint: null, authoritative: false }),
  resolveDeepLinkLabel: vi.fn(),
  deepLinkLabelExtra: (label: string | null) => ({ q: label }),
}));

vi.mock('@aireon/shared/map-defaults', () => ({
  CH_OVERVIEW: { center: [8.23, 46.8], zoom: 8 },
}));

function createLoadedMap() {
  const parcel = {
    id: 'CH294676423526',
    // Real parcel-tile shape: `cz_local` is the cohort key the green wash and
    // /score/similoo are keyed on; `cz_harmonized` is what the sidebar's zone
    // pill resolves to (the tile is the only source that carries it).
    properties: { cz_local: 'Wohnzone, Bauklasse 4', cz_harmonized: 'Wohnzonen' },
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
    getCenter: vi.fn(() => ({ lat: 46.946774, lng: 7.444192 })),
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

it('initializes once at the first address and lets only the latest pending search move it', async () => {
  document.body.innerHTML = `
    <section id="landingView"></section>
    <section id="comparisonView" hidden>
      <div id="mapContainer"></div>
    </section>
  `;

  const map = createLoadedMap();
  let finishLoading!: (value: typeof map) => void;
  const loadingMap = new Promise<typeof map>((resolve) => {
    finishLoading = resolve;
  });
  engine.initializeViewer.mockReturnValue(loadingMap);

  const { boot } = await import('./main.js');
  boot();

  window.dispatchEvent(new CustomEvent('similoo:search', {
    detail: { label: 'First address', lat: 46.946774, lng: 7.444192 },
  }));

  await vi.waitFor(() => {
    expect(engine.initializeViewer).toHaveBeenCalledWith('mapContainer', {
      center: [7.444192, 46.946774],
      zoom: 17,
      pitch: 50,
      bearing: -25,
    });
  });

  window.dispatchEvent(new CustomEvent('similoo:search', {
    detail: { label: 'Latest address', lat: 47.376888, lng: 8.541694 },
  }));

  expect(engine.initializeViewer).toHaveBeenCalledTimes(1);

  finishLoading(map);

  await vi.waitFor(() => {
    expect(map.jumpTo).toHaveBeenCalledTimes(1);
    expect(map.jumpTo).toHaveBeenLastCalledWith({
      center: [8.541694, 47.376888],
      zoom: 17,
      pitch: 50,
      bearing: -25,
    });
  });

  window.dispatchEvent(new CustomEvent('similoo:search', {
    detail: { label: 'Later address', lat: 46.204391, lng: 6.143158 },
  }));

  await vi.waitFor(() => {
    expect(engine.initializeViewer).toHaveBeenCalledTimes(1);
    expect(map.jumpTo).toHaveBeenLastCalledWith({
      center: [6.143158, 46.204391],
      zoom: 17,
      pitch: 50,
      bearing: -25,
    });
  });

  // The picked tile's properties ride into the sidebar so its zone pill can
  // resolve the harmonized category (PARCEL_ZONE_STANDARD.md); the /score/
  // similoo target row alone only carries the municipal `cz_local`.
  await vi.waitFor(() => {
    expect(engine.sidebar.show).toHaveBeenLastCalledWith(
      'CH294676423526',
      'Later address',
      expect.objectContaining({ type: 'Polygon' }),
      [6.143158, 46.204391],
      expect.objectContaining({ cz_local: 'Wohnzone, Bauklasse 4', cz_harmonized: 'Wohnzonen' }),
    );
  });
});
