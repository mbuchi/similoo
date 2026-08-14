// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
// The engine as TEXT, not as a module: importing it for real would pull in
// MapLibre, Three and the whole viewer. `?raw` is Vite's own loader, so this
// costs nothing at build time and never runs the engine.
import engineSource from './main.js?raw';

// The reported defect, in similoo's own vocabulary:
//
//   /?lat=47.521503&lng=8.583285&zoom=17.00&theme=dark&label=Alte+Rheinstrasse+87%2C+8424+Embrach
//
// Those coordinates are on Embrach parcel CH813872487780, whose address is
// "Alte Rheinstrasse 91". similoo fed the URL text straight into handlePick as
// the address of whatever parcel the coordinates resolve to, so it titled the
// identity header, the PRM save record and the navbar with number 87 — and
// wrote it back out again, so every copy of the link kept the wrong number.
//
// These guard the contract the engine's deep-link bootstrap depends on: a label
// that arrives alongside coordinates is never the answer, both spellings of the
// key are read, and the writer leaves only one of them behind.

const REPORTED_URL =
  '/?lat=47.521503&lng=8.583285&zoom=17.00&theme=dark&label=Alte+Rheinstrasse+87%2C+8424+Embrach';

const resolveAddressAtPoint = vi.fn();
vi.mock('@aireon/shared/geoadmin', () => ({
  resolveAddressAtPoint: (...args: unknown[]) => resolveAddressAtPoint(...args),
}));

/**
 * Boot the module against a URL. The shared parser reads `window.location` once
 * and caches it, and it lives in an externalised dependency that
 * `vi.resetModules()` does not reach, so its own reset hook is what actually
 * re-reads the URL.
 */
async function bootAt(url: string) {
  window.history.replaceState(null, '', url);
  const { __resetUrlStateForTests } = await import('@aireon/shared/url-params');
  __resetUrlStateForTests();
  vi.resetModules();
  return import('./deepLinkAddress.js');
}

beforeEach(() => {
  resolveAddressAtPoint.mockReset();
});

describe('readDeepLinkAddress', () => {
  it('never lets a label win over the coordinates it disagrees with', async () => {
    const { readDeepLinkAddress } = await bootAt(REPORTED_URL);
    const { hint, authoritative } = readDeepLinkAddress();

    // Shown immediately so the header is not blank, but the engine must
    // resolve over it.
    expect(hint).toBe('Alte Rheinstrasse 87, 8424 Embrach');
    expect(authoritative).toBe(false);
  });

  it('reads the canonical ?q the shared search and context menu write', async () => {
    // The dual-key hazard: similoo used to read only its own ?label, so a `q`
    // refreshed by the context menu's EGRID lookup never reached the display.
    const { readDeepLinkAddress } = await bootAt(
      '/?lat=47.521503&lng=8.583285&q=Alte+Rheinstrasse+91+8424+Embrach',
    );
    expect(readDeepLinkAddress().hint).toBe('Alte Rheinstrasse 91 8424 Embrach');
    expect(readDeepLinkAddress().authoritative).toBe(false);
  });

  it('prefers similoo\'s legacy ?label when a link carries both keys', async () => {
    const { readDeepLinkAddress } = await bootAt(
      '/?lat=47.521503&lng=8.583285&label=From+label&q=From+q',
    );
    expect(readDeepLinkAddress().hint).toBe('From label');
  });

  it('offers no hint for a bare coordinate link', async () => {
    const { readDeepLinkAddress } = await bootAt('/?lat=47.521503&lng=8.583285');
    expect(readDeepLinkAddress()).toEqual({ hint: null, authoritative: false });
  });

  it('a bare ?q= IS authoritative — nothing in the URL contradicts it', async () => {
    const { readDeepLinkAddress } = await bootAt('/?q=Bahnhofstrasse+1%2C+8001+Z%C3%BCrich');
    expect(readDeepLinkAddress()).toEqual({
      hint: 'Bahnhofstrasse 1, 8001 Zürich',
      authoritative: true,
    });
  });
});

