import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, GlassProvider } from '@aireon/shared';
import App from './App';

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
      <GlassProvider>
        <App />
      </GlassProvider>
    </AuthProvider>
  </StrictMode>,
);
