
// similoo's "comparable buildings" endpoint client.
//
// The real backend (`POST <RES_BASE>/score/similoo`) is being implemented in
// parallel — when it's not live (404 / network error) this module falls back
// to a deterministic mock seeded by the target EGRID so the UI ships and is
// demoable. The mock signature exactly matches the real contract so swapping
// in the live endpoint requires no UI changes.
//
// Request:  { egrid, years?, limit? }
// Response: { target, comparables[], meta }
//
//   target     — { egrid, municipality, cz_local, cz_abbrev, parcel_area_m2,
//                  lat, lng }
//   comparable — { egrid, municipality, cz_local, parcel_area_m2,
//                  building_volume_m3, footprint_m2, height_m, floors,
//                  construction_year, ratioV, similarity_score, lat, lng }

// Same-origin Vercel proxy. The proxy (api/similoo.ts) attaches the RES
// API token server-side so the client doesn't have to handle suite auth.
const ENDPOINT = '/api/similoo';

export async function fetchSimilooComparables(egrid, opts = {}) {
    if (!egrid) {
        throw new Error('fetchSimilooComparables: egrid is required');
    }
    const years = Number.isFinite(opts.years) ? opts.years : 10;
    const limit = Number.isFinite(opts.limit) ? opts.limit : 12;

    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ egrid, years, limit }),
        });

        // 404 → backend not deployed yet → mock.
        // 5xx → backend up but broken → mock so demo doesn't break.
        if (res.status === 404 || res.status >= 500) {
            console.warn(`similoo /score/similoo returned ${res.status}; using mock data`);
            return mockSimilooResponse(egrid, { years, limit });
        }
        if (!res.ok) {
            throw new Error(`similoo backend HTTP ${res.status}`);
        }
        return await res.json();
    } catch (err) {
        // Network / CORS / DNS failure → mock so the demo flow keeps working
        // before the backend is wired up. Real auth errors still surface
        // because they come back as 4xx (non-404) and re-throw above.
        console.warn('similoo backend unreachable, using mock data:', err?.message);
        return mockSimilooResponse(egrid, { years, limit });
    }
}

// ---------- deterministic mock ---------------------------------------
//
// Same shape as the real /score/similoo response, seeded by a hash of the
// input EGRID so the same parcel always yields the same comparables.

function hashString(s) {
    // FNV-1a 32-bit. Deterministic across browsers and tabs.
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

function seededRandom(seed) {
    // Mulberry32 PRNG — small, fast, decent statistical quality.
    let t = seed >>> 0;
    return function next() {
        t = (t + 0x6D2B79F5) >>> 0;
        let r = t;
        r = Math.imul(r ^ (r >>> 15), r | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

const MOCK_MUNICIPALITIES = [
    'Zürich', 'Bern', 'Genève', 'Basel', 'Lausanne', 'Winterthur',
    'Luzern', 'St. Gallen', 'Lugano', 'Biel/Bienne', 'Thun', 'Köniz',
    'La Chaux-de-Fonds', 'Schaffhausen', 'Fribourg', 'Chur',
];

const MOCK_ZONES = [
    { local: 'W2 — Wohnzone 2', abbrev: 'W2' },
    { local: 'W3 — Wohnzone 3', abbrev: 'W3' },
    { local: 'WG3 — Wohn- und Gewerbezone', abbrev: 'WG3' },
    { local: 'K2 — Kernzone', abbrev: 'K2' },
    { local: 'Z2 — Centre village', abbrev: 'Z2' },
];

function pick(arr, rand) {
    return arr[Math.floor(rand() * arr.length) % arr.length];
}

function mockSimilooResponse(egrid, { years, limit }) {
    const seed = hashString(String(egrid));
    const rand = seededRandom(seed);

    const zone = pick(MOCK_ZONES, rand);
    const targetMuni = pick(MOCK_MUNICIPALITIES, rand);
    const targetParcelArea = Math.round(400 + rand() * 2000);
    const targetLat = 46.5 + rand() * 1.4;   // CH-ish bounding box
    const targetLng = 6.5 + rand() * 3.5;

    const target = {
        egrid,
        municipality: targetMuni,
        cz_local: zone.local,
        cz_abbrev: zone.abbrev,
        parcel_area_m2: targetParcelArea,
        lat: targetLat,
        lng: targetLng,
        // Target-specific building metrics so the sidebar's top section has
        // something real to show against the comparables list.
        building_volume_m3: Math.round(targetParcelArea * (0.8 + rand() * 2.2)),
        footprint_m2: Math.round(targetParcelArea * (0.18 + rand() * 0.32)),
        height_m: Math.round((6 + rand() * 18) * 10) / 10,
        floors: 1 + Math.floor(rand() * 6),
        construction_year: 1950 + Math.floor(rand() * 75),
    };
    target.ratioV = round2(target.building_volume_m3 / target.parcel_area_m2);

    const thisYear = new Date().getFullYear();
    const minYear = thisYear - years;

    const comparables = [];
    const count = Math.min(limit, 12);
    for (let i = 0; i < count; i++) {
        const parcelArea = Math.round(300 + rand() * 2400);
        const footprint = Math.round(parcelArea * (0.18 + rand() * 0.34));
        const height = Math.round((5 + rand() * 22) * 10) / 10;
        const floors = Math.max(1, Math.round(height / 3.2 + (rand() - 0.5)));
        const volume = Math.round(footprint * height);
        const year = minYear + Math.floor(rand() * (years + 1));
        const ratioV = round2(volume / parcelArea);
        // similarity_score: 1.0 - distance from target across a few axes.
        // The closer the parcel area + ratioV + year, the higher the score.
        const areaDelta = Math.abs(parcelArea - target.parcel_area_m2) / Math.max(target.parcel_area_m2, 1);
        const ratioDelta = Math.abs(ratioV - target.ratioV) / Math.max(target.ratioV, 0.01);
        const yearDelta = Math.abs(year - target.construction_year) / 80;
        const similarity = Math.max(0, 1 - 0.4 * areaDelta - 0.4 * ratioDelta - 0.2 * yearDelta);

        // Scatter comparables in a small ring around the target so the
        // map highlight has somewhere distinct to land per card.
        const angle = rand() * Math.PI * 2;
        const radiusDeg = 0.005 + rand() * 0.04;
        const lat = target.lat + Math.cos(angle) * radiusDeg;
        const lng = target.lng + Math.sin(angle) * radiusDeg;

        comparables.push({
            egrid: `CH${Math.floor(rand() * 1e12).toString().padStart(12, '0')}`,
            municipality: pick(MOCK_MUNICIPALITIES, rand),
            cz_local: zone.local,
            parcel_area_m2: parcelArea,
            building_volume_m3: volume,
            footprint_m2: footprint,
            height_m: height,
            floors,
            construction_year: year,
            ratioV,
            similarity_score: round2(similarity),
            lat,
            lng,
        });
    }

    // Sorted by similarity desc by default so consumers that don't sort
    // still get a sensible order on first paint.
    comparables.sort((a, b) => b.similarity_score - a.similarity_score);

    return {
        target,
        comparables,
        meta: {
            gwr_month: '2026-04',
            total_candidates: comparables.length,
            generated_at: new Date().toISOString(),
            source: 'mock',
        },
    };
}

function round2(n) {
    return Math.round(n * 100) / 100;
}
