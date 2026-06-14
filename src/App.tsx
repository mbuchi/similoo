import { useEffect, useRef } from 'react';
import { AppNavbar } from '@aireon/shared';
import LandingView from './components/LandingView';
import ComparisonView from './components/ComparisonView';
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

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    boot();
  }, []);

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
