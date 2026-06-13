// similoo top bar — the React rendering of the suite-canonical navbar shell.
//
// PRESERVATION NOTE: this is a 1:1 port of the vanilla index.html `.navbar`
// markup (same ids, classes, ARIA, inline SVGs and the simil/red-oo wordmark),
// so the bespoke styles in src/css/styles.css + sidebar.css render byte-for-byte
// identically and the preserved imperative engine still binds to it:
//   * boot() in src/js/main.js attaches handlers to #helpButton,
//     #themeToggleButton, #locale-select, #navOverflowToggle, #navbarActions
//   * shared auth injects the sign-in / profile dropdown into #authNav
//   * the release-notes module injects its version (tag) button into
//     .navbar-brand, before .logo-subtitle
// Rebuilding this as a shared <AppNavbar> (the Tailwind valoo overlay bar) would
// change the look and require a Tailwind toolchain this app's hand-authored CSS
// doesn't use, so we keep similoo's own navbar to stay visually identical while
// still being a React component composed from the same shell pieces.
export default function AppNavbar() {
  return (
    <div className="navbar">
      <div className="navbar-desktop">
        <div className="navbar-brand">
          <a
            href="https://hub.aireon.ch/"
            className="aireon-hub-link"
            aria-label="Aireon hub"
            title="Aireon hub"
          >
            <span className="aireon-hub-mark" aria-hidden="true" />
          </a>
          <span className="aireon-hub-divider" aria-hidden="true" />
          <a href="/" className="logo">
            <span className="logo-first">simil</span>
            <span className="logo-second">oo</span>
          </a>
          <span className="logo-subtitle" data-i18n="nav.logo_subtitle">
            Comparable Buildings
          </span>
        </div>

        {/* Mobile overflow trigger: collapses the secondary actions (help,
            theme, locale, sign-in) behind a ⋯ menu below 768px. Hidden on
            desktop, where the actions sit inline in their original places. */}
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
          <div id="authNav" className="auth-nav" aria-live="polite" />
        </div>
      </div>
    </div>
  );
}
