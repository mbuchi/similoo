import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppNavbar,
  MapUserMenu,
  NavIconButton,
  AboutModal,
  ReleaseNotesPanel,
  ShareCopiedToast,
  LAUNCH_APPS,
  openInApp,
  useGlass,
  buildGlassMenuItem,
  buildGlassSettingsItem,
  useReleaseNotes,
  getReleaseNotesStrings,
  getShareStrings,
  createErrorLogger,
  installSignalCarrier,
  ErrorLogBoundary,
  fetchClaireContext,
  MapContextMenu,
  useAuth,
  useIsMobile,
  setTheme,
  type Locale,
  type PrmLocale,
  type MapUserMenuAction,
  type AddressSearchResult,
  type MapContextMenuPoint,
  type MapContextParcel,
} from '@aireon/shared';
import {
  getThemeOverride,
  isAddressGateBypassed,
  registerUrlSyncProviders,
  syncMapUrl,
} from '@aireon/shared/url-params';
import { resolveParcelAddress } from '@aireon/shared/geoadmin';
import {
  Camera,
  ExternalLink,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Languages,
  Moon,
  Share2,
  Sun,
  Tag,
} from 'lucide-react';
import LandingView from './components/LandingView';
import { signal } from './lib/signal';
import ComparisonView from './components/ComparisonView';
import SavedImagesPanel from './components/SavedImagesPanel';
import ScreenshotOverlay from './components/ScreenshotOverlay';
import { useScreenshot } from './hooks/useScreenshot';
import { useCompactLayout } from './hooks/useCompactLayout';
import type { ScreenshotMetadata } from './lib/imageService';
import { getLocale, onLocaleChange, setLocale, applyTranslations, t } from './js/i18n.js';
// Methodology ("how comparable buildings are calculated") help panel. The
// engine still owns its Esc/hash/deep-link wiring via initMethodologyHelp();
// the navbar Help button opens it through this exported handle.
import { open as openMethodology } from './js/help/methodologyPanel.js';
// Release history, mapped to the shared <ReleaseNotesPanel> shape.
import { releases, CURRENT_VERSION, REPO_URL } from './data/releaseNotes';
// The preserved imperative engine. boot() owns all behaviour (map, Three.js
// scene, comparison sidebar/panels, address search, deep-linking). The navbar,
// theme, locale, auth, release notes and bug report are now React-owned via the
// shared suite chrome below; boot() no longer wires those.
//
// ⚠ Loaded with a DYNAMIC import in the mount effect below, deliberately. This
// module is the only path to `maplibre-gl` (~220 KB brotli, more than half of
// everything similoo used to download before it could paint), and MapLibre
// cannot construct a map until React has rendered #mapContainer anyway — so
// downloading it eagerly only starved the chunks React needed first. The map
// also lives in the comparison view, which stays `hidden` until an address is
// picked, so nothing on the first screen depends on it.
// PERFORMANCE_STANDARD.md section 3, rule 6.
// Overlay opacity (?opacity=0..100). The engine owns the controller and the
// value; this shell only reads it for the URL sync provider below, so the two
// halves never hold separate copies of the state.
import { overlayOpacityUrlValue } from './js/viewer/overlayOpacity.js';

// Compact (<1024px) account-menu shell overrides: cap the open dropdown just
// under the 3.5rem navbar so every merged row stays reachable (its own
// scrollbar takes over), and give the interactive rows the 44px touch floor.
// Applied via an arbitrary-variant wrapper so the shared MapUserMenu itself
// stays untouched; desktop keeps the plain 'contents' passthrough.
const COMPACT_USER_MENU_CLASS_NAME = [
  'contents similoo-compact-user-menu',
  '[&_.map-shell-user-dropdown]:max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px)-1rem)]',
  '[&_.map-shell-user-dropdown]:overflow-y-auto',
  '[&_.map-shell-user-button]:min-h-11',
  '[&_.map-shell-user-button]:min-w-11',
  '[&_.map-shell-user-manage]:min-h-11',
  '[&_.map-shell-user-manage]:min-w-11',
  '[&_.map-shell-user-tool-item]:min-h-11',
  '[&_.map-shell-user-menu-item]:min-h-11',
].join(' ');

