import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetUrlStateForTests } from '@aireon/shared/url-params';
import { clearConfirmedParcelUrl, stampConfirmedParcelUrl } from './confirmedLocation.js';

// deepLinkAddress.js reaches for the shared geo.admin client at import time.
// Nothing here resolves an address, so stub it out rather than pulling a
// network module into a pure-unit file.
vi.mock('@aireon/shared/geoadmin', () => ({
  resolveAddressAtPoint: vi.fn(),
}));

interface FakeWindow {
  location: { search: string; pathname: string; hash: string; href: string };
  history: { replaceState: (...args: unknown[]) => void; state: unknown };
}

// The shared url-params module parses `location.search` once and caches the
// result for the page's lifetime, so every test must stub a fresh `window` AND
// reset that cache — otherwise the first test's parse wins for the whole file.
// `href` is required too: the shared writer builds on `new URL(location.href)`.
//
// The stub's replaceState writes the new URL back into `location`, exactly as a
// browser does. Without that, two writes in a row would each start from the
// original address and the second would silently undo the first — the opposite
// of what actually happens on a page.
function stubWindow(search = ''): FakeWindow {
  const fake: FakeWindow = {
    location: { search, pathname: '/', hash: '', href: `https://similoo.aireon.ch/${search}` },
    history: {
      replaceState: vi.fn((..._args: unknown[]) => {
        const next = new URL(String(_args[2]), fake.location.href);
        fake.location.href = next.toString();
        fake.location.pathname = next.pathname;
        fake.location.search = next.search;
        fake.location.hash = next.hash;
      }),
      state: null,
    },
  };
  vi.stubGlobal('window', fake as unknown as Window & typeof globalThis);
  __resetUrlStateForTests();
  return fake;
}

function lastUrl(fake: FakeWindow): string {
  const calls = (fake.history.replaceState as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1][2] as string;
}

function lastParams(fake: FakeWindow): URLSearchParams {
  return new URLSearchParams(lastUrl(fake).split('?')[1] ?? '');
}

afterEach(() => {
  vi.unstubAllGlobals();
  __resetUrlStateForTests();
});

