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
        version: '0.0.1',
        date: 'May 25, 2026',
        codename: 'Fork',
        summary:
            'similoo forks the hood 3D viewer foundation and rebrands it. The Cesium map, navbar, settings popover, theme toggle, screenshot pipeline, profile/auth, and four-locale i18n (EN/FR/DE/IT) all carry over from hood. Brand identifiers — page title, OG/Twitter tags, localStorage namespace, telemetry app_name, screenshot APP_SOURCE, file prefix — are switched to "similoo" so similoo and hood do not collide on the same browser or in the backend. The comparison engine, sidebar, and similarity-matching backend are still to be built.',
        highlight: true,
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
