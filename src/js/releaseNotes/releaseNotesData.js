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
    version: '0.13.11',
    date: 'July 4, 2026',
    codename: 'Closer to Home',
    summary:
      'Comparable buildings now stay in the searched building\'s municipality. The /score/similoo service restricts candidates to the target parcel\'s municipality in addition to the same planning zone (cz_local), and the app copy has been updated to match: previously, because zone labels repeat nationwide, results could come from anywhere in Switzerland.',
    items: [
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'Comparables are now restricted to the searched building\'s municipality in addition to the same planning zone (cz_local). Before this server-side fix, identical zone labels in other cantons let results surface from all over Switzerland.',
        prs: [],
      },
      {
        kind: 'docs',
        icon: 'file-text',
        text: 'Updated the landing page, About dialog, page metadata and the "How comparables are calculated" help across all four languages: the geographic scope now reads "same municipality and zone" instead of "across Switzerland".',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.10',
    date: 'July 1, 2026',
    codename: 'Spelling, Americanized',
    summary:
      'US English spelling across the UI. Tidied up the interface copy so every visible label, help text and release note uses American spelling (color, center, meter, behavior, and so on) consistently across the suite. Wording and behavior are unchanged - this is a cosmetic copy pass only.',
    items: [
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'Converted British spellings to US English in all English-facing copy (page metadata, the on-map legend and help dialog, and the release notes themselves): colour to color, centre to center, metre to meter, visualise to visualize, behaviour to behavior, and similar. The French, German and Italian translations are untouched.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.9',
    date: 'June 30, 2026',
    codename: 'Deploy Restored',
    summary:
      'Restored production deploys. similoo pulls the shared @aireon/shared library over an authenticated SSH connection at build time, but its Vercel project was missing the deploy-key setup, so the two most recent builds failed on "npm install" and the live site stayed on the June 28 version. The deploy key is now wired up, so the build installs the shared library and ships again.',
    items: [
      {
        kind: 'fixed',
        icon: 'wrench',
        text: 'Fixed the Vercel build failing with "npm install exited 128 / Permission denied (publickey)" while fetching the private @aireon/shared package over SSH. Wired the install-time deploy-key step into vercel.json (installCommand now runs scripts/setup-aireon-shared-ssh.sh before npm install, matching the rest of the suite) and provisioned the AIREON_SHARED_DEPLOY_KEY environment variable on the Vercel project, so the shared library clones cleanly and production deploys land again.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.8',
    date: 'June 28, 2026',
    codename: 'Shared launch zoom',
    summary: 'The map now uses the shared Aireon default zoom when no zoom is provided in the link.',
    items: [
      {
        kind: 'improved',
        text: 'Opening the map without a ?zoom= value now starts from the shared @aireon/shared map default: zoom 18. Links with an explicit ?zoom= value still keep that zoom.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.7',
    date: 'June 28, 2026',
    codename: 'React Compiler Shell',
    summary:
      'similoo now builds its React shell with React Compiler, helping the suite chrome avoid unnecessary rerenders while the MapLibre and Three.js engine stays unchanged.',
    items: [
      {
        kind: 'improved',
        icon: 'zap',
        text: 'Enabled React Compiler for the React-mounted navbar, access gate, release notes and shared chrome, using the React 18 runtime target. The map, comparison sidebar and 3D scene remain the same imperative engine.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.6',
    date: 'June 25, 2026',
    codename: 'Easy on Phones',
    summary:
      'Mobile readability and touch pass: the small labels in the comparison panel, the on-map legend and the release-notes timeline are now at least 12px, and the compact controls (close button, sort dropdown, year slider and the comparable map markers) have larger tap areas so they are easier to hit on a phone - without looking any bigger.',
    items: [
      {
        kind: 'improved',
        icon: 'smartphone',
        text: 'Bumped every sub-12px label up to at least 12px - the comparison sidebar (target metrics, filters, card footers and meta), the on-map legend title and the release-notes tags now stay readable on small screens.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'hand',
        text: 'Enlarged the tap targets on the compact controls to a comfortable touch size: the comparison close button, the sort dropdown, the year-range slider and the comparable-building map markers now have a 44px hit area while their visible size is unchanged.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.5',
    date: 'June 23, 2026',
    codename: 'Skeleton on open',
    summary:
      'The app now opens with a skeleton placeholder of its layout instead of a loading spinner.',
    items: [
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'When similoo opens, it now shows a skeleton of its layout while it loads - instead of a spinner - so the page is visible right away and the wait feels shorter. The skeleton follows your theme.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.4',
    date: 'June 22, 2026',
    codename: 'Shared v1.64.0',
    summary:
      'Updated the shared Aireon library to v1.64.0, which swaps the long em-dashes in the suite-shared interface text for plain hyphens - so the controls similoo borrows from the suite now read with the same punctuation as the rest of the app.',
    items: [
      {
        kind: 'improved',
        icon: 'package',
        text: 'Bumped @aireon/shared to v1.64.0: the shared UI strings (the navbar, account menu and other suite-shared chrome) now use plain hyphens instead of em-dashes, matching similoo\'s own copy.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.3',
    date: 'June 22, 2026',
    codename: 'Hyphens, not em-dashes',
    summary:
      'Tidied the wording across the app so every dash is a plain hyphen - the page title, social-share text, landing copy, methodology help and comparison panel now read consistently with the rest of the suite.',
    items: [
      {
        kind: 'improved',
        icon: 'type',
        text: 'Replaced the long em-dash with a plain hyphen everywhere it showed in the interface - meta and social-share text, the landing subtitle, the About and methodology descriptions, the demo zone labels and the empty-value placeholders in the comparison sidebar - so the punctuation matches the rest of the Aireon suite.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.2',
    date: 'June 22, 2026',
    codename: 'Skeletons, not spinners',
    summary:
      'Comparable buildings now load with skeleton placeholders instead of a bare "Loading…" line - the panel shows the shape of the results while they fetch, so the layout no longer jumps when they arrive.',
    items: [
      {
        kind: 'improved',
        icon: 'layers',
        text: 'While comparables load, the target metrics block and the result cards now render as skeleton placeholders shaped like the real content (the suite standard - never a spinner), in both light and dark themes. They clear cleanly when results arrive, are empty, or error out.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.1',
    date: 'June 22, 2026',
    codename: 'Open Sesame',
    summary:
      'Added an "Open with" menu in the navbar - open the current location in another Aireon app with one click.',
    items: [
      {
        kind: 'new',
        icon: 'external-link',
        text: 'Added an "Open with" menu in the navbar - open the current location in another Aireon app with one click.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.0',
    date: 'June 21, 2026',
    codename: 'The Full Height',
    summary:
      'Comparable cards now show each building’s height and number of floors next to parcel size and volume - so you can size up a match at a glance, not just by area and volume.',
    items: [
      {
        kind: 'improved',
        icon: 'ruler',
        text: 'Comparable cards now show building height and floor count alongside parcel size and volume.',
        prs: [],
      },
    ],
  },
  {
    version: '0.12.2',
    date: 'June 21, 2026',
    codename: 'Access, Honored',
    summary:
      'similoo now respects the access level and launch status set for it in the hub’s App Manager: member-only asks you to sign in, admin-only or under construction shows a short notice. Public apps - the default - are unaffected.',
    items: [
      {
        kind: 'improved',
        icon: 'shield',
        text: 'similoo now respects the access level and launch status set for it in the hub’s App Manager: member-only asks you to sign in, admin-only or under construction shows a short notice. Public apps - the default - are unaffected.',
        prs: [],
      },
    ],
  },
  {
    version: '0.12.1',
    date: 'June 21, 2026',
    codename: 'One Search Bar',
    summary:
      'Searching now works the same way as valoo. The standard Aireon address search lives in the top navbar: it shows the address you looked up and lets you jump straight to another one - so the separate in-map “Search again” strip is gone.',
    items: [
      {
        kind: 'improved',
        icon: 'search',
        text: 'Moved address search into the navbar, the suite-standard place for it. The parcel you are comparing now shows as the search text, and you can look up a new address right there - no stepping back to the landing screen first.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'layout',
        text: 'Removed the separate “Search again” bar that sat above the comparison map. The 3D map now fills the full height beneath the navbar.',
        prs: [],
      },
    ],
  },
  {
    version: '0.12.0',
    date: 'June 21, 2026',
    codename: 'Suite Parity',
    summary:
      'similoo now wears the standard Aireon map-first design - the shared navbar and account menu, the glass zoom control, Liquid Glass and the suite slate theme used across valoo, roofs and contoor.',
    items: [
      {
        kind: 'improved',
        icon: 'layout',
        text: 'Rebuilt the top bar on the shared Aireon navbar. The old cluttered icon row is now one tidy account menu - Share this view, dark/light, What’s new, About and Report a problem - beside the language and appearance controls, identical to the rest of the suite.',
        prs: [],
      },
      {
        kind: 'new',
        icon: 'plus',
        text: 'Added the suite glass zoom control (zoom in, zoom out, reset bearing to north) at the bottom-right of the map, replacing the default zoom buttons.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'palette',
        text: 'Retuned dark mode to the suite slate palette and moved the interface onto Tailwind, so every surface matches the other Aireon apps.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'sparkles',
        text: 'What’s new and About now use the shared suite panels, and the bug-report form moved into the account menu (“Report a problem”).',
        prs: [],
      },
    ],
  },
  {
    version: '0.11.4',
    date: 'June 20, 2026',
    codename: 'Theme Follows You',
    summary:
      'Your light/dark choice now carries across every Aireon app - and across your devices when signed in.',
    items: [
      {
        kind: 'improved',
        icon: 'palette',
        text: 'Your light/dark choice now carries across every Aireon app - and across your devices when signed in.',
        prs: [],
      },
    ],
  },
  {
    version: '0.11.3',
    date: 'June 18, 2026',
    codename: 'Official Address Search',
    summary:
      'Landing-page address autocomplete now uses the shared geo.admin.ch provider instead of the Mapbox token path.',
    items: [
      {
        kind: 'improved',
        icon: 'globe',
        text: 'Replaced the local Mapbox forward-geocoder with the shared @aireon/shared geo.admin.ch helper. The landing search keeps the same keyboard and click workflow, but address results are now tokenless, Swiss-official and cached through the shared provider.',
        prs: [],
      },
    ],
  },
  {
    version: '0.11.2',
    date: 'June 18, 2026',
    codename: 'Lean Entry',
    summary:
      'Faster first load - the heavy map and 3D libraries (MapLibre and Three.js) are now code-split into their own bundles so the app shell loads and renders before the big chunks finish downloading.',
    items: [
      {
        kind: 'improved',
        icon: 'zap',
        text: 'Performance: code-split the heavy MapLibre and Three.js libraries out of the entry bundle into separate chunks, shrinking the eager bundle the browser has to parse before the UI appears.',
        prs: [],
      },
    ],
  },
  {
    version: '0.11.1',
    date: 'June 18, 2026',
    codename: 'Share This View',
    summary:
      'Added a "Share this view" button to the navbar - copies the current URL to the clipboard and confirms with a "Link copied to clipboard" pill.',
    items: [
      {
        kind: 'new',
        icon: 'share-2',
        text: 'Added a "Share this view" button to the navbar - it copies a link to the current view and confirms with a "Link copied to clipboard" pill.',
        prs: [],
      },
    ],
  },
  {
    version: '0.11.0',
    date: 'June 18, 2026',
    codename: 'Liquid Glass',
    summary:
      'New “Glass effect” appearance setting (Off · Frosted · Liquid) under the navbar settings gear - translucent, frosted comparison panel, building modal and on-map legend that float over the map. Your choice syncs across every Aireon app.',
    items: [
      {
        kind: 'new',
        icon: 'sparkles',
        text: 'Added a Glass effect appearance picker (Off · Frosted · Liquid) under the navbar settings gear. Frosted and Liquid give the comparison panel, the building detail view, the methodology panel and the on-map legend a translucent, blurred glass look over the map; Off keeps the original solid surfaces.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'settings',
        text: 'Your Glass effect choice is remembered and shared across all Aireon apps, and adapts automatically to light and dark themes.',
        prs: [],
      },
    ],
  },
  {
    version: '0.10.4',
    date: 'June 18, 2026',
    codename: 'Suite Parity',
    summary:
      'Updated to the latest shared library (v1.36.2) for exact navbar parity across the Aireon suite.',
    items: [
      {
        kind: 'improved',
        icon: 'package',
        text: 'Updated @aireon/shared to v1.36.2 - the latest shared navbar tokens and opaque navbar background, keeping similoo visually identical to the rest of the Aireon suite.',
        prs: [],
      },
    ],
  },
  {
    version: '0.10.3',
    date: 'June 17, 2026',
    codename: 'Canonical Navbar',
    summary:
      'The top-bar controls now match the rest of the Aireon suite exactly - monochrome icons with no colored fills or rings. The help, theme-toggle, language and "⋯" overflow buttons dropped their filled gray backgrounds and blue focus rings for the canonical transparent, muted-gray look with a neutral focus ring, and the address search now focuses red like every other Aireon app.',
    highlight: true,
    items: [
      {
        kind: 'improved',
        icon: 'search',
        text: 'SEO: add canonical URL + JSON-LD structured data (WebApplication/SoftwareApplication) to the page head.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'palette',
        text: 'Navbar icon buttons (.nav-action-button / .theme-toggle-button / .locale-select / .nav-overflow-toggle) now render the canonical @aireon/shared .aireon-navbtn look - transparent at rest, muted gray (--hood-muted) brightening to --hood-ink on hover, 36px, with a neutral ink focus ring - instead of the previous filled --hood-surface-3 background and blue (--hood-blue-ring) focus ring.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'search',
        text: 'The address-search field focuses red (red-400 border + red-500/25 ring) instead of blue, and the search icon no longer turns blue on focus - matching the suite AddressSearch styling.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'ruler',
        text: 'Corrected the navbar height token (--navbar-h) and the #mapContainer top offset from 60/70px to the canonical 56px so the map sits flush under the bar.',
        prs: [],
      },
    ],
  },
  {
    version: '0.10.2',
    date: 'June 16, 2026',
    codename: 'Panel Stacking',
    summary:
      'Right-hand panels now sit flush under the navbar with the account menu always layered on top, and the shared AppNavbar background was made fully opaque so the bar color is identical across the suite in any theme.',
    items: [
      {
        kind: 'fixed',
        icon: 'layers',
        text: 'Flushed the comparison/detail panel under the navbar and fixed the account-menu stacking order; bumped @aireon/shared to v1.32.0 for the opaque AppNavbar background.',
        prs: [45],
      },
    ],
  },
  {
    version: '0.10.1',
    date: 'June 14, 2026',
    codename: 'Shared Navbar',
    summary:
      'similoo now uses the suite-shared AppNavbar from @aireon/shared for its top bar, so the hub badge and the simil/red-oo wordmark are rendered by the same component every Aireon app shares. The interface is otherwise unchanged: the app keeps all of its own navbar controls (help, theme toggle, language selector, release notes and the sign-in / profile menu) - they were simply relocated into the shared bar with their behavior intact.',
    items: [
      {
        kind: 'improved',
        icon: 'layout',
        text: 'Adopted the suite-shared AppNavbar for the top bar. The shared component supplies the Aireon hub badge, the simil/red-oo wordmark and the bar shell, while similoo’s existing help, theme, language, release-notes and account controls are carried into its slots unchanged - so the imperative engine keeps wiring them exactly as before. Bumped @aireon/shared to v1.19.1.',
        prs: [],
      },
    ],
  },
  {
    version: '0.10.0',
    date: 'June 13, 2026',
    codename: 'React Shell',
    summary:
      'similoo is now a React 18 + TypeScript + Vite app, aligning it with the rest of the Aireon suite. The whole interface is visually and functionally unchanged - the MapLibre map, the Three.js building viewer, the comparable-buildings sidebar, the address search, the help and release-notes panels and the deep-linking all behave exactly as before. Only the app shell was rebuilt: the imperative engine was preserved verbatim and is now mounted by a thin React layer.',
    items: [
      {
        kind: 'improved',
        icon: 'atom',
        text: 'Rewrote similoo from a vanilla-JS Vite app to React 18 + TypeScript. The top bar, landing view and comparison surface are now React components (same markup, ids and CSS, so they render byte-for-byte identically), and a single useEffect boots the existing engine against them.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'box',
        text: 'Preserved the MapLibre viewer (zone painting, building extrusion highlights, parcel/feature-state logic) and the Three.js LOD-2.5 building scene + 3D detail modal exactly as they were - no 3D or map math was reimplemented. The comparison sidebar, comparable markers, map legend, methodology help, release notes, address geocoding, bug report and cross-app SSO auth are all the same modules as before.',
        prs: [],
      },
      {
        kind: 'docs',
        icon: 'package',
        text: 'Adopted the suite-standard React/Vite toolchain (@vitejs/plugin-react, TypeScript, react/react-dom 18) and bumped @aireon/shared to v1.18.2.',
        prs: [],
      },
    ],
  },

  {
    version: '0.9.13',
    date: 'June 13, 2026',
    codename: 'Dead Weight',
    summary:
      'Removed the unused Cesium-era code that was left behind after the move to the MapLibre + Three.js viewer. No user-facing behavior changes - just a leaner, cleaner codebase.',
    items: [
      {
        kind: 'fixed',
        icon: 'trash-2',
        text: 'Deleted ~5,000 lines of dead Cesium-era source (35 unreachable JS modules under src/js/controls, src/js/screenshots, the old viewer providers/basemap/shadow/picker/camera helpers, plus their two orphaned stylesheets) that were never imported by the live entry graph and so were already tree-shaken out of the shipped bundle. This also clears a stale swissnovo-showroom.vercel.app URL and the obsolete Cesium navigation/geocoder CSS overrides. The build output is byte-for-byte equivalent; this is purely housekeeping.',
        prs: [],
      },
    ],
  },

  {
    version: '0.9.12',
    date: 'June 13, 2026',
    codename: 'Cached Footprints',
    summary:
      'Building footprints are now cached in the browser, so panning back to an area you have already viewed no longer re-queries the 3D API.',
    items: [
      {
        kind: 'improved',
        icon: 'database',
        text: 'The building-footprint lookup that drives the 3D detail viewer is now cached client-side (localStorage, keyed by rounded coordinates + radius, 7-day TTL) - the same as the per-building height/volume metrics already were. Panning or zooming back to an area you have already opened reuses the cached footprints instead of re-hitting the Contoor 3D API, so it responds instantly and the upstream load drops. Only non-empty results are cached so a transient miss never gets pinned, and the cache degrades silently to a plain network fetch in private-browsing or quota-limited contexts.',
        prs: [],
      },
    ],
  },

  {
    version: '0.9.11',
    date: 'June 13, 2026',
    codename: 'Accessible Detail View',
    summary:
      'Pinch-zoom is back, this release-notes panel is now reachable, and the 3D detail popup manages keyboard focus.',
    items: [
      {
        kind: 'fixed',
        icon: 'accessibility',
        text: 'Removed the viewport lock that disabled pinch-zoom, so low-vision users can magnify the map, sidebar metrics and modals again.',
        prs: [],
      },
      {
        kind: 'new',
        icon: 'tag',
        text: 'Wired up the version badge next to the wordmark - clicking it opens this release-notes timeline. It was being maintained every release but had no entry point.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'keyboard',
        text: 'The 3D building-detail popup now moves focus to its close button on open and restores focus when it closes, and exposes its title to screen readers via aria-labelledby.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'package',
        text: 'Pinned the Lucide icon library to a fixed version and deferred it, so an upstream change can no longer break icons in production or block first paint.',
        prs: [],
      },
    ],
  },

  {
    version: '0.9.10',
    date: 'June 12, 2026',
    codename: 'Theme-Aware Hub Mark',
    summary:
      'The top-left Aireon hub shortcut now renders as a transparent monochrome mark that follows light and dark themes.',
    items: [
      {
        kind: 'improved',
        icon: 'sparkles',
        text: 'Updated the top-left Aireon hub shortcut to use the hub-hosted transparent Aireon mark. It renders black on light themes and white on dark themes, while the browser favicon stays red on white.',
        prs: [],
      },
    ],
  },


    {
        version: '0.9.9',
        date: 'June 12, 2026',
        codename: 'Bug Report Button',
        summary:
            'A small bug icon now lets users report bugs or feedback without leaving similoo.',
        items: [
            {
                kind: 'improved',
                icon: 'sparkles',
                text: 'Added the standard top-left Aireon hub icon to the navbar, using the canonical favicon from hub.aireon.ch.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'bug',
                text: 'Added a compact bug-report button with a modal form for bugs and feedback. Submissions go through the suite errorlog proxy with page URL, browser context and optional email, while leaving empty numeric fields out of the payload.',
                prs: [],
            },
        ],
    },

    {
        version: '0.9.8',
        date: 'June 11, 2026',
        codename: 'Shared Avatar Picker',
        summary:
            'The account menu now comes from shared Aireon auth, with the same avatar picker used across the suite.',
        items: [
            {
                kind: 'improved',
                icon: 'user',
                text: 'Removed similoo’s copied auth/profile files and switched the app to @aireon/shared/cesium-app/auth. The profile avatar picker is now the shared three-row horizontal rail, selection updates the header immediately, saves without pressing the profile Save button and shows the compact "Avatar updated" confirmation pill.',
                prs: [],
            },
        ],
    },

    {
        version: '0.9.7',
        date: 'June 10, 2026',
        codename: 'Tidy Top Bar',
        summary:
            'On phones the secondary navbar controls now collapse behind a ⋯ menu so nothing is clipped off-screen.',
        items: [
            {
                kind: 'fixed',
                icon: 'menu',
                text: 'Below 768px the help, theme, language and sign-in controls collapse into a ⋯ "More" dropdown anchored to the navbar, instead of overflowing off the right edge where the language selector and sign-in button became unreachable. The menu opens on tap, closes on outside-click, Escape (returning focus to the ⋯ button) or after a selection. Desktop is unchanged.',
                prs: [],
            },
        ],
    },
    {
        version: '0.9.6',
        date: 'June 10, 2026',
        codename: 'Dynamic Viewport',
        summary:
            'Full-height surfaces now respect the mobile browser chrome so nothing hides off-screen.',
        items: [
            {
                kind: 'fixed',
                icon: 'smartphone',
                text: 'Switched the map, help modal, sidebar dropdown and account dialog from static 100vh to dynamic-viewport (100dvh) sizing, keeping 100vh as a fallback. On phones the bottom map scale control and the last rows of tall panels no longer sit behind the dynamic URL bar.',
                prs: [],
            },
        ],
    },
    {
        version: '0.9.5',
        date: 'June 9, 2026',
        codename: 'Aligned Meta',
        summary:
            'The page metadata now uses the same description shown on the Aireon hub card.',
        items: [
            {
                kind: 'improved',
                icon: 'sparkles',
                text: 'Updated the HTML meta, Open Graph and Twitter descriptions to match the Aireon hub card copy: "Find comparable buildings and check their metrics.".',
                prs: [],
            },
        ],
    },
{
        version: '0.9.4',
        date: 'June 6, 2026',
        codename: 'Sign In, Wired',
        summary:
            'similoo now has a working sign-in button and participates in suite-wide single sign-on.',
        highlight: false,
        items: [
            {
                kind: 'fixed',
                icon: 'log-in',
                text: 'similoo had the account UI components but never actually initialized them - the navbar sign-in button was missing and similoo could not pick up your Aireon session. Auth is now wired up (setupAuth on load), so the sign-in / profile control appears and similoo joins cross-app single sign-on: signed in to any Aireon app, similoo signs you in automatically (a brief, UI-less prompt=none check). Anonymous visitors are unaffected.',
                prs: [],
            },
        ],
    },
    {
        version: '0.9.3',
        date: 'June 5, 2026',
        codename: 'One Sign-In',
        summary:
            'Sign in to any Aireon app once and similoo signs you in automatically - suite-wide single sign-on.',
        highlight: false,
        items: [
            {
                kind: 'improved',
                icon: 'shield',
                text: 'Cross-app single sign-on now works: if you are signed in to any Aireon app in this browser, similoo signs you in automatically on load via a brief, UI-less prompt=none check with the login service - no second password, and anonymous visitors are never sent to a login screen. The auth manager was also realigned with the shared @aireon/shared Cesium auth so it stays in lockstep with the rest of the suite.',
                prs: [],
            },
        ],
    },
    {
        version: '0.9.2',
        date: 'June 4, 2026',
        codename: 'Blob Cache',
        summary:
            'Re-opening a parcel’s 3D detail view is now instant: the heavy terrain and building meshes are cached in the browser.',
        highlight: false,
        items: [
            {
                kind: 'improved',
                icon: 'database',
                text: 'Added a client-side IndexedDB blob cache (byte-budget LRU + 14-day TTL, ~150 MB cap) for the heavy 3D terrain/building GLB meshes streamed from the Contoor 3D API. Re-opening the same parcel - or a comparable that snaps to the same footprint - now serves the meshes from the browser instead of regenerating them upstream, so the detail viewer loads instantly and the 3D API load drops. The cache degrades silently to a plain network fetch in private-browsing or quota-limited contexts, and only genuine GLB binaries are stored so a transient upstream hiccup never poisons a coordinate.',
                prs: [],
            },
        ],
    },
    {
        version: '0.9.1',
        date: 'June 3, 2026',
        codename: 'Hyphen Title',
        summary:
            'Browser tab title now uses a plain hyphen separator instead of an em dash.',
        highlight: false,
        items: [
            {
                kind: 'fixed',
                icon: 'type',
                text: 'Browser tab title now uses a plain hyphen separator instead of an em dash.',
                prs: [],
            },
        ],
    },
    {
        version: '0.9.0',
        date: 'June 3, 2026',
        codename: 'One Scene',
        summary:
            'The building-detail 3D viewer is now a single scene instead of two separate "Point cloud" and "Solid model" tabs. The solid terrain is always shown as the ground base, and three independent toggles let you mix exactly what you want on top of it: the raw colored LAS point cloud, the 3D building model, and - new - an aerial Basemap that drapes a swisstopo SWISSIMAGE orthophoto over the terrain so the ground reads as the real place rather than a gray surface. Previously you had to switch tabs and could never see, say, the point cloud and the solid building together; now every combination is one click away in the same view, and the camera/zoom stay put as you toggle.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'layers',
                text: 'Point cloud, Buildings, and Basemap are now three independent toggles in one scene - flip any of them on or off without leaving the view or losing your camera angle. Replaces the old two-tab "Point cloud / Solid model" switch, which forced an either/or choice and always re-showed the building in both tabs.',
                prs: [27],
            },
            {
                kind: 'new',
                icon: 'map',
                text: 'New "Aerial map" toggle drapes a swisstopo SWISSIMAGE orthophoto onto the terrain mesh, so the ground shows the real surroundings (roads, vegetation, neighboring plots) instead of a flat gray surface. The photo is fetched for the exact terrain footprint and aligned pixel-for-pixel; it falls back to the gray terrain if the imagery is unavailable.',
                prs: [27],
            },
            {
                kind: 'improved',
                icon: 'mountain',
                text: 'The terrain is now always visualized as the solid ground base, so the building always has a surface to sit on no matter which overlays you have enabled.',
                prs: [27],
            },
        ],
    },
    {
        version: '0.8.3',
        date: 'June 3, 2026',
        codename: 'Fresh Key',
        summary:
            'Completes the v0.8.2 point-cloud "502" fix. The 3D upstream caches each GLB under an exact, full-precision coordinate key, and a bug makes it return a 500 (surfaced as a 502) on any cache HIT - i.e. the second and later times the same building is viewed. v0.8.2 retried with a few fixed coordinate nudges, but once used those fixed nudges get cached and poisoned too, so a repeatedly-viewed building kept failing. The retry now randomizes the upstream cache key on every attempt - for the point cloud it nudges the request radius by a sub-centimeter random amount (keeping the center exactly where you clicked), so every retry is a key the cache has never seen and regenerates cleanly. Verified against the live origin: a previously-failing coordinate now recovers on the first retry.',
        highlight: false,
        items: [
            {
                kind: 'fixed',
                icon: 'refresh-cw',
                text: 'Point cloud now recovers reliably from the upstream cache-hit 500/502, including on repeat views of the same building. The proxy retry randomizes the upstream cache key each attempt (a sub-centimeter random radius nudge for terrain - center stays exact - or a sub-meter lat/lng jitter for the building model) so it always lands on a fresh, never-poisoned cache entry instead of re-hitting the same broken one. Replaces v0.8.2\'s fixed nudges, which became poisoned after first use.',
                prs: [26],
            },
        ],
    },
    {
        version: '0.8.2',
        date: 'June 3, 2026',
        codename: 'No Bad Gateway',
        summary:
            'Fixes the two errors that broke the building-detail 3D viewer when opening a comparable. First, the point cloud sometimes failed with a "502 Bad Gateway": the 3D upstream is fronted by a tunnel that intermittently returns a gateway error even though the origin serves the request fine moments later. The proxy already retried the upstream\'s known cache-read bug, but it surfaced these gateway errors immediately - it now retries any transient upstream 5xx (with a sub-meter coordinate jitter that also dodges the cache bug), so the point cloud loads reliably. Second, the solid model often failed with "No features returned from WFS": a comparable\'s coordinate can land a few meters off its building footprint, so the upstream\'s exact-point lookup missed. The viewer now snaps to the nearest real footprint before loading and recenters the whole scene there, so the building resolves and sits on its own terrain. If no footprint is nearby it falls back gracefully to a terrain-only view.',
        highlight: false,
        items: [
            {
                kind: 'fixed',
                icon: 'plug-zap',
                text: 'Point cloud no longer fails with "502 Bad Gateway". The Vercel proxy now retries any transient upstream 5xx (the intermittent Cloudflare/tunnel 502 in front of the 3D origin, as well as the origin\'s cache-read bug) using a sub-meter lat/lng jitter that both re-rolls the flaky edge and changes the upstream cache key. The origin answers fresh requests reliably, so the point cloud loads on retry instead of erroring out.',
                prs: [25],
            },
            {
                kind: 'fixed',
                icon: 'crosshair',
                text: 'Solid model no longer fails with "No features returned from WFS". A comparable\'s coordinate can sit a few meters outside its footprint polygon, so the upstream\'s exact-point INTERSECTS lookup found nothing. The viewer now snaps to the nearest building footprint (its GWR reference point, reliably inside the polygon) and recenters the whole scene on it, so the terrain slice and the building stay co-located and the model resolves. Falls back to the raw coordinate (terrain only) when no footprint is nearby.',
                prs: [25],
            },
        ],
    },
    {
        version: '0.8.1',
        date: 'June 3, 2026',
        codename: 'Planted',
        summary:
            'Two fixes to the building-detail 3D viewer (the popup that opens from a comparable building). The solid model used to float high above its terrain: the building mesh arrives at absolute elevation (hundreds of meters above sea level) while the terrain point cloud is rebased so its lowest point sits at the origin, so the two never lined up. The viewer now samples the terrain\'s ground-class LiDAR points directly under the footprint and drops the building onto that local ground level, so it sits planted on the terrain in both point-cloud and solid modes. Separately, the point-cloud view now loads a much tighter zone - the default radius is cut to a quarter of the original (25 m, ≈50 m across instead of ≈200 m) so the scene is focused tightly on the building rather than a wide stretch of neighborhood.',
        highlight: false,
        items: [
            {
                kind: 'fixed',
                icon: 'move-vertical',
                text: 'The solid 3D model no longer floats above the terrain. The building GLB comes in at absolute LV95 elevation while the terrain cloud is rebased to a zero origin, so the model levitated by the scene\'s base elevation. The viewer now raycasts the terrain\'s ground-class points under the footprint (stepping the sample radius outward to clear ground gaps under dense blocks) and seats the building\'s lowest vertex on that local ground level - fixing both the point-cloud and solid modes.',
                prs: [22],
            },
            {
                kind: 'improved',
                icon: 'scan',
                text: 'The point-cloud view now loads a much smaller, tighter zone: the default scene radius is cut to 25 m (≈50 m across - a quarter of the original 100 m radius) so the visualization centers tightly on the building instead of pulling in a wide neighborhood of points.',
                prs: [22],
            },
        ],
    },
    {
        version: '0.8.0',
        date: 'June 3, 2026',
        codename: 'Whole Parcel',
        summary:
            'The red highlight now covers the whole parcel, not just one building. Until now searching an address painted the searched parcel red and lit up only the single building footprint under the search point - but a parcel often holds several buildings, and the others stayed the resting gray. similoo now paints every building inside the searched parcel red. Because the footprint tile carries no parcel id, membership is resolved geometrically: the searched parcel\'s polygon is gathered from the parcel tiles (so a tile-split parcel still counts) and every building whose footprint centroid falls inside it is highlighted. Like the comparable (pink) highlight, this is lazy and sticky - buildings that stream in late or are panned into view light up on the next map settle, and stay lit as you move. A new bottom-left legend explains the colors: red for the searched parcel and its buildings, green for same-zone parcels, pink for comparable buildings.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'building-2',
                text: 'Every building in the searched parcel is now highlighted red, not just the one under the search point. The footprint tile has no parcel column, so membership is resolved geometrically - the parcel polygon is gathered from the rendered parcel tiles by id (tile-split parcels included) and each building whose footprint centroid sits inside it is painted red. Resolution is lazy + sticky (re-checked on every map idle) so late-rendering buildings still light up. Falls back to the single nearest building when no parcel polygon is available.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'list',
                text: 'New on-map legend (bottom-left, suite-standard panel) explaining the highlight colors: red = searched parcel & its buildings, green = same-zone parcels, pink = comparable buildings. Fully localized across EN/FR/DE/IT and re-localizes on language change.',
                prs: [],
            },
        ],
    },
    {
        version: '0.7.1',
        date: 'June 2, 2026',
        codename: 'Dark Match',
        summary:
            'A small suite-consistency fix: in dark mode, the landing address-search results now use the theme-aware red tokens for their hover and selected states instead of a hardcoded light-red on dark surfaces, so the highlighted result reads with proper contrast - matching how the rest of the app tints active surfaces in dark mode.',
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
            'The comparable buildings now light up on the 3D map, not just their parcels. Until now the map painted the searched parcel red, every same-zone parcel green, and the searched building red - but the comparable buildings themselves stayed the resting gray. They now render pink (the same color as the mini-cube markers and the sidebar cards), so the matches you see ranked in the panel are immediately findable as actual buildings on the map. A comparable lights up the moment it scrolls into view (pan or fly to one from its card) and stays lit as you move around, while the searched building keeps its red.',
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
                text: 'The comparable highlight resolves lazily and sticks: a comparable that is off-screen when you search lights up as soon as you pan or fly it into view, and once lit it stays pink while you move around the map (the color is re-checked every time the map settles). Returning to search or closing the panel clears every comparable highlight.',
                prs: [19],
            },
        ],
    },
    {
        version: '0.6.2',
        date: 'May 31, 2026',
        codename: 'Centralized share card',
        summary:
            'The social-share preview image (Open Graph / Twitter card) now points at the centralized toolbox-hosted canonical image instead of a per-app file, with the correct real pixel dimensions - so link unfurls match the rest of the SwissNovo suite.',
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
            'A low-risk UI/UX polish sweep: brand and accessibility consistency fixes with no behavior or data-model changes. The page title now uses the suite-standard em-dash; the release-notes panel renders the similoo wordmark (it previously still showed the inherited hood mark); a searched/deep-linked address now opens at street level (zoom 17, the suite convention) so the target building reads cleanly; the comparison panel and the map controls stay perfectly aligned when the sidebar opens (the gutter and the MapLibre control shift now both match the panel\'s 400px width, and the mobile collapse breakpoint lines up at 640px); and the comparison sidebar\'s accessible label re-localizes with the rest of the UI when you switch language.',
        highlight: false,
        items: [
            {
                kind: 'fixed',
                icon: 'trash-2',
                text: 'Removed dead Netlify config - Vercel-only. similoo runs entirely on Vercel (vercel.json + the api/ serverless functions, including api/signal-collect.js), so netlify.toml and netlify/functions/signal-collect.js were deleted. Client telemetry already POSTs to /api/signal-collect, so nothing in the app changes.',
                prs: [13],
            },
            {
                kind: 'fixed',
                icon: 'type',
                text: 'Page <title> + meta.title now use the suite-standard em-dash ("similoo - Comparable Buildings Explorer"), matching the FR/DE/IT titles and the rest of the SwissNovo suite.',
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
                text: 'Searched and deep-linked addresses now jump to zoom 17 (was 16.5) so the target building is at street level on arrival - the suite-wide deep-link zoom convention.',
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
                text: 'The comparison sidebar\'s accessible region label (aria-label) now re-localizes on language change alongside the rest of its chrome.',
                prs: [],
            },
        ],
    },
    {
        version: '0.6.0',
        date: 'May 29, 2026',
        codename: 'Instant Match',
        summary:
            'Address search now snaps to the result instantly and lights up the comparison the moment the tiles arrive. Picking an address jumps the camera straight there - no fly animation, no waiting - and the highlight is driven directly off the parcel vector tile: the searched parcel goes red, its 3D building goes red, and every parcel sharing the same `cz_local` (the similar building type) goes green. The big fix underneath: the parcel API returns the canonical id under `parcel_id` (already a "CH…" EGRID) and has no `egrid` field, so the old lookup silently fell back to the seeded mock every time - which meant the zone never matched and nothing painted. similoo now reads `parcel_id`, talks to the live `/score/similoo` for the comparables list, and no longer blocks the map highlight on that network call at all.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'zap',
                text: 'Address search switches the view instantly - `jumpTo` replaces the `flyTo` animation so the searched address snaps into place on the next frame with the lowest possible latency.',
                prs: [],
            },
            {
                kind: 'fixed',
                icon: 'crosshair',
                text: 'The searched parcel (red), its 3D building (red), and all same-zone parcels (green) now reliably highlight. The highlight reads `cz_local` + `parcel_id` straight off the parcel tile and applies the instant the tile under the point loads - it no longer waits on (or depends on) the `/score/similoo` response, so it works even before the comparables list arrives.',
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
            'The map gets its basemap back, and the comparison context is now visible at a glance. We restore the suite-standard satellite imagery (Esri World Imagery, same source the Cesium-based apps load by default) and paint the parcel layer by zoning straight off the vector tile: the searched parcel goes red, every other parcel sharing the target\'s `cz_local` goes green, and everything else fades to a near-transparent white wash so the imagery still reads. The earlier "model space" look intentionally dropped both - that revision left users wondering *why* a given building counted as comparable; surfacing the zone footprint answers that without an extra panel.',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'map',
                text: 'Satellite basemap restored - Esri World Imagery, matching project_RES and the other SwissNovo apps. The previous off-white "model space" background is gone.',
                prs: [],
            },
            {
                kind: 'new',
                icon: 'palette',
                text: 'Parcel layer painted by `cz_local`: red for the searched parcel, green for every other parcel in the same zone, white wash everywhere else. The expression reads `cz_local` directly off the parcel vector tile so zone neighbors are colored consistently across the whole dataset, not just the viewport.',
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
            'Full UX rewrite around the address-first comparable-buildings flow. The app now opens on a minimal centered address search (no map clicking - that produced too many false signals). Pick a result and the working surface appears: MapLibre LOD 2.5 cubes on the left (target building painted red, comparable buildings as pink mini-cube markers across Switzerland) and the comparison sidebar on the right with target metrics, filters, and a sortable card list. The base raster and parcel polygons are gone - only the building cubes remain, so the visual reads as a model rather than a map. Clicking a comparable card (or its cube marker on the map) opens a Three.js LAS popup that renders a 100 m slice around the building with a toggle between the raw colored point cloud (LAS classification colors) and a solid-mesh representation (Roofer building model on a gray terrain extracted from the ground class).',
        highlight: true,
        items: [
            {
                kind: 'new',
                icon: 'search',
                text: 'Address-first landing screen replaces map-click as the only entry point - single centered input with Mapbox-backed autocomplete, restricted to Switzerland. The map is hidden until an address is picked.',
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
                text: 'Three.js LAS popup: clicking a comparable card or its on-map cube opens a modal that renders a 100 m LAS slice around the building. Toggle between Point cloud (raw colored LiDAR) and Solid model (Roofer building mesh on a derived gray terrain) from the modal chrome. Powered by the Contoor 3D API behind a new `/api/three3d` Vercel proxy.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'eye-off',
                text: 'Map click handlers (parcel/building selection) removed - selecting only via address search keeps the signal-collect feed clean of accidental clicks.',
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
                text: 'Deep link via `?lat=&lng=` (+ optional `&label=`) skips the landing view and restores the comparison surface for the given coordinates - useful for sharing and headless tests.',
                prs: [],
            },
        ],
    },
    {
        version: '0.3.0',
        date: 'May 27, 2026',
        codename: 'Inter Polish',
        summary:
            'Typography refresh for a more professional tech-product look. UI body, headings, and the address search now ride on Inter (variable, OpenType cv11 + ss01 + tabular figures) with `-webkit-font-smoothing: antialiased` for clean rendering on the dark theme. Varela Round is preserved only for the `similoo` wordmark in the navbar - the suite-wide brand identifier with the red `oo`. Code/ID surfaces (parcel IDs, EGRID, camera monitor) switch to JetBrains Mono via a new `--hood-mono` token. Three tokens now drive every font choice in the app: `--hood-font` (Inter, UI), `--hood-display` (Varela Round, wordmark), `--hood-mono` (JetBrains Mono, code).',
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
                text: 'IDs and code surfaces switch to JetBrains Mono via the new `--hood-mono` token - buildingInfoPanel, comparison cards/EGRID, release-notes version pills, and the camera monitor all share one mono stack.',
                prs: [],
            },
            {
                kind: 'improved',
                icon: 'sparkles',
                text: 'Crisper rendering on dark mode: grayscale font-smoothing, `text-rendering: optimizeLegibility`, kerning + ligatures + Inter cv11 (single-story g) + ss01 (open digits) enabled at the html root.',
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
                text: 'Bumped @aireon/shared to v0.32.0 - release-notes button icon switched from Tag to CheckCircle.',
                prs: [],
            },
        ],
    },
    {
        version: '0.2.0',
        date: 'May 26, 2026',
        codename: 'Featherweight',
        summary:
            'Replace the Cesium 3D foundation inherited from hood with a much lighter MapLibre + fill-extrusion stack. Bundle drops ~75% vs the Cesium build (now ~1.1 MB JS / 304 KB gzipped, was ~3 MB+ gzipped). Vector parcels and 3D building footprints come from the suite\'s shared Martin tilesets (res-mbtiles-x.gisjoe.com / res-mbtiles-footprint-x.gisjoe.com - same sources room uses), so no new infra. Buildings extrude with rf_h_roof_70p − rf_h_ground for a realistic roof line. The comparison sidebar is unchanged on the outside but ports its highlight from Cesium entities to MapLibre Marker pins and feature-state. Carto Positron underlay provides geographic context.',
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
                text: 'Cold bundle dropped from ~3 MB gzipped (Cesium) to 304 KB gzipped (MapLibre + Three deferred) - ~10× faster first paint, no terrain tile cost.',
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
            'Wire the real /score/similoo backend behind same-origin Vercel proxies so the UI talks to live RES data instead of always falling back to the EGRID-seeded mock. Two new Node serverless functions - api/similoo.ts and api/parcel.ts - attach the RES API token server-side and forward to /score/similoo and /res_api/parcel_data respectively (mirroring the scoore /api/overpass pattern). The client API surface no longer ships any token. Suite convention is the custom `token:` header on /score/* and /res_api/*; the previous Authorization: Bearer attempt would have hit 401 on both routes and always degraded to mock.',
        highlight: true,
        items: [
            {
                kind: 'fixed',
                icon: 'shield-check',
                text: 'New api/similoo.ts and api/parcel.ts Vercel proxies that send the RES API token via the suite-standard `token:` header (matching scoore/api/overpass). src/js/api/similoo.js and src/js/comparison/parcelLookup.js now POST same-origin to /api/similoo and /api/parcel - no client-side token, no Bearer header mismatch, no CORS surface.',
                prs: [],
            },
        ],
    },
    {
        version: '0.1.0',
        date: 'May 25, 2026',
        codename: 'First Compare',
        summary:
            'similoo gets its headline surface: a right-edge "Comparable Buildings" sidebar that opens when you pick a building on the 3D map. Top section shows the target parcel\'s headline metrics - municipality, zoning, EGRID, parcel size, volume, footprint, height, floors, year, and the big ratioV number. Middle section filters by year window (1–30, default 10) and parcel-size range. Bottom is a sortable card list (similarity / ratioV / size / year) where each card visualizes ratioV with a horizontal data-bar; clicking flies the camera to that comparable, hovering drops a highlight pin on the map. Backed by a new `fetchSimilooComparables(egrid)` client that calls `<RES>/score/similoo` when live and falls back to a deterministic mock seeded by the EGRID hash so the demo flow works before the backend ships. All visible strings translated across EN/FR/DE/IT.',
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
            'similoo forks the hood 3D viewer foundation and rebrands it. The Cesium map, navbar, settings popover, theme toggle, screenshot pipeline, profile/auth, and four-locale i18n (EN/FR/DE/IT) all carry over from hood. Brand identifiers - page title, OG/Twitter tags, localStorage namespace, telemetry app_name, screenshot APP_SOURCE, file prefix - are switched to "similoo" so similoo and hood do not collide on the same browser or in the backend. The comparison engine, sidebar, and similarity-matching backend are still to be built.',
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
