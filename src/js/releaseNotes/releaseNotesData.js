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
    version: '0.51.0',
    date: 'August 26, 2026',
    codename: 'One trip instead of many',
    summary: 'Usage reporting now sends a single request when you leave the page, instead of one per action.',
    items: [
      {
        kind: 'improved',
        icon: 'package',
        text: 'similoo records which features get used so we know what to build next. Until now every action sent its own small request the moment it happened, so a busy session made dozens of separate trips to the server. Those records are now collected in the page and sent together in one request when you close or leave the tab. The information collected is exactly the same as before, and nothing about the comparison, the map or the 3D view changes.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'zap',
        text: 'Fewer background requests while you work means less network chatter competing with the map tiles and the point-cloud stream, which is most noticeable on a slow or mobile connection.',
        prs: [],
      },
    ],
  },
  {
    version: '0.50.0',
    date: 'August 26, 2026',
    codename: 'One engine for the suite',
    summary: 'The map engine now loads from the shared Aireon asset host, cached once across every Aireon app.',
    items: [
      {
        kind: 'improved',
        icon: 'zap',
        text: 'The MapLibre map engine (about 1 MB) is no longer bundled into similoo. It loads from the shared Aireon asset host and stays cached in your browser across every Aireon app and every similoo release, so repeat visits and switches between apps start faster. The comparison map itself is unchanged.',
        prs: [],
      },
    ],
  },
  {
    version: '0.49.0',
    date: 'August 25, 2026',
    codename: 'A label at the landing',
    summary: 'Clicking a comparable now pins its data card to the parcel on the map, with a one-click hand-off to geopool.',
    items: [
      {
        kind: 'new',
        icon: 'map-pin',
        text: 'Clicking a comparable in the list still flies the map to that parcel while the panel keeps showing your searched parcel. New: a compact data card now pins itself to the comparable on the map, with its address, EGRID and zone plus the same numbers the list card shows (match, ratioV, parcel size, volume, height, floors, year), so the map itself tells you which parcel you just landed on.',
        prs: [],
      },
      {
        kind: 'new',
        icon: 'external-link',
        text: 'The pinned card ends in an "Open parcel in geopool" link that opens the comparable in geopool with the parcel already selected, for the full parcel view beyond what the comparison needs. Close the card with its own button or by clicking anywhere on the map.',
        prs: [],
      },
    ],
  },
  {
    version: '0.48.0',
    date: 'August 25, 2026',
    codename: 'Two questions, two tabs',
    summary: 'The buildable-massing simulator moves into its own Build tab, next to Compare.',
    items: [
      {
        kind: 'improved',
        icon: 'columns-2',
        text: 'The comparison panel now has two tabs under the parcel header: Compare, which holds the ratioV figure, the parcel and building facts, the filters and the comparable-buildings list, and Build, which holds the buildable-massing simulator on its own. Compare is where the panel opens, so nothing moves until you ask for it. The tabs are the same ones roofs, footprint and geopool use, and they work from the keyboard with the arrow keys.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'gauge',
        text: 'The massing simulator no longer loads while you are reading the comparables. It builds its 3D scene the moment you open the Build tab and tears it down when you leave, so scrolling the list stays light.',
        prs: [],
      },
      {
        kind: 'new',
        icon: 'link',
        text: 'A link can now say which tab to open on: add ?topic=build to a similoo URL and the panel opens on the massing simulator. Otherwise the panel remembers the tab you last used.',
        prs: [],
      },
    ],
  },
  {
    version: '0.47.1',
    date: 'August 25, 2026',
    codename: 'Readable at the bottom of the panel',
    summary: 'The sparse-data note and the unselected year steps are legible again.',
    items: [
      {
        kind: 'fixed',
        icon: 'contrast',
        text: 'The line that explains where comparables came from when a years window is too narrow was printed in the palette\'s faintest gray, which fell well below the WCAG AA contrast floor in both themes - the sentence that tells you the data is sparse rather than broken was the hardest thing in the panel to read. It now uses the panel body-text color.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'accessibility',
        text: 'The unselected steps in the years ladder sat just under the same contrast floor once the translucent panel was over a dark map. They now match the panel body text. The selected step is unchanged: it stays the only filled pill and keeps its heavier label, so which window is on is still obvious without relying on color.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'package-check',
        text: 'The lockfile still recorded 0.46.1 after the 0.47.0 release. The version is realigned, and the app-contract test suite - which had been sitting in a folder the test runner never looked at - is now wired into npm test and checks the lockfile too, so the two cannot drift apart unnoticed again.',
        prs: [],
      },
    ],
  },
  {
    version: '0.47.0',
    date: 'August 24, 2026',
    codename: 'Steps, not a slider',
    summary: 'The years window is now a fixed ladder of steps, and one of them is All.',
    items: [
      {
        kind: 'improved',
        icon: 'sliders-horizontal',
        text: 'The years window in the comparison panel is now a row of fixed steps - 5, 10, 15, 20, 40, 60 or All - instead of a slider you had to land on a number with. It still starts at 10, so nothing changes until you touch it, and it works from the keyboard: tab to the row, then use the arrow keys or Home and End to move between steps.',
        prs: [],
      },
      {
        kind: 'new',
        icon: 'infinity',
        text: 'The All step drops the construction-year limit entirely, so a parcel can be compared against every building in its municipality and zone rather than only recent ones. Useful where almost nothing has been built lately.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'database',
        text: 'When a window is too narrow to find enough recent building permits, the panel now says so in one line and names where the comparables came from instead. A tight step reads as sparse data, not as a broken search.',
        prs: [],
      },
    ],
  },
  {
    version: '0.46.1',
    date: 'August 22, 2026',
    codename: 'One field, every app',
    summary: 'Address search and Open with now share one desktop field that starts with similoo.',
    items: [
      {
        kind: 'improved',
        icon: 'external-link',
        text: 'The address search and Open with launcher now share one Hub-style field on desktop. The selector starts with similoo, keeps similoo out of its own menu, and updates to the chosen destination after launch (@aireon/shared v1.186.1).',
        prs: [],
      },
    ],
  },
  {
    version: '0.46.0',
    date: 'August 22, 2026',
    codename: 'What you see is what you copy',
    summary: 'The link in your address bar now matches what is on your screen, including after you close the comparison panel.',
    items: [
      {
        kind: 'improved',
        icon: 'link',
        text: 'Close the comparison panel and the link in your address bar updates to say so. Copy it, or use "Share this view", and whoever opens it gets the same clean map at the same spot instead of a comparison you had already dismissed.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'mouse-pointer-click',
        text: 'Picking a parcel from the map or the search box states the open panel in the link too, so a copied address always reopens the view it came from. Panning and zooming leave that alone, because moving the map is not the same as picking or closing something.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'package',
        text: 'Updated @aireon/shared to v1.185.0.',
        prs: [],
      },
    ],
  },
  {
    version: '0.45.0',
    date: 'August 22, 2026',
    codename: 'The link decides',
    summary: 'Links now say whether they open the comparison. Add select=off for a clean map, and closing the panel stays closed across a reload.',
    items: [
      {
        kind: 'new',
        icon: 'eye-off',
        text: 'Add select=off to any similoo link and it opens on exactly the same view with no comparison panel and no highlighted parcel. Useful for a clean screenshot, a slide, or an embedded map.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'refresh-cw',
        text: 'Reloading the page after you close the comparison panel now leaves it closed and keeps the view you were looking at. It used to start a fresh comparison on whatever sat in the middle of the screen.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'link',
        text: 'Reloading a link that still names a parcel brings its comparison straight back, so a restored tab looks the way you left it.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'map-pin',
        text: 'A hand edited link whose parcel id matches nothing at its coordinates no longer highlights the neighboring parcel as though it were the one the link names. The panel opens on the parcel the link actually names.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'package',
        text: 'Updated @aireon/shared to v1.184.0.',
        prs: [],
      },
    ],
  },
  {
    version: '0.44.0',
    date: 'August 21, 2026',
    codename: 'The link knows which parcel',
    summary: 'The address bar now names the parcel you are looking at, so the link you copy (and the one "Share this view" puts on your clipboard) opens on that exact parcel.',
    items: [
      {
        kind: 'new',
        icon: 'link',
        text: 'The address in your browser bar now carries the parcel itself, not just the spot on the map. Copy it, or use "Share this view" from the account menu, and whoever opens it lands on the same parcel with the same comparison, even where several parcels overlap the point.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'x',
        text: 'Closing the comparison panel now takes the parcel back out of the address bar, so a link you share after closing it no longer claims a parcel that is not on screen.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'map-pin',
        text: 'Flying to a comparable from its card no longer leaves the original parcel\'s identity attached to the new position, so a link copied at that moment cannot name one parcel while pointing at another.',
        prs: [],
      },
    ],
  },
  {
    version: '0.43.0',
    date: 'August 21, 2026',
    codename: 'Open with, suite-wide',
    summary: 'The Open with menu now reaches every map app in the suite, each listed by its wordmark and what it does.',
    items: [
      {
        kind: 'improved',
        icon: 'external-link',
        text: 'Open with now offers every map app in the Aireon suite instead of a short list, prints each app\'s wordmark next to a one-line description of what it does, and adds a search box so you can jump straight to the app you want. The descriptions follow the language you picked.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'package',
        text: 'Updated @aireon/shared to v1.182.2.',
        prs: [],
      },
    ],
  },
  {
    version: '0.42.1',
    date: 'August 21, 2026',
    codename: 'Varela Round',
    summary: 'The Aireon wordmark is now consistent across the suite.',
    items: [{ kind: 'improved', icon: 'package', text: 'Updated @aireon/shared to v1.178.1 so the canonical Aireon wordmark uses Varela Round with its red oo everywhere it appears.', prs: [] }],
  },
  {
    version: '0.42.0',
    date: 'August 21, 2026',
    codename: 'The quiet moment',
    summary: 'The app starts smoother, especially on slower devices.',
    items: [
      {
        kind: 'improved',
        icon: 'zap',
        text: 'Starting the app is smoother now. The anonymous session recording that helps us find bugs used to switch on while the app was still starting up; it now waits until the page has finished loading and the device has a quiet moment.',
        prs: [],
      },
    ],
  },
  {
    version: '0.41.0',
    date: 'August 19, 2026',
    codename: 'The zone the municipality uses',
    summary: 'The parcel zone is now the municipal designation ("Dorfzone 2", "Wohnzone, Bauklasse 4") instead of the federal main-use category ("Zentrumszonen", "Wohnzonen"), suite-wide.',
    items: [
      {
        kind: 'improved',
        icon: 'tag',
        text: 'The Zoning pill in the sidebar and the subtitle of a comparable\'s 3D detail view now show the municipal zone designation ("Wohnzone, Bauklasse 4", "Dorfzone 2") instead of the federal main-use category ("Wohnzonen", "Zentrumszonen"). The federal category is the broadest of the zone columns and is missing for all of canton Zurich; the municipal designation is what the zoning plan actually says, and it is the same designation the comparables cohort and the green wash on the map are keyed on, so the zone you read and the peers you get now line up. Legal cross-references such as "siehe gültige Bau- und Zonenordnung" are still never shown as a zone.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'book-open',
        text: 'The "How it works" panel now says the sidebar zone is the same municipal designation the peer filter is keyed on, in all four languages.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'package',
        text: 'Updated the shared Aireon library to v1.177.0, which carries the suite-wide rule: the zone is the municipal designation; the federal category stays available in raw data and as a filter.',
        prs: [],
      },
    ],
  },
  {
    version: '0.40.0',
    date: 'August 18, 2026',
    codename: 'One zone per parcel',
    summary: 'The zone shown for the searched parcel is now the harmonized federal zone category, the same label every Aireon app prints for that parcel.',
    items: [
      {
        kind: 'improved',
        icon: 'tag',
        text: 'The Zoning pill in the sidebar now shows the harmonized federal zone category (for example "Wohnzonen") instead of the municipal designation ("Wohnzone, Bauklasse 4"), so the same parcel reads the same way here as in every other Aireon app. Where no harmonized category exists yet (all of canton Zurich, parts of Ticino) the municipal designation remains as the single fallback, and legal cross-references such as "siehe gültige Bau- und Zonenordnung" are never shown as a zone. The subtitle of a comparable\'s 3D detail view follows the same rule.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'layers',
        text: 'The green wash on the map and the comparables themselves are still selected by the finer municipal zone type, which is what makes them true peers. The legend row and the "How it works" text now say so plainly ("Parcels of the same municipal zone type") instead of calling that key the zone.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'package',
        text: 'Updated the shared Aireon library to v1.173.1, which carries the suite-wide zone label rule.',
        prs: [],
      },
    ],
  },
  {
    version: '0.39.0',
    date: 'August 17, 2026',
    codename: 'How old is this number?',
    summary: 'The About dialog now names the parcel snapshot similoo is showing and the date each layer behind it was last calculated.',
    items: [
      {
        kind: 'new',
        icon: 'database',
        text: 'About now names the parcel snapshot similoo is reading and the date it was last calculated, so you can see at a glance how current the figures on screen are.',
        prs: [],
      },
      {
        kind: 'new',
        icon: 'square-stack',
        text: 'A "Pipeline details" disclosure in the same dialog opens a dated list of every enrichment layer behind a parcel, including each federal source’s own vintage, so you can tell which part of the data is fresh and which part is waiting on its next federal release. The line follows the language you have selected.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'box',
        text: 'Every building volume was recalculated on August 17, 2026. That also refreshed the utilization figures, which were still being derived from volumes computed before duplicate building reconstructions were removed.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'package',
        text: 'Updated the shared Aireon library to v1.172.2, which carries the data-vintage line in the About dialog, with the sentence translated per language rather than assembled in English word order.',
        prs: [],
      },
    ],
  },
  {
    version: '0.38.1',
    date: 'August 17, 2026',
    codename: 'The first map is the right map',
    summary: 'Choosing an address now opens directly on that building. The brief detour through an unrelated Zurich building while the map started has been removed.',
    items: [
      {
        kind: 'fixed',
        icon: 'wrench',
        text: 'On the first address search, the map used to begin loading at its built-in Zurich location and only move to the chosen address after startup finished. On slower connections this made an unrelated building appear before similoo jumped to the correct one. The map now starts with the selected address as its initial camera, so every tile and building shown during loading already belongs to the requested location. If another address is selected before startup finishes, similoo reuses that same map and lets only the newest choice move it.',
        prs: [],
      },
    ],
  },
  {
    version: '0.38.0',
    date: 'August 14, 2026',
    codename: 'A shared link shows the address it opens on',
    summary: 'A link that carries both coordinates and an address now trusts the coordinates. similoo looks up the address of the parcel the link actually opens on, shows that, and repairs the link so everyone you forward it to sees the right one.',
    items: [
      {
        kind: 'fixed',
        icon: 'wrench',
        text: 'A shared link carries a location and a name for it, and the two could disagree. similoo used to display the name written in the link, so a link whose coordinates sit on Alte Rheinstrasse 91 could open with the header, the saved-parcel entry and the search box all reading Alte Rheinstrasse 87. Worse, the wrong name was copied back into the link, so it stayed wrong for everybody it was forwarded to. The address in a link is now only a placeholder that keeps the panel from looking empty for a moment. similoo asks the building register which address belongs to the parcel the link opens on, replaces the placeholder with it, and updates the link so the next person to open it starts from the corrected address.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'link',
        text: 'Links made by the address search and by the right-click menu on the map wrote the address under a different name than the one similoo read back, so on reopening a link the older address could win over the newer one. Both now use the same wording, and similoo still opens links shared before this change.',
        prs: [],
      },
    ],
  },
  {
    version: '0.37.0',
    date: 'August 14, 2026',
    codename: 'The right address for the right parcel',
    summary: 'The address shown when you right-click a parcel now belongs to that parcel, instead of being whichever address happened to sit nearest the spot you clicked.',
    items: [
      {
        kind: 'fixed',
        icon: 'wrench',
        text: 'Right-clicking a parcel used to look up the closest street address to the exact point under your cursor. That produced three kinds of wrong answer: an address that actually belongs to the neighboring plot, the same address on two parcels side by side, and two different addresses on one parcel depending on where inside it you clicked. similoo now asks the building register for the address registered to that specific parcel, so the answer stays the same wherever inside the parcel you click and can no longer borrow the address of the plot next door. Parcels the register knows no address for, such as roads, courtyards and farmland, still show the nearest address as a best effort.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'sparkles',
        text: 'Looking up a parcel address is also quicker now, because the answer is remembered per parcel and re-checking the same parcel no longer costs another lookup.',
        prs: [],
      },
    ],
  },
  {
    version: '0.36.0',
    date: 'August 14, 2026',
    codename: 'A newer map engine',
    summary: 'similoo now runs on the latest version of its map engine. Everything looks and works exactly as before.',
    items: [
      {
        kind: 'improved',
        icon: 'sparkles',
        text: 'The software that draws the map has been updated to its newest major version, keeping similoo current with security fixes and performance work from the people who maintain it. Nothing about the map changes for you: the satellite imagery, the colored parcels, the buildings and every control behave exactly as they did before. The newest version does require a reasonably modern browser, so if the map ever fails to appear, updating your browser is the fix.',
        prs: [],
      },
    ],
  },
  {
    version: '0.35.0',
    date: 'August 14, 2026',
    codename: 'The map loads on demand',
    summary: 'similoo no longer waits for the mapping library before it shows anything. The address card is ready about a second sooner.',
    items: [
      {
        kind: 'improved',
        icon: 'sparkles',
        text: 'The mapping library made up more than half of everything the browser had to download before similoo could put anything on screen, even though the map itself only appears once you pick an address. It now loads on demand, alongside the map, instead of blocking everything ahead of it. The navbar and the address card appear noticeably earlier on a phone or a slow connection, and the map still arrives at the same moment as before.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'wrench',
        text: 'An address picked while similoo was still loading is now remembered and opened as soon as the map is ready, instead of being ignored.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'wrench',
        text: 'The "Open with" menu now appears for links opened straight at a location, not only after searching from inside the app.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'wrench',
        text: 'Hardened the map area against a class of styling conflict that could leave it blank with no error message, by pinning its size so it can no longer collapse.',
        prs: [],
      },
    ],
  },
  {
    version: '0.34.0',
    date: 'August 13, 2026',
    codename: 'First paint, first',
    summary: 'similoo now paints its layout the instant the page arrives, in the right theme, without waiting on a font server.',
    items: [
      {
        kind: 'improved',
        icon: 'sparkles',
        text: 'Opening similoo now shows the navbar and map area immediately, before any code has run. The old blank white gap between clicking a link and the app appearing is gone, which is most noticeable on a phone or a slow connection.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'Fonts are served from similoo itself instead of Google Fonts. That removes a request to an outside server that used to hold up the first paint, and text no longer shifts once the real font arrives.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'The app connects to the map tile, address search and data servers earlier, so the first map and the first address lookup start sooner.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'wrench',
        text: 'Dark mode is applied before the page draws, so returning in dark mode no longer flashes a light screen first. Your saved theme choice carries over unchanged.',
        prs: [],
      },
    ],
  },
  {
    version: '0.33.2',
    date: 'August 12, 2026',
    codename: 'Quiet all the way down',
    summary: 'Every skeleton layout now honors the Hub loading policy, including placeholders rendered by shared components.',
    items: [{
      kind: 'fixed',
      icon: 'wrench',
      text: 'Updated @aireon/shared to v1.158.0. Whole loading shells and direct skeleton primitives now stay absent under the default-off Hub policy; when an administrator enables skeletons, each complete layout appears once at the configured threshold without a second delay or duplicate spinners.',
      prs: [],
    }],
  },
  {
    version: '0.33.1',
    date: 'August 12, 2026',
    codename: 'Calm by default',
    summary: 'Loading placeholders now follow the suite-wide Hub setting and stay hidden by default during quick waits.',
    items: [{
      kind: 'improved',
      icon: 'wrench',
      text: 'Saved-image and screenshot placeholders now follow the loading-feedback policy managed in the Aireon Hub. Both the spinner and skeleton are off by default; an administrator can enable either mode and choose when skeletons appear for longer waits.',
      prs: [],
    }],
  },
  {
    version: '0.33.0',
    date: 'August 12, 2026',
    codename: 'Dial back the overlay',
    summary: 'Links can now carry an overlay opacity, fading the parcel colors and the 3D buildings so the aerial imagery underneath stays readable.',
    items: [
      {
        kind: 'new',
        icon: 'sparkles',
        text: 'Add ?opacity=40 to a similoo link and the app opens with everything it draws on the map, the zone colored parcels, their outlines and the 3D building masses, at 40 percent. The swisstopo aerial imagery itself never fades, so roofs, roads and terrain stay fully readable underneath.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'The value is an integer from 0 to 100. At 100 everything keeps the appearance it was designed with and the parameter is left out of links entirely, so ordinary shared views are unchanged. The red target parcel and the green same zone parcels keep their relative strength at every setting.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'The highlight that flashes on the map when you hover a comparable in the sidebar keeps its full strength at any overlay opacity, so the building you are pointing at stays easy to find.',
        prs: [],
      },
    ],
  },
  {
    version: '0.32.0',
    date: 'August 12, 2026',
    codename: 'Skip the landing view',
    summary: 'Deep links can now skip the landing view: ?search_modal=off opens similoo on a Switzerland overview with the navbar search ready.',
    items: [
      {
        kind: 'new',
        icon: 'sparkles',
        text: 'Deep links can now skip the landing view: ?search_modal=off opens similoo on a Switzerland overview with the navbar search ready. It is an alias of ?welcome=off, so either spelling works.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'bug',
        text: 'Panning the map before you pick an address no longer writes coordinates into the URL. Previously a copied link could reopen a full comparison at whatever spot you happened to pan over.',
        prs: [],
      },
    ],
  },
  {
    version: '0.31.7',
    date: 'August 11, 2026',
    codename: 'Shared RES client',
    summary: 'Parcel, comparison and screenshot requests now go through the shared Aireon RES API client, aligning similoo with the rest of the suite. Nothing changes in how the app looks or behaves.',
    items: [
      {
        kind: 'improved',
        icon: 'package',
        text: 'Requests to the RES backend (parcel lookups, comparable-parcel search, saved screenshots) now go through the suite-shared typed API client. This is an internal alignment update; nothing changes in how the app looks or behaves.',
        prs: [],
      },
    ],
  },
  {
    version: '0.31.6',
    date: 'August 11, 2026',
    codename: 'Calmer startup',
    summary: 'Startup now stays visually calm during quick access and app initialization; the full loading skeleton appears only after 2.5 seconds.',
    items: [
      {
        kind: 'improved',
        icon: 'sparkles',
        text: 'Startup now stays visually calm during quick access and app initialization; the full loading skeleton appears only after 2.5 seconds.',
        prs: [],
      },
    ],
  },
  {
    version: '0.31.5',
    date: 'August 11, 2026',
    codename: 'Fresh shared foundations',
    summary: 'similoo now runs on the latest shared Aireon library (v1.152.0), keeping its common components and utilities current with the rest of the suite.',
    items: [
      {
        kind: 'improved',
        icon: 'package',
        text: 'Updated the shared Aireon library to v1.152.0. This is a maintenance update that keeps the components and utilities similoo shares with its sibling apps on the same, most recent version.',
        prs: [],
      },
    ],
  },
  {
    version: '0.31.4',
    date: 'August 9, 2026',
    codename: 'A faster, lighter build',
    summary: 'similoo is now built with Vite 8, so new versions ship sooner and repeat visits load a little lighter.',
    items: [
      {
        kind: 'improved',
        icon: 'zap',
        text: 'similoo now builds on Vite 8 (Rolldown), the new engine that assembles the app. Preparing a new version takes about half the time it used to, roughly 1.8 seconds instead of 3.8, so fixes and features reach you sooner.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'package',
        text: 'The stylesheet is slightly smaller, and the app now arrives as more, smaller pieces at the same total size. Each piece is stored separately by your browser, so a future update only needs to fetch the parts that actually changed instead of one large block.',
        prs: [],
      },
    ],
  },
  {
    version: '0.31.3',
    date: 'August 9, 2026',
    codename: 'Links that reopen exactly as you left them',
    summary: 'A shared or reloaded similoo link now restores the same address and the same zoom it was made at.',
    items: [
      {
        kind: 'fixed',
        icon: 'link',
        text: 'The address on a link now always matches the place the link opens. Moving the map away from the address you searched, for example flying to a comparable building, drops the old address from the link instead of carrying it along, so a copied link can no longer open one parcel under another parcel\'s address. Links that no longer carry an address open on their coordinates.',
        prs: [],
      },
      {
        kind: 'fixed',
        icon: 'link',
        text: 'Reloading after zooming out now reopens at the zoom you left, instead of jumping back to street level. Links opened from somewhere else still open at street level so the target building reads.',
        prs: [],
      },
    ],
  },
  {
    version: '0.31.2',
    date: 'August 9, 2026',
    codename: 'Links that carry the whole view',
    summary: 'The URL now follows the map as you move it, and it names your language and light or dark mode, so a copied link reopens the view you were looking at.',
    items: [
      {
        kind: 'improved',
        icon: 'link',
        text: 'Panning, zooming, resetting the compass, flying to a comparable building, and centering from the right-click menu all keep the address bar up to date, so copying the link shares the exact spot on screen.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'link',
        text: 'Shared similoo links now also carry the current language and the light or dark theme, so the person opening the link sees the same view you did. These stay link-only and never change your saved preferences.',
        prs: [],
      },
    ],
  },
  {
    version: '0.31.1',
    date: 'August 9, 2026',
    codename: 'Confirmed locations, shareable',
    summary: 'Choosing an address or confirming a right-click location now keeps the browser URL synchronized with that exact place.',
    items: [
      {
        kind: 'fixed',
        icon: 'link',
        text: 'Address search and right-click confirmations now write the canonical latitude, longitude, zoom, and address label into the current URL without reloading the map or adding a browser-history step, so copied links reopen the same confirmed location.',
        prs: [],
      },
    ],
  },
  {
    version: '0.31.0',
    date: 'August 9, 2026',
    codename: 'Shareable links',
    summary: 'A similoo link can now carry a theme, language, or zoom override, freeze the map for a clean screenshot or embed, or hide the navbar chrome, the same deep-link parameters other Aireon apps use.',
    items: [
      {
        kind: 'new',
        icon: 'link',
        text: 'New URL parameters on similoo links: open in dark or light mode, in a chosen language, or at a specific zoom. mode=screenshot/embed/kiosk hides the navbar for captures and embeds, and motion=off freezes the map for a clean screenshot. None of these are saved to your preferences.',
        prs: [],
      },
    ],
  },
  {
    version: '0.30.2',
    date: 'August 8, 2026',
    codename: 'Recent right-clicks',
    summary: 'Searches started from the right-click map menu now show up in your Recent searches.',
    items: [
      {
        kind: 'fixed',
        icon: 'history',
        text: 'Right-click map searches now appear in Recent searches, matching the address bar and synced across Aireon apps.',
        prs: [],
      },
    ],
  },
  {
    version: '0.30.1',
    date: 'August 8, 2026',
    codename: 'EGRID copy',
    summary: 'The right-click map menu can now copy the federal parcel identifier (EGRID) straight to your clipboard.',
    items: [
      {
        kind: 'new',
        icon: 'copy',
        text: 'Right-click map menu: Copy parcel ID (EGRID) copies the federal parcel identifier (CH...) to the clipboard, so you can paste it into other Aireon apps or official registers without retyping it.',
        prs: [],
      },
    ],
  },
  {
    version: '0.30.0',
    date: 'August 8, 2026',
    codename: 'Right-click, clearer',
    summary: 'The right-click map menu now leads with the street address and asks you to "Find comparables here".',
    items: [
      {
        kind: 'improved',
        icon: 'map-pin',
        text: 'Right-clicking the map used to head the menu with whatever label came back first, which could be a bare parcel id. The menu now leads with the street address of the clicked point and identifies the parcel on the line below it, so you always know where you are before acting.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'mouse-pointer-click',
        text: 'The menu\'s primary action is now labeled "Find comparables here", with a hint explaining that it searches similar buildings around that point, instead of the generic "Load parcel data". The wording is translated into English, German, French, and Italian.',
        prs: [],
      },
    ],
  },
  {
    version: '0.29.1',
    date: 'August 8, 2026',
    codename: 'No forced sign-in',
    summary: 'Signed-out visitors are never redirected to the sign-in page anymore: the app always opens directly, and signing in stays your choice.',
    items: [
      {
        kind: 'improved',
        icon: 'shield-check',
        text: 'Opening similoo while signed out used to bounce some visitors through the account service, and could even strand you on its sign-in page when an old session had expired. That automatic redirect is gone across the whole Aireon suite: similoo now always loads anonymously, and you only ever see the sign-in screen after choosing Sign in yourself.',
        prs: [],
      },
    ],
  },
  {
    version: '0.29.0',
    date: 'August 7, 2026',
    codename: 'Data pills',
    summary: 'The subject parcel now reads as compact pills, tightly stacked and always in the same order.',
    items: [
      {
        kind: 'improved',
        icon: 'tags',
        text: 'The subject parcel used to spend a fixed three-column cell on every figure, so a two-character zone code took as much room as a full parcel size. Its attributes now sit in two compact pill sections, "Parcel" (size, zoning) and "Building" (footprint, floors, year built, height, volume). Each pill takes only the width it needs, they stack tightly on a wrapping row, and the order never changes, so the block is far faster to scan. Zoning moved out of the ratioV band and into the Parcel section, values that are missing for a parcel simply drop out instead of showing a dash, and the ratioV headline metric now spans the full panel width.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.11',
    date: 'August 6, 2026',
    codename: 'Two-line address',
    summary: 'The comparison panel now titles the subject parcel with just the street and house number, and moves the postal code and city to the line below.',
    items: [
      {
        kind: 'improved',
        icon: 'map-pin',
        text: 'The subject parcel heading used to repeat the full search label in one long line, such as "Nüschelerstrasse 30 8001 Zürich". The title now carries only the street and house number, while the postal code and city sit on the muted line underneath, the same way every other Aireon map app presents an address. When no street address is available, the municipality still takes over the title.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.10',
    date: 'August 6, 2026',
    codename: 'Track up top',
    summary: 'The Track control now sits in the panel header next to the raw-JSON and close buttons, as a compact bookmark chip.',
    items: [
      {
        kind: 'improved',
        icon: 'bookmark',
        text: 'Moved the Track (save parcel) control from the parcel identity card into the panel header action cluster, ahead of the raw-JSON toggle, as a compact bookmark chip with the full state text on its tooltip - including the sign-in prompt for signed-out visitors.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.9',
    date: 'August 5, 2026',
    codename: 'Stay in comparison',
    summary: 'Signing in now keeps the exact page, selected parcel, comparison view and in-progress work in place.',
    items: [
      {
        kind: 'fixed',
        icon: 'shield-check',
        text: 'Sign in now completes without reloading similoo, so the current address, selected parcel, 3D comparison state, open panels and unfinished work remain exactly as they were.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.8',
    date: 'August 5, 2026',
    codename: 'One Aireon mark',
    summary: 'similoo pauses installable-app support and uses the Hub favicon as its single browser icon.',
    items: [
      {
        kind: 'improved',
        icon: 'package',
        text: 'Install app prompts, the iOS add-to-home walkthrough, offline shell caching and service-worker update notices are paused while the suite focuses on the browser experience. A cleanup worker removes the old cached app shell and unregisters itself for people who previously installed similoo.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'globe',
        text: 'The browser tab now has one favicon source: the canonical red-and-white Aireon mark served by the Hub. Local icon variants and install manifests no longer compete with it.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.7',
    date: 'August 3, 2026',
    codename: 'Frosted',
    summary: 'The confirmation that appears after you copy a share link now lets the map show through.',
    items: [
      {
        kind: 'improved',
        icon: 'shield-check',
        text: 'Opening similoo is now anonymous-first: it does not attempt silent Zitadel SSO, even when the browser carries the Aireon SSO hint. The public comparable-buildings explorer stays usable while logged out, and Zitadel opens only after an explicit Sign in action.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'copy',
        text: 'Choosing "Share this view" in the account menu used to drop a solid green bar over the map. That confirmation is now translucent frosted glass, so the buildings behind it stay visible, and its wording sits in a darker, sharper tone that is easier to read at a glance. The same pill confirms a saved image, so those messages pick up the new look too.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.6',
    date: 'August 2, 2026',
    codename: 'You are here',
    summary: 'The red location pin now actually appears in the 3D point-cloud view.',
    items: [
      {
        kind: 'fixed',
        icon: 'map-pin',
        text: 'Opening a building in the 3D point-cloud view now shows the red pin marking that building inside the tile. The pin had never rendered: the 3D engine skips world-transform updates for objects it does not own, so the pin was being drawn 2,500 km away at the coordinate-system origin instead of on the building.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.5',
    date: 'July 31, 2026',
    codename: 'Solid volumes',
    summary: 'The 3D buildings now start at the new suite-wide default of 75% opacity.',
    items: [
      {
        kind: 'improved',
        icon: 'box',
        text: 'Every Aireon app that draws 3D buildings now starts them at the same 75% opacity, so the masses look identical whichever app you open. Here that is a change from 92%.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.4',
    date: 'July 31, 2026',
    codename: 'Stay put',
    summary: 'Links to the Aireon hub now open in a new browser tab.',
    items: [
      {
        kind: 'improved',
        icon: 'external-link',
        text: 'Links to the Aireon hub, including the See all Aireon applications button in the About dialog and the Aireon badge in the navbar, now open in a new browser tab so your work in similoo stays open.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.3',
    date: 'July 31, 2026',
    codename: 'Look away',
    summary: 'Navbar tooltips no longer stay pinned open after clicking a button.',
    items: [
      {
        kind: 'fixed',
        icon: 'mouse-pointer-click',
        text: 'Toolbar tooltips no longer stay open after clicking a button. Updated the shared @aireon/shared library to v1.122.1, which reveals tooltips only on hover or keyboard focus.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.2',
    date: 'July 28, 2026',
    codename: 'Swiss made',
    summary: 'The satellite basemap is now swisstopo SWISSIMAGE, the official Swiss orthophoto, in place of the third-party global mosaic.',
    items: [
      {
        kind: 'improved',
        icon: 'satellite',
        text: 'The satellite basemap switched from the Esri World Imagery global mosaic to swisstopo SWISSIMAGE, the official federal orthophoto. Imagery is sharper and more current over Switzerland, it is the same source the rest of the suite already renders, and the map credit in the About panel is now "© swisstopo".',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.1',
    date: 'July 22, 2026',
    codename: 'One line, always',
    summary: 'The parcel card header is tighter on phones, and the EGRID and Lat/Lng pills now always read on a single line.',
    items: [
      {
        kind: 'fixed',
        icon: 'text-cursor-input',
        text: 'The EGRID and Lat/Lng pills no longer wrap. They used to share a fixed half-and-half row, which on a phone left far too little room for a 6-decimal coordinate and broke it across several lines. Each pill is now sized to its own content: the two sit side by side when they fit and take a full row each when they do not, but the value always stays on one line.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'move-vertical',
        text: 'The parcel card header is more compact on phones. The copy pills keep their comfortable tap area but no longer inflate to a 44px block, so the header takes noticeably less of the sheet before the comparison results start.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'package',
        text: 'Updated the shared @aireon/shared library to v1.113.0, which carries the suite data-card header standard.',
        prs: [],
      },
    ],
  },
  {
    version: '0.28.0',
    date: 'July 21, 2026',
    codename: 'Card carrying',
    summary: 'The comparison panel adopts the suite mobile data-card look: aerial photo header, copyable EGRID and Lat/Lng pills, and an "Open in" shortcut on phones.',
    items: [
      {
        kind: 'new',
        icon: 'image',
        text: 'The target parcel now leads with a compact identity header: a small swisstopo aerial photo of the parcel sits beside the address and municipality at the top of the panel, so you can confirm you are looking at the right plot at a glance.',
        prs: [],
      },
      {
        kind: 'new',
        icon: 'copy',
        text: 'The EGRID chip has a new companion: a Lat/Lng pill with the picked point\'s WGS84 coordinates. The two sit side by side as half-width pills, and tapping either one copies its value to the clipboard.',
        prs: [],
      },
      {
        kind: 'new',
        icon: 'external-link',
        text: 'On phones an "Open in" launcher now sits at the end of the comparison details: scroll to the bottom of the sheet to hand the selected parcel off to another Aireon map app at the same spot, matching the suite-wide mobile card layout.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'layout',
        text: 'Removed the redundant "Target parcel" label above the panel title. The header now goes straight to the point, in line with the rest of the suite.',
        prs: [],
      },
    ],
  },
  {
    version: '0.27.7',
    date: 'July 20, 2026',
    codename: 'Peek at the data',
    summary: 'A "{}" button in the comparison panel header reveals the raw data behind the results.',
    items: [
      {
        kind: 'new',
        icon: 'braces',
        text: 'Added a "{}" toggle to the Comparable Buildings panel header, next to the close button. It swaps the panel body for a syntax-highlighted, copyable dump of the raw data behind the comparison (the target parcel, every comparable, and the query metadata), then swaps back when you turn it off. Handy for spotting exactly which figures drove a match. The tag under the list still tells you whether you are looking at live or demo data.',
        prs: [],
      },
    ],
  },
  {
    version: '0.27.6',
    date: 'July 19, 2026',
    codename: 'Coordinates CAD can use',
    summary: 'The map\'s right-click "Copy coordinates" now copies LV95 alongside WGS84.',
    items: [
      {
        kind: 'fixed',
        icon: 'copy',
        text: 'Right-click "Copy coordinates" on the comparison map used to copy only the WGS84 lat/lng, which is not directly usable in QGIS, cantonal GIS data or AutoCAD. It now also copies the LV95 (Swiss EPSG:2056) easting/northing pair, previewed right in the menu row before you click, inherited from the shared Aireon map context menu.',
        prs: [],
      },
    ],
  },
  {
    version: '0.27.5',
    date: 'July 19, 2026',
    codename: 'No more surprise zoom',
    summary: 'Focusing a search or filter field on a phone no longer zooms the page in and leaves it stuck.',
    items: [
      {
        kind: 'fixed',
        icon: 'smartphone',
        text: 'Stopped iOS Safari from auto-zooming the page when the address search is focused on phones, which left the page stuck wider than the screen. Search text is now 16px on phones and the page scale stays at 100%. The comparison size filters, bug-report form and release-notes search got the same treatment.',
        prs: [],
      },
    ],
  },
  {
    version: '0.27.4',
    date: 'July 19, 2026',
    codename: 'The full-screen comparison',
    summary: 'On phones the comparison panel now behaves like a proper bottom sheet.',
    items: [
      {
        kind: 'improved',
        icon: 'smartphone',
        text: 'On phones the Comparable Buildings panel now slides up as a full-height sheet that fills the screen below the top bar, and the top bar stays visible and usable while it is open. A grab handle at the top of the sheet lets you swipe down to dismiss it, and the layout leaves room for the home indicator on newer phones.',
        prs: [],
      },
    ],
  },
  {
    version: '0.27.3',
    date: 'July 18, 2026',
    codename: 'Comparables, not controls',
    summary: 'The common comparison stays focused, with filters optional and the result ready to print.',
    items: [
      {
        kind: 'improved',
        icon: 'file-text',
        text: 'Parcel-size and year-window filters now start inside a compact optional section instead of taking space from every comparison. Printing produces a clean target-and-comparables brief with the ranked metrics, while navigation, map controls, filters and action buttons stay out of the paper copy.',
        prs: [],
      },
    ],
  },
  {
    version: '0.27.2',
    date: 'July 18, 2026',
    codename: 'The comparison address stays in view',
    summary: 'The navbar search now keeps showing the address of the property currently being compared.',
    items: [
      {
        kind: 'improved',
        icon: 'search',
        text: 'Once you choose an address and similoo finishes loading its parcel and comparable buildings, that confirmed address now remains in the navbar search field. Previously it appeared only as faint placeholder text, so it was easy to miss which property was active. You can still click the field and type another address immediately.',
        prs: [],
      },
    ],
  },
  {
    version: '0.27.1',
    date: 'July 18, 2026',
    codename: 'Straight answer',
    summary: 'Housekeeping in the comparison list\'s status message.',
    items: [
      {
        kind: 'fixed',
        icon: 'bug',
        text: 'Cleaned up a dead check behind the comparison list\'s status line: both sides of it resolved to the same "no comparable buildings" state, so the panel now sets that state directly. The message you see when the list comes back empty — including when your parcel-size filter excludes every match — is unchanged.',
        prs: [],
      },
    ],
  },
  {
    version: '0.27.0',
    date: 'July 17, 2026',
    codename: 'One menu on the phone',
    summary: 'A cleaner top bar on phones and small tablets: every control now lives in a single account menu next to the search box.',
    items: [
      {
        kind: 'improved',
        icon: 'smartphone',
        text: 'On screens narrower than 1024px the top bar now shows just the similoo wordmark, the address search, and one account menu. Open with, How it works, Save Image, My Exports, the language picker, and the appearance setting all moved into that menu, so nothing overlaps the search box on small screens. The desktop layout is unchanged.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'pointer',
        text: 'The account menu on phones now stops just above the bottom edge of the screen and scrolls on its own, and every row meets the 44px touch-target size, so all entries stay reachable with one thumb.',
        prs: [],
      },
    ],
  },
  {
    version: '0.26.0',
    date: 'July 17, 2026',
    codename: 'One way in',
    summary: 'The starting search card now matches the rest of the Aireon suite, and signed-out visitors can sign in right from it.',
    items: [
      {
        kind: 'new',
        icon: 'log-in',
        text: 'The starting address search is now the suite-standard Aireon welcome card, matching doorway and woom: pick a result to jump straight into the comparison, same as before. Signed-out visitors get a new Sign in button right on the card, and search history now roams across every Aireon app. On phones, the navbar\'s own search box stays out of the way until an address is picked, so there is no more duplicate search field before you have searched.',
        prs: [],
      },
    ],
  },
  {
    version: '0.25.1',
    date: 'July 17, 2026',
    codename: 'Searches that follow you',
    summary: 'Addresses you search are now remembered across every Aireon app, even when you are not signed in.',
    items: [
      {
        kind: 'improved',
        icon: 'search',
        text: 'Your recent address searches now follow you from one Aireon app to the next while signed out. Previously each app kept its own private list, so an address looked up in one app never appeared in another. Signed in, your history already syncs to your account and across devices.',
        prs: [],
      },
    ],
  },
  {
    version: '0.25.0',
    date: 'July 17, 2026',
    codename: 'Trust, then verify',
    summary: 'similoo now ships with an automated test suite that checks the comparables API, translations, and mobile touch targets before every release.',
    items: [
      {
        kind: 'new',
        icon: 'flask-conical',
        text: 'Added an automated test suite covering the comparables and parcel API proxies, the deterministic comparables fallback, EGRID validation, the lookup cache, completeness of all four interface languages, release-notes metadata, and the mobile touch-target contract. Nothing changes on screen; every future release is now verified against these checks first.',
        prs: [],
      },
    ],
  },
  {
    version: '0.24.0',
    date: 'July 17, 2026',
    codename: 'Keep an eye on it',
    summary: 'Track the parcel you are comparing: a new Track button saves it to your Aireon parcel list, and a second click removes it again.',
    items: [
      {
        kind: 'new',
        icon: 'bookmark',
        text: 'The Comparable Buildings panel now has a Track button under the parcel EGRID. One click saves the target parcel to your suite-wide tracked list (it appears in proom and in My saved parcels across all Aireon apps); clicking Tracked removes it again. Signed-out visitors get a sign-in prompt instead, and the button remembers the tracked state when you return to a parcel.',
        prs: [],
      },
    ],
  },
  {
    version: '0.23.4',
    date: 'July 15, 2026',
    codename: 'About, made clear',
    summary: 'About similoo is easier to read and now provides a direct route to the complete Aireon application catalog.',
    items: [
      {
        kind: 'improved',
        icon: 'info',
        text: 'Redesigned the About dialog for dependable contrast, a more professional hierarchy, keyboard focus handling, mobile-safe scrolling, localized labels, and a prominent button that opens all Aireon applications in the hub.',
        prs: [],
      },
    ],
  },
  {
    version: '0.23.3',
    date: 'July 15, 2026',
    codename: 'Reach the zoom',
    summary:
      'Map controls stay reachable, and the legend starts collapsed on phones so comparable buildings remain visible.',
    items: [
      {
        kind: 'fixed',
        icon: 'bug',
        text: 'The +/−/reset-north zoom control sat underneath the "Comparable Buildings" panel the whole time it was open, making it invisible and unclickable during the app\'s main use. It now slides out from under the panel — matching the map\'s other controls — so it stays reachable, and collapses back on mobile where the panel goes full-width.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'layers',
        text: 'On phones the three-row map legend no longer floats permanently over the comparison map. It now starts as a compact Legend chip and expands only when requested, while desktop keeps the full legend visible.',
        prs: [],
      },
    ],
  },
  {
    version: '0.23.2',
    date: 'July 15, 2026',
    codename: 'On the suite map',
    summary:
      'The addresses you search in similoo now show up as recent activity on the shared Aireon suite map, like every other Aireon app.',
    items: [
      {
        kind: 'new',
        icon: 'Sparkles',
        text:
          'Searching an address now records an anonymous usage signal, so the location appears as recent activity on scoops, the suite-wide signals map. similoo now contributes its lookups like the rest of the Aireon apps.',
        prs: [],
      },
    ],
  },
  {
    version: '0.23.1',
    date: 'July 14, 2026',
    codename: 'Light means light',
    summary:
      'The account button no longer shows as a dark circle when you are signed out in light mode.',
    items: [
      {
        kind: 'fixed',
        icon: 'bug',
        text: 'When you opened similoo signed out, the account button in the navbar rendered as a high-contrast dark circle that clashed with the light theme. It now uses the same neutral scheme as every other map control: light grey in light mode, slate in dark mode.',
        prs: [],
      },
    ],
  },
  {
    version: '0.23.0',
    date: 'July 14, 2026',
    codename: 'A map with answers',
    summary:
      'Right-click anywhere on the comparison map for parcel actions, PRM saving, cross-app handoffs, sharing, and precise coordinates.',
    highlight: true,
    items: [
      {
        kind: 'new',
        icon: 'mouse-pointer-click',
        text: 'Right-click any location to open the shared Aireon map menu. Load comparable-building data there, center the map, copy coordinates or a deep link, open the same place in another Aireon app, and save the resolved cadastral parcel to PRM when signed in.',
        prs: [],
      },
    ],
  },
  {
    version: '0.22.0',
    date: 'July 14, 2026',
    codename: 'Install similoo',
    summary:
      'similoo is now an installable app you can add to your home screen or desktop, with offline-aware status and one-tap updates.',
    items: [
      {
        kind: 'new',
        icon: 'smartphone',
        text: 'Install similoo as an app: a new "Install app" option in the account menu adds it to your phone home screen or desktop, opening in its own window without the browser chrome. On iPhone and iPad a short Add-to-Home-Screen guide walks you through it.',
        prs: [94],
      },
      {
        kind: 'new',
        icon: 'cloud',
        text: 'A quiet pill now tells you when you have gone offline (and when you are back online), and a small prompt offers a one-tap refresh whenever a new version has been deployed - so you are never stuck on a stale build. Map tiles and live data are never cached, so what you see stays current.',
        prs: [94],
      },
    ],
  },
  {
    version: '0.21.5',
    date: 'July 12, 2026',
    codename: 'Lighter first load',
    summary:
      'The first page load is noticeably lighter, and the top bar fits cleanly on narrow phones.',
    items: [
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'Cut the initial-load JavaScript roughly in half: the Three.js / Giro3D point-cloud viewer and the screenshot encoder now download only when you open a building’s 3D detail or save an image, instead of on every visit.',
        prs: [92],
      },
      {
        kind: 'fixed',
        icon: 'bug',
        text: 'The top navigation no longer clips the account button off the right edge on narrow phones (~360–400px) — the address search and action icons now fit the viewport without a horizontal scroll. Desktop layout is unchanged.',
        prs: [92],
      },
    ],
  },
  {
    version: '0.21.4',
    date: 'July 12, 2026',
    codename: 'Sure-handed controls',
    summary:
      'Mobile comparison controls are easier to operate without making the dense scene UI look heavier.',
    items: [
      {
        kind: 'fixed',
        icon: 'wrench',
        text: 'Expanded the touch areas for massing sliders, presets, the floor-line switch, parcel-size inputs, EGRID copy and point-cloud actions to 44px while keeping slider tracks and icon chips visually compact. The floor-line switch no longer overflows its control row.',
        prs: [91],
      },
    ],
  },
  {
    version: '0.21.3',
    date: 'July 11, 2026',
    codename: 'Native speed',
    summary:
      'Behind the scenes: type-checking now runs on the TypeScript 7 native compiler.',
    items: [
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'Type-checking now runs on the TypeScript 7 native compiler (~10x faster).',
        prs: [90],
      },
    ],
  },
  {
    version: '0.21.2',
    date: 'July 10, 2026',
    codename: 'Steadier glow',
    summary:
      'Cleaned up a harmless but noisy map warning from the amber hover glow on comparable cards.',
    items: [
      {
        kind: 'fixed',
        icon: 'sparkles',
        text: 'Hovering a comparable card could briefly ask the map for a negative outline width or opacity on its very first animation frame, flooding the console with MapLibre errors. The glow animation is now clamped so it never dips below zero.',
        prs: [89],
      },
    ],
  },
  {
    version: '0.21.1',
    date: 'July 9, 2026',
    codename: 'A sharper account menu',
    summary:
      'The saved-parcels pipeline in your account menu is now interactive, with a needs-attention nudge and full keyboard navigation.',
    items: [
      {
        kind: 'improved',
        icon: 'search',
        text: 'Your account menu got sharper: click any pipeline stage (New, Contacted, Negotiation, Due Diligence) to jump straight to that filtered list of saved parcels, watch for a needs-attention nudge that surfaces high-priority and stale parcels, and drive the whole menu by keyboard. The account card now shows your real role too (via @aireon/shared v1.87.0).',
        prs: [],
      },
    ],
  },
  {
    version: '0.21.0',
    date: 'July 8, 2026',
    codename: 'Buildable massing',
    summary:
      'The searched parcel now opens a 3D buildable-massing simulator right in the comparison panel, so you can size up its development potential alongside the comparables.',
    items: [
      {
        kind: 'new',
        icon: 'box',
        text: 'Search a parcel to open a 3D buildable-massing simulator in the comparison panel, with floors and coverage sliders and quick tower, mid-rise, and low-rise presets.',
      },
    ],
  },
  {
    version: '0.20.0',
    date: 'July 7, 2026',
    codename: 'Full-resolution detail',
    summary:
      'The building detail view now streams the real swissSURFACE3D LiDAR point cloud, powered by the same engine as lidaroo.',
    items: [
      {
        kind: 'new',
        icon: 'box',
        text: 'Detail view, rebuilt: opening a comparable now streams the full-resolution swissSURFACE3D point cloud around the building (Giro3D, the same engine as lidaroo), with a red pin marking the building and free orbit/pan/zoom across the whole neighborhood tile.',
        prs: [85],
      },
      {
        kind: 'new',
        icon: 'palette',
        text: 'Color modes: switch the point cloud between Elevation, Classification (ground, vegetation, buildings), and Intensity coloring from the chips in the detail header.',
        prs: [85],
      },
      {
        kind: 'improved',
        icon: 'loader',
        text: 'Live preparation progress: the first visit to a new area shows the server-side tile conversion progress (about 45 seconds); areas already prepared open instantly.',
        prs: [85],
      },
    ],
  },
  {
    version: '0.19.0',
    date: 'July 6, 2026',
    codename: 'Save the view',
    summary:
      'You can now save the current map view as an image and browse the images you have saved across the Aireon suite.',
    items: [
      {
        kind: 'new',
        icon: 'camera',
        text: 'Save image: capture the current map view to your image gallery. Open "My Exports" from the map toolbar to review, open, or delete any image you have saved in an Aireon app. Updated the shared @aireon/shared library to v1.76.0.',
        prs: [],
      },
    ],
  },
  {
    version: '0.18.0',
    date: 'July 6, 2026',
    codename: 'Always Watching',
    summary:
      'similoo now captures errors automatically so problems get fixed faster, and gains opt-in session replay for support.',
    items: [
      {
        kind: 'new',
        icon: 'shield-alert',
        text: 'Automatic error capture (uncaught errors, failed requests, and resource + CSP errors) is now wired into the app, and rendering crashes are contained by a shared error boundary instead of blanking the page. Optional session replay is included but stays off until enabled. Updated the shared @aireon/shared library to v1.75.0.',
        prs: [],
      },
    ],
  },
  {
    version: '0.17.1',
    date: 'July 5, 2026',
    codename: 'Navbar theme in sync',
    summary:
      'Fixed the navbar and user menu showing the wrong theme colors on startup until the theme was toggled.',
    items: [
      {
        kind: 'fixed',
        icon: 'bug',
        text: 'When your saved account theme differed from the theme the app booted with, the navbar wordmark and the user menu could render in the opposite theme (for example a light wordmark on a dark bar) until you toggled the theme twice. The app now follows the account theme immediately after sign-in, and the comparison view switches along with it.',
        prs: [],
      },
    ],
  },
  {
    version: '0.17.0',
    date: 'July 5, 2026',
    codename: 'Tidy History',
    summary:
      'Recent searches in the navbar search box are now individually removable. Each row in the "Recent searches" dropdown has a small delete (x) button, so you can clear a single past address without wiping your whole history.',
    items: [
      {
        kind: 'improved',
        icon: 'trash-2',
        text: 'Updated the shared @aireon/shared library to v1.74.0, which adds a per-row delete (x) button to the "Recent searches" dropdown in the navbar search. Hover or focus a recent entry and click the x to remove just that entry from your history.',
        prs: [],
      },
    ],
  },
  {
    version: '0.16.0',
    date: 'July 4, 2026',
    codename: 'Spotlight',
    summary:
      'Hovering a comparable card now spotlights that parcel on the map. The whole parcel border lights up with a glowing amber outline that grows in and gently pulses, replacing the small red marker, so you can see exactly which parcel it is and how big it is at a glance.',
    items: [
      {
        kind: 'improved',
        icon: 'scan-search',
        text: 'Hover a comparable in the panel and its parcel now glows with an animated amber outline that traces the full boundary, replacing the old red pin. If the parcel sits off-screen, an amber waypoint beacon points to it instead.',
        prs: [],
      },
    ],
  },
  {
    version: '0.15.1',
    date: 'July 4, 2026',
    codename: 'Less Clutter',
    summary:
      'Removed the floating pink cube markers that sat over each comparable building on the map. They only duplicated a job the panel already does: comparables still show as pink buildings on the map, and you open the 3D point-cloud view from the cube button on each card in the panel.',
    items: [
      {
        kind: 'improved',
        icon: 'map-pin-off',
        text: 'The small pink cube markers over comparable buildings are gone. They existed mainly to open the 3D point-cloud view, which now lives on a cube button in each comparable card — so the map reads cleaner while comparables stay visible as pink buildings.',
        prs: [],
      },
    ],
  },
  {
    version: '0.15.0',
    date: 'July 4, 2026',
    codename: 'Into the Point Cloud',
    summary:
      'Open in lidaroo: jump from a building\'s 3D view to the full swissSURFACE3D point cloud in lidaroo. The 3D detail popup now carries a deep link that opens the same building, centered on the same coordinates, in the suite\'s dedicated point-cloud viewer.',
    items: [
      {
        kind: 'new',
        icon: 'external-link',
        text: 'New "Open in lidaroo" link in the 3D detail popup header. It opens lidaroo, the Aireon suite\'s Giro3D point-cloud viewer, in a new tab centered on the same building, so you can explore the full swissSURFACE3D point cloud around any comparable. Available in all four interface languages.',
        prs: [],
      },
    ],
  },
  {
    version: '0.14.0',
    date: 'July 4, 2026',
    codename: 'Search by EGRID',
    summary:
      'The navbar search now understands EGRIDs: type a Swiss parcel id like "CH80754..." and matching parcels appear at the top of the results, so you can jump straight to a building by its EGRID instead of only by address. The subject building card also gains a suite-standard identity header with the address on top and a one-click copyable EGRID chip.',
    items: [
      {
        kind: 'new',
        icon: 'search',
        text: 'Search by EGRID from the navbar. Enter a Swiss parcel id (CH followed by digits) and matching parcels are listed first, labeled with the EGRID and address; picking one loads its comparables exactly like an address search. Address search is unchanged.',
        prs: [],
      },
      {
        kind: 'new',
        icon: 'copy',
        text: 'The subject building card now leads with a parcel identity header: the searched address as the title, the municipality below it, and the EGRID as a monospace chip you can click to copy to the clipboard (with a "Copied" confirmation). This matches the shared identity header used across the Aireon suite.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'wrench',
        text: 'Updated the shared @aireon/shared library to v1.73.1, which powers the new EGRID-aware navbar search and the copyable EGRID identity header.',
        prs: [],
      },
    ],
  },
  {
    version: '0.13.12',
    date: 'July 4, 2026',
    codename: 'Jump to the Parcel',
    summary:
      'Clicking a comparable building now flies the map straight to that parcel, so you can see it in context. Opening the 3D point-cloud view moved to a dedicated cube button inside each comparable card.',
    items: [
      {
        kind: 'new',
        icon: 'map-pin',
        text: 'Click any comparable card to fly the map to that parcel and highlight it. Previously a click could only open the 3D point-cloud viewer, with no way to locate the building on the map.',
        prs: [],
      },
      {
        kind: 'improved',
        icon: 'box',
        text: 'The 3D point-cloud viewer now opens from a small cube button in the top-right of each comparable card, keeping the whole card free for the new "show on map" action.',
        prs: [],
      },
    ],
  },
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
