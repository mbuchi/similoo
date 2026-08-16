import { beforeEach, describe, expect, it, vi } from 'vitest';

const mapInstances = vi.hoisted(() => [] as Array<{ options: Record<string, unknown> }>);

vi.mock('maplibre-gl', () => {
  class FakeMap {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      mapInstances.push(this);
    }

    addControl() {}

    once(event: string, callback: () => void) {
      if (event === 'load') queueMicrotask(callback);
      return this;
    }
  }

  return {
    Map: FakeMap,
    ScaleControl: class FakeScaleControl {},
  };
});

vi.mock('@aireon/shared/map-worker', () => ({
  applyMapWorkerUrl: vi.fn(),
}));

vi.mock('@aireon/shared/map-defaults', () => ({
  DEFAULT_MAP_ZOOM: 15,
}));

import { initializeViewer } from './viewerConfig.js';

describe('initializeViewer', () => {
  beforeEach(() => {
    mapInstances.length = 0;
  });

  it('starts the first map at the searched address instead of the Zurich default', async () => {
    const searchedCamera = {
      center: [7.444192, 46.946774],
      zoom: 17,
      pitch: 50,
      bearing: -25,
    };

    const map = await initializeViewer('mapContainer', searchedCamera);

    expect(map).toBe(mapInstances[0]);
    expect(mapInstances[0].options).toMatchObject({
      container: 'mapContainer',
      ...searchedCamera,
    });
  });
});