// Picking a parcel is a location CONFIRMATION, so it must reach the address
// bar: the URL is what the user copies, and it is verbatim what the navbar's
// "Share this view" button puts on the clipboard. Before this contract similoo
// published only the coordinates, so a shared link could not say WHICH parcel
// it meant and had to re-derive one from whatever sat under the point.
describe('stampConfirmedParcelUrl', () => {
  it('writes the parcel identity, its address and the camera so a copied link reproduces the pick', () => {
    const fake = stubWindow('?lat=47.1&lng=8.1&zoom=12');
    stampConfirmedParcelUrl({
      lat: 47.376888,
      lng: 8.541694,
      zoom: 18.5,
      label: 'Bahnhofstrasse 1, 8001 Zürich',
      egrid: 'CH294676423526',
    });
    const params = lastParams(fake);
    expect(params.get('lat')).toBe('47.376888');
    expect(params.get('lng')).toBe('8.541694');
    expect(params.get('zoom')).toBe('18.50');
    expect(params.get('egrid')).toBe('CH294676423526');
    expect(params.get('q')).toBe('Bahnhofstrasse 1, 8001 Zürich');
  });

  it('writes nothing rather than an empty identity when the parcel has neither an address nor an EGRID', () => {
    const fake = stubWindow('');
    stampConfirmedParcelUrl({ lat: 47.5, lng: 8.9, zoom: 17, label: null, egrid: null });
    const params = lastParams(fake);
    expect(params.get('lat')).toBe('47.500000');
    expect(params.has('egrid')).toBe(false);
    expect(params.has('q')).toBe(false);
  });

  // Searching a second address must not leave the first parcel's identity
  // behind: a stale EGRID outranks the coordinates on read, so the link would
  // restore the WRONG parcel (URL_PARAMS_STANDARD.md, "Address precedence").
  it('replaces the previous pick instead of accumulating identities', () => {
    const fake = stubWindow('?lat=47.1&lng=8.1&egrid=CH000000000000&q=Old+Street+1');
    stampConfirmedParcelUrl({
      lat: 47.2,
      lng: 8.2,
      zoom: 17,
      label: 'New Street 2',
      egrid: 'CH999999999999',
    });
    const params = lastParams(fake);
    expect(params.getAll('egrid')).toEqual(['CH999999999999']);
    expect(params.getAll('q')).toEqual(['New Street 2']);
  });

  // `address` is the suite's legacy alias of `q`, and the reader takes the
  // first of the two — a stale alias left in place would out-rank the label
  // just written.
  it('drops the legacy ?address= alias so the label it just wrote is the one read back', () => {
    const fake = stubWindow('?address=Stale+Label');
    stampConfirmedParcelUrl({ lat: 47.2, lng: 8.2, zoom: 17, label: 'Fresh Label', egrid: null });
    const params = lastParams(fake);
    expect(params.has('address')).toBe(false);
    expect(params.get('q')).toBe('Fresh Label');
  });

  // similoo's own older spelling, which the shared writer knows nothing about
  // and which readDeepLinkAddress() PREFERS over `q` — so leaving one behind
  // would let a stale label outlive the value that replaced it.
  it('drops similoo\'s legacy ?label= spelling too', () => {
    const fake = stubWindow('?label=Alte+Rheinstrasse+87%2C+8424+Embrach');
    stampConfirmedParcelUrl({
      lat: 47.521503,
      lng: 8.583285,
      zoom: 17,
      label: 'Alte Rheinstrasse 91, 8424 Embrach',
      egrid: 'CH813872487780',
    });
    const params = lastParams(fake);
    expect(params.has('label')).toBe(false);
    expect(params.get('q')).toBe('Alte Rheinstrasse 91, 8424 Embrach');
  });

  it('preserves unrelated params so mode, theme, language and overlay opacity survive a pick', () => {
    const fake = stubWindow('?mode=embed&theme=dark&lang=fr&opacity=40&search_modal=off');
    stampConfirmedParcelUrl({ lat: 47.2, lng: 8.2, zoom: 17, label: 'A 1', egrid: 'CH1' });
    const params = lastParams(fake);
    expect(params.get('mode')).toBe('embed');
    expect(params.get('theme')).toBe('dark');
    expect(params.get('lang')).toBe('fr');
    expect(params.get('opacity')).toBe('40');
    expect(params.get('search_modal')).toBe('off');
  });

  // A mapless or not-yet-mounted caller must never be able to wipe an inbound
  // deep link: a null param DELETES it, so a write with no real coordinates
  // would erase the very link the page is booting from.
  it('writes nothing at all when the coordinates are not real', () => {
    const fake = stubWindow('?lat=47.1&lng=8.1&egrid=CH123456789012');
    stampConfirmedParcelUrl({ lat: Number.NaN, lng: 8.2, zoom: 17, label: 'A 1', egrid: 'CH1' });
    expect(fake.history.replaceState).not.toHaveBeenCalled();
  });

  it('never throws when history.replaceState is blocked', () => {
    const fake = stubWindow('?label=Old');
    fake.history.replaceState = () => {
      throw new Error('replaceState blocked');
    };
    expect(() =>
      stampConfirmedParcelUrl({ lat: 47.5, lng: 8.9, zoom: 17, label: 'A', egrid: 'CH1' }),
    ).not.toThrow();
  });
});

// Dismissing the comparison panel retracts the claim. Otherwise the URL — and
// every "Share this view" link built from it — keeps naming a parcel that is no
// longer on screen.
describe('clearConfirmedParcelUrl', () => {
  it('drops the label and every parcel identifier but keeps the camera', () => {
    const fake = stubWindow('?lat=47.1&lng=8.1&zoom=18&egrid=CH123456789012&q=Some+Street+1&label=Some+Street+1');
    clearConfirmedParcelUrl({ lat: 47.3, lng: 8.3, zoom: 16 });
    const params = lastParams(fake);
    expect(params.has('egrid')).toBe(false);
    expect(params.has('q')).toBe(false);
    expect(params.has('label')).toBe(false);
    expect(params.has('address')).toBe(false);
    expect(params.get('lat')).toBe('47.300000');
    expect(params.get('lng')).toBe('8.300000');
    expect(params.get('zoom')).toBe('16.00');
  });

  it('also clears the uppercase ?EGRID= and ?parcel_id= spellings', () => {
    const fake = stubWindow('?lat=47.1&lng=8.1&EGRID=CH123456789012&parcel_id=456');
    clearConfirmedParcelUrl({ lat: 47.3, lng: 8.3, zoom: 16 });
    const params = lastParams(fake);
    expect(params.has('EGRID')).toBe(false);
    expect(params.has('parcel_id')).toBe(false);
  });
});