/** Payload of the `similoo:search` bridge event (React shell → engine). */
interface SearchPick {
  lat: number;
  lng: number;
  label: string;
  /**
   * The parcel's EGRID, when the surface that made the pick already knows it
   * (the right-click "load parcel" menu resolves one). The engine stamps it
   * into the address bar so the URL names WHICH parcel, and falls back to the
   * parcel tile under the point when no id is offered.
   */
  egrid?: string | null;
}

async function resolveContextParcel(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<MapContextParcel | null> {
  const context = await fetchClaireContext(lng, lat, signal);
  if (!context.parcelId) return null;
  // An address belongs to a PARCEL, not to the point that was clicked.
  // fetchClaireContext hands back the first building-register entrance
  // geo.admin happens to report near the click, which can name a neighbouring
  // parcel outright and can change with the pixel clicked. Resolve it from the
  // parcel's EGRID instead, so the answer is a pure function of the parcel;
  // the resolver falls back to the nearest address only for parcels the
  // register knows no address for (roads, courtyards, farmland).
  // See aireon-shared/docs/PARCEL_ADDRESS_STANDARD.md.
  const resolved = await resolveParcelAddress({
    egrid: context.parcelId,
    lat,
    lng,
    signal,
  }).catch(() => null);
  const address = resolved?.label || undefined;
  const municipality = resolved?.city || context.municipality || '';
  return {
    parcelId: context.parcelId,
    label: address || context.parcelNumber || context.parcelId,
    municipality,
    area: 0,
    subtitle: [municipality, context.canton].filter(Boolean).join(', ') || undefined,
    address,
  };
}

export default function App() {
  // Run the imperative engine exactly once, after the React scaffold commits.
  //
  // The engine module is fetched on demand (see the import comment above), so
  // boot() now runs a network round trip later than it used to. Two knock-on
  // effects, both handled:
  //   • boot() attaches the `similoo:search` listener. A pick made before the
  //     chunk lands would be dropped, so dispatchSearch() below holds the
  //     newest one in `pendingSearch` and this effect replays it.
  //   • boot() calls applyUrlUiModes() for mode=screenshot|embed|kiosk. The
  //     shared AuthProvider calls the same idempotent applier on its own mount,
  //     which now runs first, so the chrome is still hidden before paint.
  const booted = useRef(false);
  const engineReady = useRef(false);
  const pendingSearch = useRef<SearchPick | null>(null);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void import('./js/main.js').then(({ boot }) => {
      boot();
      engineReady.current = true;
      const pick = pendingSearch.current;
      pendingSearch.current = null;
      if (pick) window.dispatchEvent(new CustomEvent('similoo:search', { detail: pick }));
    });
  }, []);

  // Single writer for `similoo:search`: dispatch straight through once the
  // engine is listening, otherwise park the pick for the boot effect to replay.
  const dispatchSearch = useCallback((detail: SearchPick) => {
    if (!engineReady.current) {
      pendingSearch.current = detail;
      return;
    }
    window.dispatchEvent(new CustomEvent('similoo:search', { detail }));
  }, []);

  // --- Navbar address search ↔ engine bridge ------------------------------
  // similoo now uses the shared navbar address search (the suite standard) in
  // place of the old in-view "Search again" bar. Two tiny window-event hops keep
  // the imperative engine and this React shell in sync without coupling them:
  //   • engine → React: `similoo:address` carries the active parcel's label so
  //     the search box can surface it (as placeholder text) once a parcel loads.
  //   • React → engine: a navbar pick dispatches `similoo:search` with the
  //     {lat,lng,label}, which boot()'s handler feeds straight into handlePick —
  //     the same flow the landing search drives.
  const [currentAddress, setCurrentAddress] = useState('');
  // Suite welcome-card standard (spec §5): on phones the navbar search would sit
  // right above the landing card's own search — hide the navbar one until an
  // address is picked. `currentAddress` is the reliable "landing dismissed"
  // signal (unlike `openWithLocation`, it is correctly seeded from
  // `window.__similooAddress` for a ?lat/?lng deep-link that resolves before the
  // `similoo:address` listener below attaches — see that effect's comment).
  // Desktop keeps the navbar search visible at all times (plenty of room).
  const isMobile = useIsMobile();
  // ?search_modal=off / ?welcome=off: the engine skips the landing view and
  // opens the map targetless, so on a phone there is no card search to stack
  // against — and suppressing the navbar box would leave the visitor with no
  // way to search at all. Render-constant, so read it once.
  const gateBypassed = useMemo(() => isAddressGateBypassed(), []);
  const [openWithLocation, setOpenWithLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [contextMenuPoint, setContextMenuPoint] = useState<MapContextMenuPoint | null>(null);
  const [contextParcel, setContextParcel] = useState<MapContextParcel | null>(null);
  const contextParcelAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    // Catch up on an address the engine may have set before this listener
    // attached (e.g. a ?lat/?lng deep-link resolved during boot()).
    const seeded = (window as { __similooAddress?: string }).__similooAddress;
    if (seeded) setCurrentAddress(seeded);
    const onAddress = (e: Event) => {
      const detail = (e as CustomEvent<{ label?: string; lat?: number; lng?: number }>).detail;
      const label = detail?.label ?? '';
      setCurrentAddress(label);
      // Track lat/lng for the "Open with" menu whenever the engine picks a location.
      if (Number.isFinite(detail?.lat) && Number.isFinite(detail?.lng)) {
        setOpenWithLocation({ lat: detail!.lat!, lng: detail!.lng! });
      }
    };
    window.addEventListener('similoo:address', onAddress);
    return () => window.removeEventListener('similoo:address', onAddress);
  }, []);
  useEffect(() => {
    const onMapContext = (event: Event) => {
      const point = (event as CustomEvent<MapContextMenuPoint>).detail;
      if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
      contextParcelAbortRef.current?.abort();
      const controller = new AbortController();
      contextParcelAbortRef.current = controller;
      setContextParcel(null);
      setContextMenuPoint(point);
      void resolveContextParcel(point.lat, point.lng, controller.signal)
        .then((parcel) => {
          if (!controller.signal.aborted) setContextParcel(parcel);
        })
        .catch(() => {
          if (!controller.signal.aborted) setContextParcel(null);
        });
    };
    window.addEventListener('similoo:map-context', onMapContext);
    return () => {
      window.removeEventListener('similoo:map-context', onMapContext);
      contextParcelAbortRef.current?.abort();
    };
  }, []);
  const closeContextMenu = useCallback(() => {
    contextParcelAbortRef.current?.abort();
    contextParcelAbortRef.current = null;
    setContextMenuPoint(null);
    setContextParcel(null);
  }, []);
  const handleNavSearch = useCallback((r: AddressSearchResult) => {
    void signal.send('Address search', { address: r.label, lat: r.lat, lng: r.lng });
    dispatchSearch({ lat: r.lat, lng: r.lng, label: r.label });
  }, [dispatchSearch]);

  // --- Theme bridge -------------------------------------------------------
  // The suite chrome themes off the `.dark` class; similoo's bespoke CSS +
  // engine theme off `[data-theme="dark"]`. React owns the toggle and mirrors
  // BOTH so they always flip together. Seeded from the pre-paint bootstrap in
  // index.html (which reads the `similoo-theme` choice and sets data-theme).
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );
  // `?theme=dark|light` (URL_PARAMS_STANDARD.md) must never persist. The
  // effect below runs on mount too (not just on later toggles), and by then
  // `data-theme` already carries the override (index.html's pre-paint script
  // + main.tsx's applyTheme() call both consult it before this component
  // renders) — so the very first run would otherwise write that overridden
  // value into localStorage and the shared cookie, clobbering the visitor's
  // real preference. Skip exactly that one run (taxoo useTheme skip-persist
  // precedent); any later user-driven toggleTheme() persists normally.
  const skipThemePersistRef = useRef(Boolean(getThemeOverride()));
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    root.classList.toggle('dark', isDark);
    if (skipThemePersistRef.current) {
      skipThemePersistRef.current = false;
      return;
    }
    try {
      localStorage.setItem('similoo-theme', isDark ? 'dark' : 'light');
    } catch {
      /* private mode — ignore */
    }
    // Also persist into the suite-wide theme cookie so the choice roams across
    // Aireon apps (the shared chrome's standard behaviour).
    try {
      setTheme(isDark ? 'dark' : 'light');
    } catch {
      /* no-op */
    }
  }, [isDark]);
  // Keep `isDark` in lockstep with the `<html>.dark` class. The shared
  // MapUserMenu hydrates the signed-in user's profile after mount and calls
  // adoptStoredTheme(), which toggles the class directly — bypassing our state.
  // Syncing state re-runs the mirror effect above, so `data-theme` (the engine
  // + bespoke CSS) follows too.
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => setIsDark(html.classList.contains('dark'));
    sync(); // catch a class flip between the initial useState and this effect
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);

  // --- Liquid Glass appearance level (0 Off · 1 Frosted · 2 Liquid) -------
  const { level: glassLevel, setLevel: setGlassLevel } = useGlass();
  useEffect(() => {
    document.documentElement.setAttribute('data-glass', String(glassLevel));
  }, [glassLevel]);

  // --- Locale bridge ------------------------------------------------------
  // Mirror the imperative i18n locale into React so the shared chrome's labels
  // re-render on language change; driving the toolbar's switcher calls back into
  // the engine's setLocale() + re-translates the engine-owned DOM.
  const [locale, setLocaleState] = useState<Locale>(getLocale() as Locale);
  useEffect(() => {
    const unsubscribe = onLocaleChange((next: string) => setLocaleState(next as Locale));
    return () => {
      unsubscribe();
    };
  }, []);
  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
    applyTranslations(document);
  }, []);

  // --- State to URL write-back (URL_PARAMS_STANDARD.md section 4) ---------
  // Mirror the state a copied link should reproduce into the query string, so
  // a shared similoo URL reopens the same language and appearance, not just
  // the same coordinates. Registered once on mount; the getters read live
  // sources (i18n.js owns the locale, a ref mirrors the theme) so the
  // providers never see a stale closure. Every updateMapUrl() call in the
  // engine then stamps these values alongside lat/lng/zoom.
  //
  // Deliberately NOT registered: `basemap` (similoo has one hardcoded
  // swisstopo SWISSIMAGE raster, no picker, and no id the shared basemap
  // registry would accept back) and `view`/`pitch`/`bearing` (the camera is
  // permanently tilted at pitch 50 / bearing -25, so there is no 2D/3D mode
  // state to switch them off in).
  //
  // `opacity` IS registered, reading the engine-owned value. There is no
  // slider (that needs a BasemapPicker similoo does not have), so the getter
  // returns whatever `?opacity=` was opened with, and null at the default 100
  // so an ordinary link never carries the parameter.
  //
  // Write-back is read-only against app state: it never calls setLocale(),
  // never touches the theme skip-persist guard above, and persists nothing.
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  useEffect(() => {
    registerUrlSyncProviders({
      lang: () => getLocale() as string,
      theme: () => (isDarkRef.current ? 'dark' : 'light'),
      opacity: () => overlayOpacityUrlValue(),
    });
  }, []);
  // Re-stamp on the state changes that happen without moving the map: a
  // language switch, a theme toggle, or the cross-app theme the shared
  // MapUserMenu adopts through the `<html>.dark` observer above. This is a
  // separate effect on purpose - the theme mirror effect returns early on its
  // first run to protect the `?theme=` skip-persist guard, which would
  // swallow the mount sync.
  useEffect(() => {
    syncMapUrl();
  }, [locale, isDark]);

  // --- Account / chrome state --------------------------------------------
  const { email, isAuthenticated, getAccessToken, promptLogin, status: authStatus, login } = useAuth();
  // Engine → React sign-in hop: the imperative comparison sidebar's Track
  // (save to PRM) button dispatches `similoo:login` when a signed-out user
  // clicks it, and we open the shared login modal — the same window-event
  // bridge pattern the address search uses.
  useEffect(() => {
    const onLoginRequest = () => promptLogin();
    window.addEventListener('similoo:login', onLoginRequest);
    return () => window.removeEventListener('similoo:login', onLoginRequest);
  }, [promptLogin]);
  const errorLogger = useMemo(() => createErrorLogger({ appName: 'similoo' }), []);
  // Attach the global capture listeners once. Until now this logger only powered
  // the navbar-search onError and the bug-report dialog — nothing hooked the
  // automatic sources. install() wires uncaught errors, promise rejections and
  // (per the logger's default flags) failed resource loads, CSP violations and
  // fetch failures. It is idempotent and returns an uninstall function used as
  // the effect cleanup.
  useEffect(() => {
    const uninstallLogger = errorLogger.install({ captureConsoleErrors: true });
    // Signal carrier transport (aireon-shared/docs/SIGNAL_STANDARD.md). Usage
    // signals used to be one `POST /api/signal-collect` per user action. The
    // carrier queues them in memory instead and flushes the queue once, on page
    // hide, to the neutrally named `/api/ctx` mount. Same payload, same fields,
    // same destination handler — only the transport changes.
    //
    // ⚠ ORDER IS LOAD-BEARING: this must install AFTER errorLogger.install(),
    // because the logger patches window.fetch and the carrier has to be the
    // OUTER patch. Both installers are idempotent and return an uninstall
    // function, so StrictMode's double invoke is safe; tear down in reverse.
    //
    // No `paths` here on purpose: ride-along (attaching the queue to an
    // existing app request) is decided per app later. Batching alone is the
    // point of this change.
    const uninstallCarrier = installSignalCarrier({ paths: ['/api/similoo'], endpoint: '/api/ctx' });
    return () => {
      uninstallCarrier();
      uninstallLogger();
    };
  }, [errorLogger]);
  const rn = useReleaseNotes({
    currentVersion: CURRENT_VERSION,
    storageKey: 'similoo:lastSeenReleaseVersion',
  });
  const [showAbout, setShowAbout] = useState(false);

  // --- Save image + gallery (shared RES image service) --------------------
  // "Save image" captures the current map view (html-to-image → WebP) and
  // uploads it to the shared RES gallery; "My Exports" opens the SavedImagesPanel
  // (cross-app list + delete). Metadata is read best-effort off the live MapLibre
  // map the engine exposes as `window.__similooMap`.
  const [galleryOpen, setGalleryOpen] = useState(false);
  const getCaptureMetadata = useCallback((): ScreenshotMetadata => {
    const meta: ScreenshotMetadata = {};
    const map = (window as unknown as {
      __similooMap?: {
        getCenter?: () => { lat: number; lng: number };
        getZoom?: () => number;
        getBearing?: () => number;
        getPitch?: () => number;
      };
    }).__similooMap;
    if (map && typeof map.getCenter === 'function') {
      try {
        const c = map.getCenter();
        meta.central_lat = c.lat;
        meta.central_lng = c.lng;
        if (typeof map.getZoom === 'function') meta.zoom = map.getZoom();
        if (typeof map.getBearing === 'function') meta.bearing_degree = map.getBearing();
        if (typeof map.getPitch === 'function') meta.tilt_degree = map.getPitch();
        // similoo renders LOD 2.5 building cubes on the swisstopo SWISSIMAGE
        // satellite basemap; both are constant for this app.
        meta.basemap = 'satellite';
        meta.is_3d_mode = true;
      } catch {
        /* map not ready yet — best-effort snapshot */
      }
    }
    if (currentAddress) meta.address = currentAddress;
    return meta;
  }, [currentAddress]);
  const { capture, isCapturing, notice } = useScreenshot(getCaptureMetadata);

  // "Share this view" — copy the URL, flash the suite "Link copied" pill.
  const [shareCopied, setShareCopied] = useState(false);
  const handleShare = useCallback(() => {
    const flash = () => {
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    };
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(flash).catch(flash);
    } else {
      flash();
    }
  }, []);

  const shareStrings = getShareStrings(locale);
  const glassSettingsItem = buildGlassSettingsItem({ level: glassLevel, setLevel: setGlassLevel, locale });

  // Compact (<1024px) suite layout: the navbar collapses to wordmark + search +
  // ONE account menu. Every control the desktop bar spreads across the
  // MapToolbar and the actionsExtra icon cluster folds into that menu below.
  const isCompact = useCompactLayout();

  // Rows that only exist at compact widths — each one mirrors a control removed
  // from the navbar: Open with (cross-app launcher), How it works (methodology
  // help icon), Save image / My Exports + Language + appearance (MapToolbar).
  // All stay available signed-out, exactly as the desktop toolbar exposed them.
  const compactMenuItems: MapUserMenuAction[] = [
    ...(openWithLocation
      ? [
          {
            key: 'open-with',
            label: t('nav.open_with'),
            icon: <ExternalLink size={16} aria-hidden="true" />,
            signedOut: true,
            children: LAUNCH_APPS.filter((app) => app.id !== 'similoo').map((app) => ({
              key: `open-with-${app.id}`,
              label: app.name,
              onClick: () => openInApp(app.id, openWithLocation.lat, openWithLocation.lng, 17),
            })),
          } as MapUserMenuAction,
        ]
      : []),
    {
      key: 'methodology',
      label: t('help.eyebrow'),
      icon: <HelpCircle size={16} aria-hidden="true" />,
      onClick: openMethodology,
      signedOut: true,
    },
    {
      key: 'capture',
      label: t('screenshot.save'),
      icon: <Camera size={16} aria-hidden="true" />,
      onClick: () => void capture(),
      disabled: isCapturing,
      signedOut: true,
    },
    {
      key: 'exports',
      label: t('screenshot.my_exports'),
      icon: <ImageIcon size={16} aria-hidden="true" />,
      onClick: () => setGalleryOpen(true),
      signedOut: true,
    },
    {
      key: 'language',
      label: t('nav.select_language'),
      icon: <Languages size={16} aria-hidden="true" />,
      signedOut: true,
      children: (['en', 'fr', 'de', 'it'] as const).map((language) => ({
        key: `language-${language}`,
        label: language.toUpperCase(),
        badge: locale === language ? '✓' : undefined,
        onClick: () => changeLocale(language),
        keepOpenOnClick: true,
      })),
    },
    buildGlassMenuItem({ level: glassLevel, setLevel: setGlassLevel, locale }),
  ];

  // Suite welcome-card standard (spec §2): sign-in affordance on the landing
  // card, signed-out visitors only. `status === 'anonymous'` (not
  // `!isAuthenticated`) avoids a flash during the silent-SSO 'loading' state;
  // login() starts the redirect flow directly, per the shared card's contract.
  const welcomeSignIn =
    authStatus === 'anonymous'
      ? { label: t('auth.sign_in'), hint: t('auth.sign_in_hint'), onClick: () => void login() }
      : undefined;

  // Account-menu "More tools" — Share · Theme · What's new · About, the suite
  // declutter pattern (these moved OUT of the navbar into the account menu).
  // Compact mode prepends every action removed from the navbar above them.
  const toolbarItems: MapUserMenuAction[] = [
    ...(isCompact ? compactMenuItems : []),
    {
      key: 'share',
      label: shareStrings.share,
      icon: <Share2 size={16} aria-hidden="true" />,
      onClick: handleShare,
      signedOut: true,
    },
    {
      key: 'theme',
      label: isDark ? t('nav.theme_to_light') : t('nav.theme_to_dark'),
      icon: isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />,
      onClick: toggleTheme,
      signedOut: true,
      keepOpenOnClick: true,
    },
    {
      key: 'changes',
      label: getReleaseNotesStrings(locale).whatsNew,
      icon: <Tag size={16} aria-hidden="true" />,
      dot: rn.hasUnread,
      onClick: rn.openPanel,
      signedOut: true,
    },
    {
      key: 'about',
      label: t('about.menu'),
      icon: <Info size={16} aria-hidden="true" />,
      onClick: () => setShowAbout(true),
      signedOut: true,
    },
  ];

  return (
    <ErrorLogBoundary logger={errorLogger} darkMode={isDark}>
      <AppNavbar
        appName="similoo"
        dark={isDark}
        hideHubLink={isCompact}
        position="fixed top-0 left-0 right-0 z-40 md:z-[60]"
        // Suite-standard navbar address search (replaces the old in-view "Search
        // again" bar). A pick drives the engine's comparison flow via the
        // window-event bridge above; once a parcel is loaded its address shows as
        // the box's placeholder so the user can see — and re-search from — it.
        // On phones, while the welcome-card landing is still showing, this box
        // would duplicate the card's own search right below it — omit `search`
        // (the documented way to hide the box) until an address is picked; it
        // returns immediately afterward for re-searching (spec §5). Desktop has
        // room for both, so it always shows.
        search={
          isMobile && !currentAddress && !gateBypassed
            ? undefined
            : {
                locale,
                activeAddress: currentAddress || null,
                onSelect: handleNavSearch,
                onError: (err) => errorLogger.capture(err, { severity: 'warning', source: 'navbar-search' }),
                labels: {
                  placeholder: currentAddress || t('nav.search_placeholder'),
                  loading: t('nav.search_loading'),
                  noResults: t('nav.search_no_results'),
                  clear: t('nav.clear_search'),
                  resultsCount: (n) => t('nav.search_results_count', { count: n }),
                },
              }
        }
        openWith={isCompact ? undefined : {
          currentAppId: 'similoo',
          location: openWithLocation,
          locale,
          label: t('nav.open_with'),
          zoom: 17,
          placement: 'search',
          defaultTargetAppId: 'similoo',
        }}
        // Map action cluster: Save image + My Exports (shared RES gallery),
        // the Settings gear (Liquid Glass picker) + Language switcher. similoo
        // has no locate button, so that action auto-hides (handler omitted).
        // Below 1024px the whole cluster folds into the account menu instead.
        toolbar={isCompact ? undefined : {
          locale,
          onLocaleChange: changeLocale,
          onCapture: capture,
          isCapturing,
          onShowImages: () => setGalleryOpen(true),
          settingsItems: [glassSettingsItem],
          labels: {
            saveImage: t('screenshot.save'),
            myImages: t('screenshot.my_exports'),
            toggleLight: t('nav.theme_to_light'),
            toggleDark: t('nav.theme_to_dark'),
            locateMe: t('nav.locate_me'),
            settings: t('nav.settings'),
            settingsComingSoon: t('nav.settings_coming_soon'),
            selectLanguage: t('nav.select_language'),
            more: t('menu.more_tools'),
          },
        }}
        actionsExtra={isCompact ? undefined :
          <div className="flex items-center gap-2 sm:gap-3">
            <NavIconButton
              icon={<HelpCircle size={18} aria-hidden="true" />}
              label={t('help.button_aria')}
              onClick={openMethodology}
              dark={isDark}
            />
            <NavIconButton
              icon={<Info size={18} aria-hidden="true" />}
              label={t('about.menu')}
              onClick={() => setShowAbout(true)}
              dark={isDark}
            />
          </div>
        }
        userMenu={
          <div className={isCompact ? COMPACT_USER_MENU_CLASS_NAME : 'contents'}>
            <MapUserMenu
              appId="similoo"
              dark={isDark}
              locale={locale as PrmLocale}
              // similoo is a comparison tool — no saved-parcels / search-history
              // surfaces, so suppress those built-in rows.
              showSavedParcels={false}
              showSearchHistory={false}
              toolbarItems={toolbarItems}
              toolbarLabel={t('menu.more_tools')}
              bugReport={{ logger: errorLogger, email: email ?? undefined, metaData: { rollout: 'suite-ui-parity' } }}
              labels={{
                signIn: t('auth.sign_in'),
                userMenu: t('auth.account'),
                viewProfile: t('auth.view_profile'),
                savedParcels: t('menu.saved_parcels'),
                signOut: t('auth.sign_out'),
                active: t('menu.active'),
                fallbackUser: t('menu.user'),
              }}
            />
          </div>
        }
      />

      <LandingView
        dark={isDark}
        locale={locale}
        glassLevel={glassLevel}
        onSelect={handleNavSearch}
        signIn={welcomeSignIn}
      />
      <ComparisonView dark={isDark} locale={locale} />

      <MapContextMenu
        open={contextMenuPoint !== null}
        point={contextMenuPoint}
        parcel={contextParcel}
        currentAppId="similoo"
        locale={locale}
        darkMode={isDark}
        auth={{ isAuthenticated, getAccessToken, promptLogin }}
        loadLabel={t('context.load_label')}
        loadHint={t('context.load_hint')}
        onLoadParcel={(point, parcel) => {
          // The context menu only opens on a right-click over a live map, so
          // the engine is always up by here; routed through dispatchSearch
          // anyway so there is exactly one writer of this event.
          dispatchSearch({
            lat: point.lat,
            lng: point.lng,
            label: parcel?.label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
            // The menu already resolved the parcel under the click, so the
            // address bar can name it from the first write instead of waiting
            // for the engine to re-probe the tile.
            egrid: parcel?.parcelId ?? null,
          });
        }}
        onCenterMap={(point) => {
          window.dispatchEvent(new CustomEvent('similoo:center', { detail: point }));
        }}
        onClose={closeContextMenu}
      />

      {showAbout && (
        <AboutModal
          wordmark={
            <>
              simil<span className="text-red-600">oo</span>
            </>
          }
          description={t('about.description')}
          aboutLabel={t('about.label')}
          creditsLabel={t('about.credits')}
          hubLabel={t('about.hub')}
          credits={[
            // Basemap is the swisstopo SWISSIMAGE orthophoto mosaic (see
            // viewerConfig.js SWISSIMAGE_ATTRIBUTION) — credit swisstopo here
            // since the on-map attribution control is off.
            { label: t('about.map_data'), name: '© swisstopo', href: 'https://www.swisstopo.admin.ch/' },
            { label: t('about.renderer'), name: 'MapLibre GL · Three.js', href: 'https://maplibre.org' },
            { label: t('about.data'), name: 'Parcels © swisstopo · Buildings GWR', href: 'https://www.housing-stat.ch' },
          ]}
          closeLabel={t('common.close')}
          glassLevel={glassLevel}
          dark={isDark}
          locale={locale}
          onClose={() => setShowAbout(false)}
        />
      )}

      {rn.isOpen && (
        <ReleaseNotesPanel
          onClose={rn.closePanel}
          locale={locale}
          releases={releases}
          repoUrl={REPO_URL}
          brandPrefix="simil"
          brandSuffix=""
          dark={isDark}
          glassLevel={glassLevel}
        />
      )}

      <ShareCopiedToast show={shareCopied} label={shareStrings.copied} dark={isDark} />

      {/* Save image + gallery. The overlay shows during capture; the panel is
          the cross-app "My Exports" gallery. similoo has no toast context, so
          capture success/failure is flashed through the same shared pill used
          for "Link copied". */}
      <SavedImagesPanel darkMode={isDark} isOpen={galleryOpen} onClose={() => setGalleryOpen(false)} />
      <ScreenshotOverlay isCapturing={isCapturing} darkMode={isDark} />
      <ShareCopiedToast show={!!notice} label={notice ?? ''} dark={isDark} />

    </ErrorLogBoundary>
  );
}
