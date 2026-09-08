import { beforeEach, describe, expect, it, vi } from 'vitest';

const mapInstances = vi.hoisted(() => [] as Array<{
  options: Record<string, unknown>;
  painter: unknown;
  removals: number;
}>);

// How the faked engine behaves on the NEXT construction. Four cases, because the
// construction gate in viewerConfig.js has to tell four things apart and three of
// them used to be untested here:
//
//   'healthy'      a real map. Note it carries a `painter` — the old fake did
//                  not, which made it indistinguishable from the broken 6.6.0
//                  shape the gate now rejects.
//   'painterless'  maplibre-gl <= 6.6.0 on a refused WebGL2 context: the
//                  constructor RESOLVES and hands back a map with no painter,
//                  which looks constructed and detonates later.
//   'throws-gpu'   maplibre-gl >= 6.7.0 on the same condition: the constructor
//                  THROWS a GPUInitializationError.
//   'throws-other' a genuine failure (bad style, missing container, a real bug).
//                  It must NOT be laundered into "no WebGL here".
const engine = vi.hoisted(() => ({
  mode: 'healthy' as 'healthy' | 'painterless' | 'throws-gpu' | 'throws-other',
}));

/** The real 6.7.0 error, reproduced by NAME and wording. */
const gpuInitError = () => Object.assign(
  new Error('WebGL2 is required to display this map. Please enable hardware acceleration.'),
  { name: 'GPUInitializationError' },
);

/** A failure that has nothing to do with the visitor's GPU. */
const unrelatedError = () => new TypeError('style is not valid');

vi.mock('maplibre-gl', () => {
  class FakeMap {
    options: Record<string, unknown>;
    // A successfully constructed MapLibre map always has a painter; the shared
    // `isMapUsable` gate is exactly this check.
    painter: unknown = { ok: true };
    removals = 0;

    constructor(options: Record<string, unknown>) {
      if (engine.mode === 'throws-gpu') throw gpuInitError();
      if (engine.mode === 'throws-other') throw unrelatedError();
      this.options = options;
      if (engine.mode === 'painterless') this.painter = undefined;
      mapInstances.push(this);
    }

    addControl() {}

    remove() {
      this.removals += 1;
    }

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
    engine.mode = 'healthy';
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

// ⚠ THE CONSTRUCTION GATE. These four cases are the whole reason
// `constructMapSafely` sits between `new maplibregl.Map(...)` and everything
// that touches the instance. The first two are the SAME visitor condition
// reported two mutually exclusive ways by two engine generations, and a guard
// written for either one alone is dead code under the other.
describe('initializeViewer on a device that cannot paint a map', () => {
  beforeEach(() => {
    mapInstances.length = 0;
    engine.mode = 'healthy';
  });

  it('reports the device cause, not a raw engine error, when the constructor THROWS (>= 6.7.0)', async () => {
    engine.mode = 'throws-gpu';

    const error = await initializeViewer('mapContainer').catch((e: Error) => e);

    // Named, so ensureMap() in main.js can take the graceful path (warn +
    // fallback panel) instead of the console.error + retry a real failure gets.
    expect((error as Error).name).toBe('MapStartupUnsupportedError');
    // Nothing was handed back for a caller to store and detonate on later.
    expect(mapInstances).toHaveLength(0);
  });

  it('reports the same cause when the constructor RESOLVES a painter-less map (<= 6.6.0)', async () => {
    engine.mode = 'painterless';

    const error = await initializeViewer('mapContainer').catch((e: Error) => e);

    expect((error as Error).name).toBe('MapStartupUnsupportedError');
    // The half-built instance is released rather than left holding a context
    // slot: `constructMapSafely` runs it through `safeRemoveMap`.
    expect(mapInstances).toHaveLength(1);
    expect(mapInstances[0].removals).toBe(1);
  });

  it('never reaches addControl or the load/error promise once the gate has failed', async () => {
    engine.mode = 'throws-gpu';
    // A hang here would mean the gate let execution fall through to the
    // `map.once('load')` promise, which nothing would ever settle.
    await expect(initializeViewer('mapContainer')).rejects.toThrow();
  });

  it('does NOT launder an unrelated constructor failure into "no WebGL here"', async () => {
    engine.mode = 'throws-other';

    const error = await initializeViewer('mapContainer').catch((e: Error) => e);

    // A bad style, a missing container or a real bug must stay loud and reach
    // main.js's console.error path, which retries and reports it as a defect.
    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toBe('style is not valid');
    expect((error as Error).name).not.toBe('MapStartupUnsupportedError');
  });
});
