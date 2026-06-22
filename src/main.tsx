import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, GlassProvider, initTheme } from '@aireon/shared';
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
initTheme('light');

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Suite OIDC: the shared AuthProvider drives the account menu and the
        cross-app silent SSO (same Zitadel client similoo used before), so the
        engine's removed imperative setupAuth() is fully replaced. Anonymous
        visitors are never gated — the login modal only opens on demand. */}
    <AuthProvider
      appName="similoo"
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
