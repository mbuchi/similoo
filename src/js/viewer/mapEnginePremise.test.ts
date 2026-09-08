// @vitest-environment jsdom
//
// The PREMISE test for similoo's construction gate.
//
// Every other guard around the map here is written against a FakeMap
// (viewerConfig.test.ts, mapUnavailable.test.ts). That is right for contract
// tests, but a fake cannot tell us whether the shape we gate on is REAL — a
// fake that lies about MapLibre would let the whole suite pass vacuously. So
// this file drives the actual `maplibre-gl` this repo resolves, in jsdom, with
// every canvas context refused.
//
// ⚠⚠ THE ENGINE CHANGED ITS MIND IN 6.7.0, and the two behaviors are mutually
// exclusive — a guard written for one is DEAD CODE under the other:
//
//   maplibre-gl <= 6.6.0  `_setupPainter()` fires a GPUInitializationError EVENT
//                         and the constructor ends `if (!this.painter) return;`
//                         -> `new Map()` RESOLVES with a painter-less map.
//   maplibre-gl >= 6.7.0  `_setupPainter()` THROWS and the constructor rethrows
//                         after `_cleanupContainer()`
//                         -> `new Map()` THROWS, so a post-construction painter
//                            gate is never reached.
//
// This file therefore asserts the behavior of the engine ACTUALLY INSTALLED
// (`mod.getVersion()`), and then asserts — version-independently — that
// `constructMapSafely` produces the same graceful `null` either way. That last
// block is the contract similoo's viewerConfig.js depends on, and it must hold
// across the bump in both directions.
//
// Suite memory: maplibre-6-7-0-throws-on-gpu-init,
//               maplibre-gpu-init-returns-half-built-map.

import { describe, expect, it } from 'vitest';
import { constructMapSafely, isGpuInitializationError, isMapUsable } from '@aireon/shared/webgl';

/** Every canvas context request is refused — the condition under test. */
function refuseAllContexts(): void {
  const proto = window.HTMLCanvasElement.prototype as unknown as {
    getContext: (id: string) => unknown;
  };
  proto.getContext = () => null;
}

/** Non-vacuity probe: is the harness genuinely WebGL2-less? */
function refusesWebGL2(): boolean {
  return document.createElement('canvas').getContext('webgl2') === null;
}

function newContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/** `major.minor.patch` -> comparable, so 6.10.0 sorts above 6.7.0. */
function atLeast(version: string, major: number, minor: number): boolean {
  const [maj = 0, min = 0] = version.split('.').map((n) => Number.parseInt(n, 10) || 0);
  return maj > major || (maj === major && min >= minor);
}

// ⚠ MODULE SCOPE, not `beforeAll`. `describe.runIf(...)` is evaluated while the
// file is being COLLECTED — before any hook runs — so a flag set in a hook is
// still its initial value when the branch is chosen, and the file would silently
// assert the WRONG engine's premise while reporting green.
refuseAllContexts();
// maplibre reaches for this during setup; jsdom does not ship it.
const g = globalThis as unknown as { URL: { createObjectURL?: unknown } };
g.URL.createObjectURL ??= () => 'blob:test';
const loaded = await import('maplibre-gl');
const mod = ((loaded as { default?: unknown }).default ?? loaded) as typeof import('maplibre-gl');
// The engine's own answer, so this stays correct across the static.aireon.ch
// seam where no bundled package.json is in play.
const engineVersion = mod.getVersion();
/** True when the installed engine THROWS out of the constructor (>= 6.7.0). */
const throwsOnGpuInit = atLeast(engineVersion, 6, 7);

function buildMap() {
  return new mod.Map({
    container: newContainer(),
    style: { version: 8, sources: {}, layers: [] },
  });
}

describe('the premise: the REAL maplibre-gl with WebGL2 refused', () => {
  it('refuses every WebGL2 context in this harness (non-vacuity guard)', () => {
    expect(refusesWebGL2()).toBe(true);
  });

  it('reports a version this file knows how to judge (non-vacuity guard)', () => {
    // A blank or garbage version would silently take the <= 6.6.0 branch and
    // assert the wrong premise, so pin the shape.
    expect(engineVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  describe.runIf(!throwsOnGpuInit)('<= 6.6.0 - returns a painter-less Map', () => {
    it('does NOT throw, and hands back a map isMapUsable rejects', () => {
      let map: unknown;
      expect(() => {
        map = buildMap();
      }).not.toThrow();
      expect((map as { painter?: unknown }).painter).toBeUndefined();
      expect(isMapUsable(map)).toBe(false);
    });
  });

  describe.runIf(throwsOnGpuInit)('>= 6.7.0 - throws GPUInitializationError', () => {
    it('THROWS out of the constructor, so a post-construction gate never runs', () => {
      expect(() => buildMap()).toThrow();
    });

    it('throws an error this suite recognizes by NAME, not by identity', () => {
      let caught: unknown;
      try {
        buildMap();
      } catch (error) {
        caught = error;
      }
      expect((caught as Error).name).toBe('GPUInitializationError');
      expect((caught as Error).message).toContain('WebGL2 is required to display this map');
      // ⚠ similoo loads the engine from static.aireon.ch in production, so an
      // `instanceof` check across that seam would be false for the very error it
      // exists to recognize.
      expect(isGpuInitializationError(caught)).toBe(true);
    });
  });
});

// ⚠⚠ THE CONTRACT viewerConfig.js DEPENDS ON. Deliberately NOT version-gated:
// it must pass on 6.6.0 and on 6.7.0, which is the whole point of routing the
// construction site through one helper.
describe('constructMapSafely against the REAL engine', () => {
  it('returns null instead of throwing or handing back an unusable map', () => {
    let result: unknown = 'unset';
    expect(() => {
      result = constructMapSafely(() => buildMap());
    }).not.toThrow();
    expect(result).toBeNull();
  });

  it('RETHROWS anything that is not a GPU-init failure - a real bug stays loud', () => {
    const boom = new TypeError('style is not valid');
    expect(() => constructMapSafely(() => { throw boom; })).toThrow(boom);
  });
});
