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
        version: '0.8.1',
        date: 'June 3, 2026',
        codename: 'Planted',
        summary:
            'Two fixes to the building-detail 3D viewer (the popup that opens from a comparable building). The solid model used to float high above its terrain: the building mesh arrives at absolute elevation (hundreds of metres above sea level) while the terrain point cloud is rebased so its lowest point sits at the origin, so the two never lined up. The viewer now samples the terrain\'s ground-class LiDAR points directly under the footprint and drops the building onto that local ground level, so it sits planted on the terrain in both point-cloud and solid modes. Separately, the point-cloud view now loads a tighter zone — the default radius is halved (≈100 m across instead of ≈200 m) so the scene is focused on the building rather than a wide stretch of neighbourhood.',
        highlight: false,
        items: [
            {
                kind: 'fixed',
                icon: 'move-vertical',
                text: 'The solid 3D model no longer floats above the terrain. The building GLB comes in at absolute LV95 elevation while the terrain cloud is rebased to a zero origin, so the model levitated by the scene\'s base elevation. The viewer now raycasts the terrain\'s ground-class points under the footprint (stepping the sample radius outward to clear ground gaps under dense blocks) and seats the building\'s lowest vertex on that local ground level — fixing both the point-cloud and solid modes.',
                prs: [22],
            },
            {
                kind: 'improved',
                icon: 'scan',
                text: 'The point-cloud view now loads a smaller, tighter zone: the default scene radius is halved (50 m, ≈100 m across) so the visualisation centres on the building instead of pulling in a wide neighbourhood of points.',
                prs: [22],
            },
        ],
    },
    {
        version: '0.8.0',
        date: 'June 3, 2026',
        codename: 'Whole Parcel',
        summary:
            'The red highlight now covers the whole parcel, not just one building. Until now searching an address painted the searched parcel red and lit up only the single building footprint under the search point — but a parcel often holds several buildings, and the others stayed the resting grey. similoo now paints every building inside the searched parcel red. Because the footprint tile carries no parcel id, membership is resolved geometrically: the searched parcel\'s polygon is gathered from the parcel tiles (so a tile-split parcel still counts) and every building whose footprint centroid falls inside it is highlighted. Like the comparable (pink) highlight, this is lazy and sticky — buildings that stream in late or are panned into view light up on the next map settle, and stay lit as you move. A new bottom-left legend explains the colours: red for the searched parcel and its buildings, green for same-zone parcels, pink for comparable buildings.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'building-2',
                text: 'Every building in the searched parcel is now highlighted red, not just the one under the search point. The footprint tile has no parcel column, so membership is resolved geometrically — the parcel polygon is gathered from the rendered parcel tiles by id (tile-split parcels included) and each building whose footprint centroid sits inside it is painted red. Resolution is lazy + sticky (re-checked on every map idle) so late-rendering buildings still light up. Falls back to the single nearest building when no parcel polygon is available.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'list',
                text: 'New on-map legend (bottom-left, suite-standard panel) explaining the highlight colours: red = searched parcel & its buildings, green = same-zone parcels, pink = comparable buildings. Fully localised across EN/FR/DE/IT and re-localises on language change.',
                prs: [],
            },
        ],
    },
    {
        version: '0.7.1',
        date: 'June 2, 2026',
        codename: 'Dark Match',
        summary:
            'A small suite-consistency fix: in dark mode, the landing address-search results now use the theme-aware red tokens for their hover and selected states instead of a hardcoded light-red on dark surfaces, so the highlighted result reads with proper contrast — matching how the rest of the app tints active surfaces in dark mode.',
        highlight: false,
        items: [
            {
                kind: 'fixed',
                icon: 'palette',
                text: 'Landing search results now have a dark-mode hover/selected style (theme-aware --hood-red-soft background and --hood-red text) so the active result no longer renders as low-contrast light-red on the dark card.',
                prs: [],
            },
        ],
    },
    {
        version: '0.7.0',
        date: 'June 1, 2026',
        codename: 'Comparable Glow',
        summary:
            'The comparable buildings now light up on the 3D map, not just their parcels. Until now the map painted the searched parcel red, every same-zone parcel green, and the searched building red — but the comparable buildings themselves stayed the resting grey. They now render pink (the same colour as the mini-cube markers and the sidebar cards), so the matches you see ranked in the panel are immediately findable as actual buildings on the map. A comparable lights up the moment it scrolls into view (pan or fly to one from its card) and stays lit as you move around, while the searched building keeps its red.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'building-2',
                text: 'Comparable buildings are highlighted in pink on the 3D map. Previously only the same-zone parcels were tinted green; now each comparable\'s footprint extrusion is painted pink to match its mini-cube marker and sidebar card, so "similar building" reads as a building, not just a parcel. The searched building stays red and the same-zone parcels stay green underneath.',
                prs: [19],
            },
            {
                kind: 'improved',
                icon: 'eye',
                text: 'The comparable highlight resolves lazily and sticks: a comparable that is off-screen when you search lights up as soon as you pan or fly it into view, and once lit it stays pink while you move around the map (the colour is re-checked every time the map settles). Returning to search or closing the panel clears every comparable highlight.',
                prs: [19],
            },
        ],
    },
    {
        version: '0.6.2',
        date: 'May 31, 2026',
        codename: 'Centralised share card',
        summary:
            'The social-share preview image (Open Graph / Twitter card) now points at the centralized toolbox-hosted canonical image instead of a per-app file, with the correct real pixel dimensions — so link unfurls match the rest of the SwissNovo suite.',
        highlight: false,
        items: [
            {
                kind: 'improved',
                icon: 'image',
                text: 'Social-share preview image now uses the centralized toolbox URL (https://toolbox.swissnovo.com/meta/similoo.jpg) with correct dimensions.',
                prs: [],
            },
        ],
    },
    {
        version: '0.6.1',
        date: 'May 31, 2026',
        codename: 'Polish Pass',
        summary:
            'A low-risk UI/UX polish sweep: brand and accessibility consistency fixes with no behaviour or data-model changes. The page title now uses the suite-standard em-dash; the release-notes panel renders the similoo wordmark (it previously still showed the inherited hood mark); a searched/deep-linked address now opens at street level (zoom 17, the suite convention) so the target building reads cleanly; the comparison panel and the map controls stay perfectly aligned when the sidebar opens (the gutter and the MapLibre control shift now both match the panel\'s 400px width, and the mobile collapse breakpoint lines up at 640px); and the comparison sidebar\'s accessible label re-localises with the rest of the UI when you switch language.',
        highlight: false,
        items: [
            {
                kind: 'fixed',
                icon: 'trash-2',
                text: 'Removed dead Netlify config — Vercel-only. similoo runs entirely on Vercel (vercel.json + the api/ serverless functions, including api/signal-collect.js), so netlify.toml and netlify/functions/signal-collect.js were deleted. Client telemetry already POSTs to /api/signal-collect, so nothing in the app changes.',
                prs: [13],
            },
            {
                kind: 'fixed',
                icon: 'type',
                text: 'Page <title> + meta.title now use the suite-standard em-dash ("similoo — Comparable Buildings Explorer"), matching the FR/DE/IT titles and the rest of the SwissNovo suite.',
                prs: [],
            },
            {
                kind: 'fixed',
                icon: 'tag',
                text: 'Release-notes panel header renders the similoo wordmark (lowercase, red "oo") instead of the inherited "hood" mark left over from the fork.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'zoom-in',
                text: 'Searched and deep-linked addresses now jump to zoom 17 (was 16.5) so the target building is at street level on arrival — the suite-wide deep-link zoom convention.',
                prs: [],
            },
            {
                kind: 'fixed',
                icon: 'layout',
                text: 'Comparison panel alignment: the map gutter and the MapLibre top-right controls now both shift by the panel\'s real 400px width (the gutter was 380px), and the mobile full-width collapse breakpoint matches at 640px. Dead Cesium-era control-shift selectors were removed.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'languages',
                text: 'The comparison sidebar\'s accessible region label (aria-label) now re-localises on language change alongside the rest of its chrome.',
                prs: [],
            },
        ],
    },
    {
        version: '0.6.0',
        date: 'May 29, 2026',
        codename: 'Instant Match',
        summary:
            'Address search now snaps to the result instantly and lights up the comparison the moment the tiles arrive. Picking an address jumps the camera straight there — no fly animation, no waiting — and the highlight is driven directly off the parcel vector tile: the searched parcel goes red, its 3D building goes red, and every parcel sharing the same `cz_local` (the similar building type) goes green. The big fix underneath: the parcel API returns the canonical id under `parcel_id` (already a "CH…" EGRID) and has no `egrid` field, so the old lookup silently fell back to the seeded mock every time — which meant the zone never matched and nothing painted. similoo now reads `parcel_id`, talks to the live `/score/similoo` for the comparables list, and no longer blocks the map highlight on that network call at all.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'zap',
                text: 'Address search switches the view instantly — `jumpTo` replaces the `flyTo` animation so the searched address snaps into place on the next frame with the lowest possible latency.',
                prs: [],
            },
            {
                kind: 'fixed',
                icon: 'crosshair',
                text: 'The searched parcel (red), its 3D building (red), and all same-zone parcels (green) now reliably highlight. The highlight reads `cz_local` + `parcel_id` straight off the parcel tile and applies the instant the tile under the point loads — it no longer waits on (or depends on) the `/score/similoo` response, so it works even before the comparables list arrives.',
                prs: [],
            },
            {
                kind: 'fixed',
                icon: 'key',
                text: 'EGRID resolution fixed: `/res_api/parcel_data` returns the id under `parcel_id` (a real "CH" + 12-char EGRID) with no `egrid` field, so the previous `props.egrid`-only read always returned null and the whole flow degraded to the EGRID-seeded mock. similoo now accepts `parcel_id`, so the comparison sidebar fetches live comparables and the target zone matches the map.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'building-2',
                text: 'The 3D building highlight is more forgiving: when the geocoded point lands just off a footprint (a street entrance, or a big parcel\'s centroid) it widens the probe and lights up the nearest building rather than nothing.',
                prs: [],
            },
        ],
    },
    {
        version: '0.5.0',
        date: 'May 29, 2026',
        codename: 'Zone in Context',
        summary:
            'The map gets its basemap back, and the comparison context is now visible at a glance. We restore the suite-standard satellite imagery (Esri World Imagery, same source the Cesium-based apps load by default) and paint the parcel layer by zoning straight off the vector tile: the searched parcel goes red, every other parcel sharing the target\'s `cz_local` goes green, and everything else fades to a near-transparent white wash so the imagery still reads. The earlier "model space" look intentionally dropped both — that revision left users wondering *why* a given building counted as comparable; surfacing the zone footprint answers that without an extra panel.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'map',
                text: 'Satellite basemap restored — Esri World Imagery, matching project_RES and the other SwissNovo apps. The previous off-white "model space" background is gone.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'palette',
                text: 'Parcel layer painted by `cz_local`: red for the searched parcel, green for every other parcel in the same zone, white wash everywhere else. The expression reads `cz_local` directly off the parcel vector tile so zone neighbours are coloured consistently across the whole dataset, not just the viewport.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'square-stack',
                text: 'Selected parcel id is captured from the parcel tile under the click (promoted `parcel_id`) so the EGRID fallback gets a real value when the network is reachable, while still feeding the LOD 2.5 target highlight on the building extrusion above.',
                prs: [],
            },
        ],
    },
    {
        version: '0.4.0',
        date: 'May 28, 2026',
        codename: 'Address First',
        summary:
            'Full UX rewrite around the address-first comparable-buildings flow. The app now opens on a minimal centred address search (no map clicking — that produced too many false signals). Pick a result and the working surface appears: MapLibre LOD 2.5 cubes on the left (target building painted red, comparable buildings as pink mini-cube markers across Switzerland) and the comparison sidebar on the right with target metrics, filters, and a sortable card list. The base raster and parcel polygons are gone — only the building cubes remain, so the visual reads as a model rather than a map. Clicking a comparable card (or its cube marker on the map) opens a Three.js LAS popup that renders a 100 m slice around the building with a toggle between the raw coloured point cloud (LAS classification colours) and a solid-mesh representation (Roofer building model on a grey terrain extracted from the ground class).',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'search',
                text: 'Address-first landing screen replaces map-click as the only entry point — single centred input with Mapbox-backed autocomplete, restricted to Switzerland. The map is hidden until an address is picked.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'boxes',
                text: 'LOD 2.5 mode for the main map: the Carto Positron raster basemap and parcel polygon layer are removed; only the building extrusions remain. Target building paints red, comparables paint as pink mini-cube DOM markers anchored to each comparable\'s lat/lng so they stay visible at any zoom across Switzerland.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'box',
                text: 'Three.js LAS popup: clicking a comparable card or its on-map cube opens a modal that renders a 100 m LAS slice around the building. Toggle between Point cloud (raw coloured LiDAR) and Solid model (Roofer building mesh on a derived grey terrain) from the modal chrome. Powered by the Contoor 3D API behind a new `/api/three3d` Vercel proxy.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'eye-off',
                text: 'Map click handlers (parcel/building selection) removed — selecting only via address search keeps the signal-collect feed clean of accidental clicks.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'arrow-left',
                text: 'New "Search again" pill in the comparison header restores the landing screen and clears highlights without losing browser history.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'link',
                text: 'Deep link via `?lat=&lng=` (+ optional `&label=`) skips the landing view and restores the comparison surface for the given coordinates — useful for sharing and headless tests.',
                prs: [],
            },
        ],
    },
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
