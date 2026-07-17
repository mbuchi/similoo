import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppNavbar,
  MapUserMenu,
  NavIconButton,
  AboutModal,
  ReleaseNotesPanel,
  ShareCopiedToast,
  OpenWithMenu,
  LAUNCH_APPS,
  openInApp,
  useGlass,
  buildGlassMenuItem,
  buildGlassSettingsItem,
  useReleaseNotes,
  getReleaseNotesStrings,
  getShareStrings,
  createErrorLogger,
  ErrorLogBoundary,
  fetchClaireContext,
  MapContextMenu,
  useAuth,
  setTheme,
  type Locale,
  type PrmLocale,
  type MapUserMenuAction,
  type AddressSearchResult,
  type MapContextMenuPoint,
  type MapContextParcel,
} from '@aireon/shared';
import { useInstallPrompt, IosInstallSheet } from '@aireon/shared/pwa';
import {
  Camera,
  Download,
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
import PwaLayer from './pwa/PwaLayer';
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
import { boot } from './js/main.js';

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

async function resolveContextParcel(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<MapContextParcel | null> {
  const context = await fetchClaireContext(lng, lat, signal);
  if (!context.parcelId) return null;
  const municipality = context.municipality
    || context.address?.split(',').pop()?.trim().replace(/^\d{4}\s+/, '')
    || '';
  return {
    parcelId: context.parcelId,
    label: context.address || context.parcelNumber || context.parcelId,
    municipality,
    area: 0,
    subtitle: [municipality, context.canton].filter(Boolean).join(', ') || undefined,
  };
}

export default function App() {
  // Run the imperative engine exactly once, after the React scaffold commits.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    boot();
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
    window.dispatchEvent(
      new CustomEvent('similoo:search', {
        detail: { lat: r.lat, lng: r.lng, label: r.label },
      }),
    );
  }, []);

  // --- Theme bridge -------------------------------------------------------
  // The suite chrome themes off the `.dark` class; similoo's bespoke CSS +
  // engine theme off `[data-theme="dark"]`. React owns the toggle and mirrors
  // BOTH so they always flip together. Seeded from the pre-paint bootstrap in
  // index.html (which reads the `similoo-theme` choice and sets data-theme).
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    root.classList.toggle('dark', isDark);
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

  // --- Account / chrome state --------------------------------------------
  const { email, isAuthenticated, getAccessToken, promptLogin } = useAuth();
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
  useEffect(() => errorLogger.install({ captureConsoleErrors: true }), [errorLogger]);
  const rn = useReleaseNotes({
    currentVersion: CURRENT_VERSION,
    storageKey: 'similoo:lastSeenReleaseVersion',
  });
  const [showAbout, setShowAbout] = useState(false);

  // --- Installable PWA ----------------------------------------------------
  // The account menu gains an "Install app" row only when the browser can
  // install: Chromium fires a native prompt (promptInstall), iOS Safari has no
  // prompt API so we show the manual Add-to-Home-Screen sheet. Already-installed
  // / unsupported browsers get no row. The offline pill + prompt-to-update toast
  // live in <PwaLayer /> below.
  const { availability: installAvailability, promptInstall } = useInstallPrompt();
  const [showInstallSheet, setShowInstallSheet] = useState(false);
  const canInstall =
    installAvailability === 'native-prompt' || installAvailability === 'ios-manual';

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
        // similoo renders LOD 2.5 building cubes on an ArcGIS World Imagery
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
              onClick: () => openInApp(app.id, openWithLocation.lat, openWithLocation.lng),
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

  // Account-menu "More tools" — Share · Theme · What's new · About, the suite
  // declutter pattern (these moved OUT of the navbar into the account menu).
  // Compact mode prepends every action removed from the navbar above them.
  const toolbarItems: MapUserMenuAction[] = [
    ...(isCompact ? compactMenuItems : []),
    ...(canInstall
      ? [
          {
            key: 'install',
            label: t('pwa.install_app'),
            icon: <Download size={16} aria-hidden="true" />,
            onClick: () => {
              if (installAvailability === 'native-prompt') void promptInstall();
              else setShowInstallSheet(true);
            },
            signedOut: true,
          } as MapUserMenuAction,
        ]
      : []),
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
        search={{
          locale,
          onSelect: handleNavSearch,
          onError: (err) => errorLogger.capture(err, { severity: 'warning', source: 'navbar-search' }),
          labels: {
            placeholder: currentAddress || t('nav.search_placeholder'),
            loading: t('nav.search_loading'),
            noResults: t('nav.search_no_results'),
            clear: t('nav.clear_search'),
            resultsCount: (n) => t('nav.search_results_count', { count: n }),
          },
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
            {openWithLocation && (
              <OpenWithMenu
                location={openWithLocation}
                currentAppId="similoo"
                dark={isDark}
                label={t('nav.open_with')}
              />
            )}
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

      <LandingView />
      <ComparisonView dark={isDark} locale={locale} />

      <MapContextMenu
        open={contextMenuPoint !== null}
        point={contextMenuPoint}
        parcel={contextParcel}
        currentAppId="similoo"
        locale={locale}
        darkMode={isDark}
        auth={{ isAuthenticated, getAccessToken, promptLogin }}
        onLoadParcel={(point, parcel) => {
          window.dispatchEvent(new CustomEvent('similoo:search', {
            detail: {
              lat: point.lat,
              lng: point.lng,
              label: parcel?.label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
            },
          }));
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
            // Basemap is the ArcGIS World Imagery satellite mosaic (see
            // viewerConfig.js ARCGIS_ATTRIBUTION) — credit Esri here since the
            // on-map attribution control is now off.
            { label: t('about.map_data'), name: '© Esri · Maxar · Earthstar Geographics', href: 'https://www.esri.com/' },
            { label: t('about.renderer'), name: 'MapLibre GL · Three.js', href: 'https://maplibre.org' },
            { label: t('about.data'), name: 'Parcels © swisstopo · Buildings GWR', href: 'https://www.housing-stat.ch' },
          ]}
          closeLabel={t('common.close')}
          glassLevel={glassLevel}
          dark={isDark}
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

      {/* Installable-PWA chrome: offline pill + prompt-to-update toast (always
          mounted), and the iOS Add-to-Home-Screen walkthrough (opened from the
          account menu's "Install app" row on iOS Safari). */}
      <PwaLayer />
      {showInstallSheet && (
        <IosInstallSheet
          open
          onClose={() => setShowInstallSheet(false)}
          dark={isDark}
          labels={{
            title: t('pwa.install_title'),
            stepShare: t('pwa.ios_step_share'),
            stepAdd: t('pwa.ios_step_add'),
            stepConfirm: t('pwa.ios_step_confirm'),
          }}
        />
      )}
    </ErrorLogBoundary>
  );
}
