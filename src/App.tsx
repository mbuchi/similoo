import { useEffect, useRef, useState } from 'react';
import { AppNavbar, SettingsMenu, useGlass, buildGlassSettingsItem } from '@aireon/shared';
import LandingView from './components/LandingView';
import ComparisonView from './components/ComparisonView';
import { getLocale, onLocaleChange, t } from './js/i18n.js';
// The preserved imperative engine. boot() owns all behaviour (map, Three.js
// scene, comparison sidebar/panels, address search, deep-linking, theme/locale/
// overflow navbar wiring, auth, bug report). It binds to the static DOM that the
// components below render — same ids/classes as the old vanilla index.html.
import { boot } from './js/main.js';

export default function App() {
  // Run the engine exactly once, after the scaffold is committed to the DOM.
  // React 18 StrictMode double-invokes effects in dev; the ref guard keeps the
  // imperative engine from booting twice (it isn't idempotent on its own).
  const booted = useRef(false);

  // Liquid Glass appearance level (0 Off · 1 Frosted · 2 Liquid), persisted
  // suite-wide via the shared cookie by GlassProvider in main.tsx.
  const { level: glassLevel, setLevel: setGlassLevel } = useGlass();

  // Mirror the imperative i18n locale into React so the glass picker's labels
  // localise and re-render when the language switches.
  const [locale, setLocaleState] = useState(getLocale());

  // Track the current theme so the settings-gear popover renders dark in dark
  // mode. similoo flips `<html data-theme="dark|light">` imperatively
  // (setupThemeToggle in src/js/main.js); we observe that attribute.
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    boot();
  }, []);

  // Keep the React-side locale in sync with the imperative i18n engine (the
  // navbar's <select id="locale-select"> drives setLocale() in src/js/i18n.js).
  // `onLocaleChange` returns an unsubscribe fn; wrap it so the effect cleanup
  // returns void (the raw unsubscribe returns Set.delete's boolean).
  useEffect(() => {
    const unsubscribe = onLocaleChange((next: string) => setLocaleState(next));
    return () => {
      unsubscribe();
    };
  }, []);

  // Stamp the glass level onto <html> — the SAME element that carries the theme.
  // The shared glass.css resolves its `--glass-*` tokens off `data-glass`
  // (and `.dark[data-glass]` for the dark variants), so panels that render
  // outside the React tree (the imperative comparison panel/modals) and any
  // portalled chrome all pick the tokens up. No-op visual at level 0.
  useEffect(() => {
    document.documentElement.setAttribute('data-glass', String(glassLevel));
  }, [glassLevel]);

  // similoo themes via `<html data-theme>`, but the shared glass.css keys its
  // dark tokens on a `.dark` class (`.dark[data-glass='N']`). Mirror a `.dark`
  // class onto <html> whenever the theme is dark so those tokens resolve, and
  // keep the gear popover's `dark` state in sync. The class is inert for
  // similoo's own CSS (which keys on `[data-theme="dark"]`); only glass.css
  // reads it. The pre-paint bootstrap in index.html applies it before first
  // paint, so glassed surfaces never flash light on reload. This observer keeps
  // it correct after every runtime theme toggle.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const dark = root.getAttribute('data-theme') === 'dark';
      root.classList.toggle('dark', dark);
      setIsDark(dark);
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  // The Glass-effect picker for the navbar settings gear (Off · Frosted ·
  // Liquid). Localised via the React-mirrored locale.
  const glassSettingsItem = buildGlassSettingsItem({
    level: glassLevel,
    setLevel: setGlassLevel,
    locale,
  });

  // similoo's top bar is the suite-shared <AppNavbar> (hub badge + simil/red-oo
  // wordmark + the bar shell). AppNavbar renders ONLY the brand and shell; the
  // app's own id-bearing controls are carried into its slots with their ids,
  // classes and data-i18n attributes INTACT, so the preserved imperative engine
  // keeps binding to them by getElementById/querySelector exactly as before:
  //   * actionsExtra → the ⋯ overflow toggle (#navOverflowToggle) + the action
  //     cluster (#navbarActions) containing help (#helpButton), theme
  //     (#themeToggleButton) and locale (#locale-select). setupOverflowMenu()
  //     and setupThemeToggle() in src/js/main.js still find them by id.
  //   * actionsExtra also hosts a stable .navbar-brand / .logo-subtitle anchor
  //     so initReleaseNotes() (which does document.querySelector('.navbar-brand')
  //     and inserts its version button before .logo-subtitle) keeps working now
  //     that AppNavbar owns the real brand markup.
  //   * userMenu → the #authNav mount, into which shared auth injects the
  //     sign-in / profile dropdown (document.getElementById('authNav')).
  // The address search lives in the landing view, not the navbar, so no
  // centerSlot is used. The map / Three.js scene, comparison sidebar and legend
  // are untouched.
  return (
    <>
      <AppNavbar
        appName="similoo"
        position="fixed top-0 left-0 right-0 z-40 md:z-[60]"
        actionsExtra={
          <>
            {/* Release-notes injection anchor: the engine looks up
                .navbar-brand then inserts its version (tag) button before
                .logo-subtitle. We keep that exact structure here so the button
                still mounts; the subtitle text itself stays visually hidden
                (AppNavbar renders the real wordmark). */}
            <span className="navbar-brand rn-version-host">
              <span className="logo-subtitle" data-i18n="nav.logo_subtitle" hidden />
            </span>

            {/* Mobile overflow trigger: collapses the secondary actions (help,
                theme, locale) behind a ⋯ menu below 768px. Hidden on desktop,
                where the actions sit inline. */}
            <button
              id="navOverflowToggle"
              className="nav-overflow-toggle"
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls="navbarActions"
              aria-label="More options"
              title="More options"
              data-i18n-attr="aria-label:nav.more_aria,title:nav.more_aria"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="5" cy="12" r="1.4" />
                <circle cx="12" cy="12" r="1.4" />
                <circle cx="19" cy="12" r="1.4" />
              </svg>
            </button>

            <div className="navbar-actions" id="navbarActions">
              <button
                id="helpButton"
                className="nav-action-button"
                type="button"
                aria-label="How comparable buildings are calculated"
                title="How comparable buildings are calculated"
                data-i18n-attr="aria-label:help.button_aria,title:help.button_aria"
              >
                <i data-lucide="help-circle" />
              </button>
              <button
                id="themeToggleButton"
                className="theme-toggle-button"
                title="Toggle dark mode"
                aria-label="Toggle dark mode"
                aria-pressed="false"
              >
                <svg
                  className="theme-toggle-sun"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
                <svg
                  className="theme-toggle-moon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </button>
              <select
                id="locale-select"
                className="locale-select"
                aria-label="Select language"
                data-i18n-attr="aria-label:nav.select_language,title:nav.select_language"
                title="Select language"
                defaultValue="en"
              >
                <option value="en">EN</option>
                <option value="fr">FR</option>
                <option value="de">DE</option>
                <option value="it">IT</option>
              </select>

              {/* Settings gear — the suite-shared <SettingsMenu>, here hosting
                  only the Liquid Glass appearance picker (Off · Frosted ·
                  Liquid). It reuses the shared `.aireon-navbtn` look so it
                  matches the canonical navbar icons; collapsing behind the ⋯
                  overflow on mobile comes for free as it sits inside
                  #navbarActions. Re-renders (and re-localises) on locale/glass
                  change via the `locale`/`glassLevel` state above. */}
              <SettingsMenu
                dark={isDark}
                label={t('settings.button')}
                menuLabel={t('settings.button')}
                emptyLabel={t('settings.button')}
                items={[glassSettingsItem]}
              />
            </div>
          </>
        }
        userMenu={<div id="authNav" className="auth-nav" aria-live="polite" />}
      />
      <LandingView />
      <ComparisonView />
    </>
  );
}
