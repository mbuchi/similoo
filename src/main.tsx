import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// --- App stylesheets (the visual source of truth) -------------------------
// Previously linked from index.html as /src/css/*.css; now bundled by Vite via
// the React entry so the build self-contains them. Order matches the old
// index.html link order — styles.css first (design tokens), then the
// feature stylesheets. The remaining feature CSS (bugReport, releaseNotes,
// buildingDetailModal extras) is imported by its engine module as before.
import './css/styles.css';
import './css/landing.css';
import './css/sidebar.css';
import './css/comparison.css';
import './css/map.css';
import './css/buildingDetailModal.css';
import './css/methodologyHelp.css';

// Shared suite map-UI stylesheet, per the suite convention. Self-contained
// `.aireon-*` scoped rules; similoo renders its own bespoke navbar so these are
// inert here, but importing it keeps the app aligned with the rest of the suite.
import '@aireon/shared/map-ui.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
