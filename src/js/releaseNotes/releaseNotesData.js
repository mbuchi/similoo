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