describe('resolveDeepLinkLabel', () => {
  it('asks the parcel, not the point, and returns the address to overwrite the hint', async () => {
    const { resolveDeepLinkLabel } = await bootAt(REPORTED_URL);
    resolveAddressAtPoint.mockResolvedValue({
      label: 'Alte Rheinstrasse 91 8424 Embrach',
      source: 'gwr',
    });

    const label = await resolveDeepLinkLabel({
      egrid: 'CH813872487780',
      lat: 47.521503,
      lng: 8.583285,
    });

    expect(label).toBe('Alte Rheinstrasse 91 8424 Embrach');
    // The EGRID the pick already holds is passed through, so the answer is a
    // function of the parcel and not of the coordinate inside it.
    expect(resolveAddressAtPoint).toHaveBeenCalledWith(
      47.521503,
      8.583285,
      expect.objectContaining({ egrid: 'CH813872487780' }),
    );
  });

  it('keeps the link usable when the lookup fails or finds nothing', async () => {
    const { resolveDeepLinkLabel } = await bootAt(REPORTED_URL);

    resolveAddressAtPoint.mockRejectedValueOnce(new Error('geo.admin down'));
    await expect(
      resolveDeepLinkLabel({ lat: 47.521503, lng: 8.583285 }),
    ).resolves.toBeNull();

    resolveAddressAtPoint.mockResolvedValueOnce(null);
    await expect(
      resolveDeepLinkLabel({ lat: 47.521503, lng: 8.583285 }),
    ).resolves.toBeNull();
  });

  it('does not look up a point that is not one', async () => {
    const { resolveDeepLinkLabel } = await bootAt(REPORTED_URL);
    await expect(resolveDeepLinkLabel({ lat: NaN, lng: 8.5 })).resolves.toBeNull();
    expect(resolveAddressAtPoint).not.toHaveBeenCalled();
  });
});

describe('the engine wiring', () => {
  // main.js is the imperative engine: it owns the map, the sidebar and the
  // deep-link bootstrap in one closure, so there is no seam to call the
  // bootstrap from a unit test. These read the source instead — coarse, but
  // they are what stands between the fix and a silent regression to the shape
  // that shipped the bug (`?label` read straight in as the pick's address).
  const engine = engineSource;

  it('treats the deep-link text as a hint the coordinates outrank', () => {
    expect(engine).toContain('readDeepLinkAddress()');
    expect(engine).toContain('labelIsHint: true');
    expect(engine).toContain('resolveDeepLinkLabel(');
    // The old reader, which made the URL text the answer.
    expect(engine).not.toContain(".get('label')");
  });

  it('routes every label write through the single canonical writer', () => {
    expect(engine).not.toMatch(/extra:\s*\{\s*label/);
    expect(engine.match(/deepLinkLabelExtra\(/g)?.length).toBe(2);
  });
});

describe('deepLinkLabelExtra', () => {
  it('publishes the canonical q and clears the legacy label', async () => {
    const { deepLinkLabelExtra } = await bootAt(REPORTED_URL);
    // Two disagreeing spellings of similoo's own label can never ship in one
    // link: the reader prefers `label`, so leaving a stale one behind would
    // outlive the value that replaced it.
    expect(deepLinkLabelExtra('Alte Rheinstrasse 91 8424 Embrach')).toEqual({
      q: 'Alte Rheinstrasse 91 8424 Embrach',
      label: null,
    });
  });

  it('drops the label entirely when there is none, rather than writing an empty one', async () => {
    const { deepLinkLabelExtra } = await bootAt(REPORTED_URL);
    expect(deepLinkLabelExtra(null)).toEqual({ q: null, label: null });
    expect(deepLinkLabelExtra('')).toEqual({ q: null, label: null });
  });
});
