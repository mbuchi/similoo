// ⚠ FIRST IMPORT, AND IT MUST STAY FIRST. The MapLibre viewer itself now loads
// on demand (App.tsx dynamic-imports the engine), but its stylesheet does NOT
// ride along in that chunk — Vite appends a dynamic chunk's <link> to <head>
// AFTER the entry stylesheet at runtime, which would put
// `.maplibregl-map { position: relative }` (0,1,0) below the app's own
// `.comparison-map { position: relative }` (0,1,0) on the very same element and
// invert the cascade the map container depends on. Importing it here, ahead of
// every app stylesheet, reproduces the exact order the old static `maplibre`
// CSS chunk had. vite.config.ts keeps `.css` out of manualChunks for the same
// reason, and `#mapContainer#mapContainer` in src/css/map.css is the belt to
// this braces. Change none of the three without reading the other two.
import 'maplibre-gl/dist/maplibre-gl.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, GlassProvider, initTheme, applyTheme, initOpenReplay } from '@aireon/shared';
import { getThemeOverride } from '@aireon/shared/url-params';
import App from './App';
import { SimilooAccessGate } from './components/SimilooAccessGate';

// Cross-app theme ("theme follows you"). The shared initTheme resolves the suite
// `aireon_theme` cookie (scoped to .aireon.ch, shared by every *.aireon.ch app)
// → OS preference → 'light' and applies the `.dark` class. Now that similoo is
// on @aireon/shared v1.59 the suite theme store is available directly, replacing
// the earlier inline theme.js workaround (same cookie, so behaviour is
// unchanged). The pre-paint bootstrap in index.html already applied the same
// resolution — incl. `<html data-theme>` for similoo's bespoke CSS — before
// first paint; this re-affirms it once the bundle loads. App.tsx owns the toggle
// and keeps both `.dark` and `data-theme` in sync afterward.
//
// `?theme=dark|light` (URL_PARAMS_STANDARD.md) wins for this page load only:
// initTheme() still runs first (it applies the real stored/OS-default theme
// and never persists), then an override forces the `.dark` class to match
// without writing the cookie/localStorage — only setTheme() persists. The
// index.html pre-paint script already consulted the same override for
// `data-theme`/`.dark` before first paint; this just keeps initTheme()'s own
// resolution from flipping it back once the bundle loads.
const storedTheme = initTheme('light');
const themeOverride = getThemeOverride();
if (themeOverride && themeOverride !== storedTheme) applyTheme(themeOverride);

// Tailwind layers + suite font tokens. MUST be first so Tailwind's preflight
// (base reset) lands at the bottom of the cascade — the bespoke design-token
// stylesheets below then win over it for similoo's own surfaces, while the
// shared React chrome (navbar / account menu / zoom control) gets its slate
// utilities from the generated `@tailwind utilities` layer.
import './index.css';

// --- App stylesheets (the bespoke visual source of truth) -----------------
// Order matches the old index.html link order — styles.css first (design
// tokens), then the feature stylesheets. The remaining feature CSS (bugReport,
// buildingDetailModal extras) is imported by its engine module as before.
import './css/styles.css';
import './css/landing.css';
import './css/sidebar.css';
import './css/comparison.css';
import './css/map.css';
import './css/buildingDetailModal.css';
import './css/methodologyHelp.css';

// Shared suite stylesheets — the canonical map-first chrome. map-ui.css styles
// the AppNavbar / MapUserMenu / NavIconButton; scrollbars.css is the suite dark
// scrollbar; glass.css seeds the `--glass-*` tokens per `data-glass` level.
import '@aireon/shared/map-ui.css';
import '@aireon/shared/scrollbars.css';
import '@aireon/shared/glass.css';
// `./css/glass.css` opts similoo's bespoke floating surfaces (comparison panel,
// building detail, methodology, on-map legend) into the shared glass tokens.
import './css/glass.css';
import '@aireon/shared/fonts.css';

// Env-gated session replay. initOpenReplay is a no-op unless the project key is
// present, so this is safe to ship now — session replay stays inert until
// VITE_OPENREPLAY_PROJECT_KEY is set on the Vercel project. The global error
// capture itself is wired inside App.tsx (the app's error logger installs its
// uncaught-error / promise-rejection / resource / CSP / fetch listeners there).
initOpenReplay({ projectKey: import.meta.env.VITE_OPENREPLAY_PROJECT_KEY as string | undefined, trackerOptions: { canvas: { disableCanvas: true } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Suite OIDC: the shared AuthProvider drives the account menu with the
        same Zitadel client similoo used before. Silent SSO is deliberately off:
        anonymous visitors are never gated and login opens only on demand. */}
    <AuthProvider
      appName="similoo"
      silentSso={false}
      loginPromptOnFirstVisit={false}
      loginDescription="Create a free account or sign in to unlock the full Aireon suite."
      loginFeatures={[
        { label: 'Comparable-buildings explorer with 3D inspection' },
        { label: 'Same-zone, recent-construction matching' },
        { label: 'Saved searches & exports across the suite', locked: true },
      ]}
    >
      {/* SimilooAccessGate wraps the shared AppAccessGate (which enforces the
          per-app access policy admins set in the hub's App Manager) and overlays
          an app-shell skeleton during the on-open access check instead of the
          gate's built-in spinner — the suite "skeletons, not spinners" rule.
          similoo defaults to `public`, so the gate is a no-op unless an admin
          restricts it (member-only → sign-in prompt; admin-only / under
          construction → short notice). It must sit inside the shared
          AuthProvider so it can read the OIDC session via useAuth(). */}
      <SimilooAccessGate>
        <GlassProvider>
          <App />
        </GlassProvider>
      </SimilooAccessGate>
    </AuthProvider>
  </StrictMode>,
);
