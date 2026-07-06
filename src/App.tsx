import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppNavbar,
  MapUserMenu,
  NavIconButton,
  AboutModal,
  ReleaseNotesPanel,
  ShareCopiedToast,
  OpenWithMenu,
  useGlass,
  buildGlassSettingsItem,
  useReleaseNotes,
  getReleaseNotesStrings,
  getShareStrings,
  createErrorLogger,
  ErrorLogBoundary,
  useAuth,
  setTheme,
  type Locale,
  type PrmLocale,
  type MapUserMenuAction,
  type AddressSearchResult,
} from '@aireon/shared';
import { HelpCircle, Info, Share2, Sun, Moon, Tag } from 'lucide-react';
import LandingView from './components/LandingView';
import ComparisonView from './components/ComparisonView';
import SavedImagesPanel from './components/SavedImagesPanel';
import ScreenshotOverlay from './components/ScreenshotOverlay';
import { useScreenshot } from './hooks/useScreenshot';
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
  const handleNavSearch = useCallback((r: AddressSearchResult) => {
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
  const { email } = useAuth();
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

  // Account-menu "More tools" — Share · Theme · What's new · About, the suite
  // declutter pattern (these moved OUT of the navbar into the account menu).
  const toolbarItems: MapUserMenuAction[] = [
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
        toolbar={{
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
        actionsExtra={
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
        }
      />

      <LandingView />
      <ComparisonView dark={isDark} locale={locale} />

      {showAbout && (
        <AboutModal
          wordmark={
            <>
              simil<span className="text-red-600">oo</span>
            </>
          }
          description={t('about.description')}
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
    </ErrorLogBoundary>
  );
}
