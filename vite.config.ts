import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createAireonWorkboxConfig } from '@aireon/shared/pwa-workbox';

// Suite-shared service-worker policy (see @aireon/shared/pwa-workbox). Captured
// once so vite.config can extend its globIgnores below without re-deriving it.
const aireonWorkbox = createAireonWorkboxConfig();

// similoo is a React shell hosting a preserved imperative engine (MapLibre map,
// Three.js building scene, comparison sidebar, panels) under src/js. The React
// plugin compiles the .tsx shell; the engine .js modules are plain ES modules
// Vite handles as-is. React Compiler applies to the shell only; because the app
// stays on React 18, the compiler target must match react-compiler-runtime.
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '18' }]],
      },
    }),
    // Installable-PWA service worker. registerType 'prompt' surfaces the shared
    // PwaUpdateToast on a new deploy instead of silently swapping the shell;
    // manifest:false keeps our hand-authored public/site.webmanifest as the
    // source of truth. The workbox policy comes from @aireon/shared so every
    // Aireon app caches the same (app shell only — map tiles and RES/API calls
    // are never precached or runtime-cached). We add og-image.png to the shared
    // globIgnores: it is a 3.5 MB social-share card fetched only by crawlers /
    // link unfurlers, never part of the offline app shell, and it exceeds
    // workbox's precache size cap — precaching it would fail the SW build.
    VitePWA({
      registerType: 'prompt',
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        ...aireonWorkbox,
        globIgnores: [...(aireonWorkbox.globIgnores ?? []), 'og-image.png'],
      },
    }),
  ],
  build: {
    // The bundle is dominated by maplibre-gl + three; the previous vanilla
    // build already exceeded the 500 kB default warning. Keep the build quiet.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Conservative code-splitting: bucket ONLY specific heavy third-party
        // packages into their own chunks so they don't bloat the eager entry
        // bundle. App code (and react) is deliberately NOT chunked here —
        // splitting app code risks circular-dependency TDZ white-screens.
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
