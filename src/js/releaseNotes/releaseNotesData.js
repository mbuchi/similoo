// Release notes data for similoo.
//
// Newest first. Versioning follows SemVer. The app is pre-1.0 while the
// comparison surface is still being built out. Add new releases at the top.
//
// `prs` are merged pull-request numbers from the source repository so
// each change links back to the diff that shipped it.

export const REPO_URL = 'https://github.com/mbuchi/similoo';

export const KIND_META = {
    new: {
        label: 'New',
        textColor: '#DC2626',
        bgColor: 'rgba(220, 38, 38, 0.08)',
        borderColor: 'rgba(220, 38, 38, 0.3)',
        dotColor: '#DC2626',
    },
    improved: {
        label: 'Improved',
        textColor: '#B45309',
        bgColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        dotColor: '#F59E0B',
    },
    fixed: {
        label: 'Fixed',
        textColor: '#047857',
        bgColor: 'rgba(16, 185, 129, 0.08)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        dotColor: '#10B981',
    },
    docs: {
        label: 'Docs',
        textColor: '#0369A1',
        bgColor: 'rgba(14, 165, 233, 0.08)',
        borderColor: 'rgba(14, 165, 233, 0.3)',
        dotColor: '#0EA5E9',
    },
};

export const RELEASES = [
    {
        version: '0.3.0',
        date: 'May 27, 2026',
        codename: 'Inter Polish',
        summary:
            'Typography refresh for a more professional tech-product look. UI body, headings, and the address search now ride on Inter (variable, OpenType cv11 + ss01 + tabular figures) with `-webkit-font-smoothing: antialiased` for clean rendering on the dark theme. Varela Round is preserved only for the `similoo` wordmark in the navbar — the suite-wide brand identifier with the red `oo`. Code/ID surfaces (parcel IDs, EGRID, camera monitor) switch to JetBrains Mono via a new `--hood-mono` token. Three tokens now drive every font choice in the app: `--hood-font` (Inter, UI), `--hood-display` (Varela Round, wordmark), `--hood-mono` (JetBrains Mono, code).',
        highlight: true,
        items: [
            {
                kind: 'improved',
                icon: 'type',
                text: 'UI body, headings, and search inputs now ride on Inter (variable, OpenType cv11 + ss01 + tabular figures, antialiased) for a more professional tech-grade dark look. Navbar caption switches to an uppercase Inter 500 micro-label.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'badge-check',
                text: 'Brand wordmark untouched: the `similoo` logo stays in Varela Round with the red `oo`, matching SwissNovo suite branding.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'code-2',
                text: 'IDs and code surfaces switch to JetBrains Mono via the new `--hood-mono` token — buildingInfoPanel, comparison cards/EGRID, release-notes version pills, and the camera monitor all share one mono stack.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'sparkles',
                text: 'Crisper rendering on dark mode: grayscale font-smoothing, `text-rendering: optimizeLegibility`, kerning + ligatures + Inter cv11 (single-storey g) + ss01 (open digits) enabled at the html root.',
                prs: [],
            },
        ],
    },
    {
        version: '0.2.1',
        date: 'May 26, 2026',
        codename: 'Quiet Check-In',
        summary:
            'Release-notes button now uses the circle-check icon (matches the rest of the suite).',
        items: [
            {
                kind: 'improved',
                icon: 'package',
                text: 'Bumped @swissnovo/shared to v0.32.0 — release-notes button icon switched from Tag to CheckCircle.',
                prs: [],
            },
        ],
    },
    {
        version: '0.2.0',
        date: 'May 26, 2026',
        codename: 'Featherweight',
        summary:
            'Replace the Cesium 3D foundation inherited from hood with a much lighter MapLibre + fill-extrusion stack. Bundle drops ~75% vs the Cesium build (now ~1.1 MB JS / 304 KB gzipped, was ~3 MB+ gzipped). Vector parcels and 3D building footprints come from the suite\'s shared Martin tilesets (res-mbtiles-x.gisjoe.com / res-mbtiles-footprint-x.gisjoe.com — same sources room uses), so no new infra. Buildings extrude with rf_h_roof_70p − rf_h_ground for a realistic roof line. The comparison sidebar is unchanged on the outside but ports its highlight from Cesium entities to MapLibre Marker pins and feature-state. Carto Positron underlay provides geographic context.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'map',
                text: 'MapLibre GL JS map replaces the Cesium viewer. Default view at Zürich zoom 14 pitch 45°; parcels paint on click, buildings extrude from the LOD 2.2 roof model.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'gauge',
                text: 'Cold bundle dropped from ~3 MB gzipped (Cesium) to 304 KB gzipped (MapLibre + Three deferred) — ~10× faster first paint, no terrain tile cost.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'mouse-pointer',
                text: 'Parcel click → /api/parcel resolves EGRID → comparison sidebar opens with target metrics, filters, and ranked comparables list. Mock fallback kicks in offline and in dev so the demo flow never breaks.',
                prs: [],
            },
        ],
    },
    {
        version: '0.1.1',
        date: 'May 25, 2026',
        codename: 'Proxy Pass',
        summary:
            'Wire the real /score/similoo backend behind same-origin Vercel proxies so the UI talks to live RES data instead of always falling back to the EGRID-seeded mock. Two new Node serverless functions — api/similoo.ts and api/parcel.ts — attach the RES API token server-side and forward to /score/similoo and /res_api/parcel_data respectively (mirroring the scoore /api/overpass pattern). The client API surface no longer ships any token. Suite convention is the custom `token:` header on /score/* and /res_api/*; the previous Authorization: Bearer attempt would have hit 401 on both routes and always degraded to mock.',
        highlight: true,
        items: [
            {
                kind: 'fixed',
                icon: 'shield-check',
                text: 'New api/similoo.ts and api/parcel.ts Vercel proxies that send the RES API token via the suite-standard `token:` header (matching scoore/api/overpass). src/js/api/similoo.js and src/js/comparison/parcelLookup.js now POST same-origin to /api/similoo and /api/parcel — no client-side token, no Bearer header mismatch, no CORS surface.',
                prs: [],
            },
        ],
    },
    {
        version: '0.1.0',
        date: 'May 25, 2026',
        codename: 'First Compare',
        summary:
            'similoo gets its headline surface: a right-edge "Comparable Buildings" sidebar that opens when you pick a building on the 3D map. Top section shows the target parcel\'s headline metrics — municipality, zoning, EGRID, parcel size, volume, footprint, height, floors, year, and the big ratioV number. Middle section filters by year window (1–30, default 10) and parcel-size range. Bottom is a sortable card list (similarity / ratioV / size / year) where each card visualises ratioV with a horizontal data-bar; clicking flies the camera to that comparable, hovering drops a highlight pin on the map. Backed by a new `fetchSimilooComparables(egrid)` client that calls `<RES>/score/similoo` when live and falls back to a deterministic mock seeded by the EGRID hash so the demo flow works before the backend ships. All visible strings translated across EN/FR/DE/IT.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'columns-3',
                text: 'Right-edge "Comparable Buildings" sidebar with target metrics, year + parcel-size filters, sortable card list and in-card ratioV data bar.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'plug-zap',
                text: 'fetchSimilooComparables(egrid) calls POST <RES_BASE>/score/similoo with auth; falls back to deterministic EGRID-seeded mock on 404/network error so the UI ships ahead of the backend.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'map-pin',
                text: 'Card hover drops a red pin entity on the comparable\'s coordinates; click flies the main Cesium camera there with a 1.2s tween.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'languages',
                text: 'Full EN/FR/DE/IT translations for the new comparison.* keys (panel chrome, metric labels, filters, sort options, status messages).',
                prs: [],
            },
        ],
    },
    {
        version: '0.0.1',
        date: 'May 25, 2026',
        codename: 'Fork',
        summary:
            'similoo forks the hood 3D viewer foundation and rebrands it. The Cesium map, navbar, settings popover, theme toggle, screenshot pipeline, profile/auth, and four-locale i18n (EN/FR/DE/IT) all carry over from hood. Brand identifiers — page title, OG/Twitter tags, localStorage namespace, telemetry app_name, screenshot APP_SOURCE, file prefix — are switched to "similoo" so similoo and hood do not collide on the same browser or in the backend. The comparison engine, sidebar, and similarity-matching backend are still to be built.',
        highlight: false,
        items: [
            {
                kind: 'new',
                icon: 'git-fork',
                text: 'Forked from mbuchi/hood @ 05f85e9. Identical 3D viewer surface; new repo, new identity. Vercel project: swissnovo-similoo.',
                prs: [],
            },
        ],
    },
];

export const CURRENT_VERSION = RELEASES[0].version;
