import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { aireonHtmlPlugin } from '@aireon/shared/vite';

// similoo is a React shell hosting a preserved imperative engine (MapLibre map,
// Three.js building scene, comparison sidebar, panels) under src/js. The React
// plugin compiles the .tsx shell with Oxc; the engine .js modules are plain ES
// modules Vite handles as-is. plugin-react 6 dropped its `babel` option, so
// React Compiler runs as a separate @rolldown/plugin-babel pass. `target: '19'`
// makes the compiler emit `react/compiler-runtime`, the subpath React 19 ships
// itself, so the standalone `react-compiler-runtime` shim is no longer a
// dependency. The target and the installed React major must agree: asking for
// '19' on React 18 fails at build time with module-not-found, and so does '18'
// once the shim package is gone. Both mismatches are loud, not silent.
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset({ target: '19' })] }),
    // First-load standard (aireon-shared/docs/PERFORMANCE_STANDARD.md). Injects the
    // pre-paint theme bootstrap, the static navbar+map shell so something paints
    // before any JS runs, and preconnects for the origins similoo's first screen
    // actually uses (RES, plus the swisstopo tile and search hosts the basemap and
    // the landing address card hit). map-first because the toolbox matrix has
    // mapFirst: 'yes' and the app ships MapLibre.
    // `defaultTheme` MUST match initTheme('light') in src/main.tsx: the bootstrap
    // stamps `data-theme` before paint and resolveThemePreference() then adopts
    // that attribute, so a mismatch here silently overrides the app's own default
    // for any visitor who has never chosen a theme. index.html keeps only a small
    // adjustment script on top of this one (legacy `similoo-theme` key adoption).
    aireonHtmlPlugin({ archetype: 'map-first', defaultTheme: 'light' }),
  ],
  optimizeDeps: {
    // Dev server only — `optimizeDeps` never runs for `npm run build`, so this
    // cannot change what ships. Under Vite 8 (rolldown) the dependency
    // pre-bundler cannot resolve the `?worker&url` suffix on the MapLibre
    // worker import that lives inside @aireon/shared's map bootstrap, and
    // `npm run dev` dies with UNLOADABLE_DEPENDENCY before serving a single
    // request. Excluding the package from pre-bundling is the suite fix
    // (valoo v0.45.0).
    exclude: ['@aireon/shared'],
  },
  build: {
    // The bundle is dominated by three (the ~1 MB maplibre-gl engine is now
    // external, loaded from static.aireon.ch via the absolute URL that
    // @aireon/shared's HTML plugin resolves at build time -- no import map,
    // which needed a newer browser than the app itself); the previous vanilla
    // build already exceeded the 500 kB default warning. Keep the build quiet.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Conservative code-splitting: bucket ONLY specific heavy third-party
        // packages into their own chunks so they don't bloat the eager entry
        // bundle. App code (and react) is deliberately NOT chunked here —
        // splitting app code risks circular-dependency TDZ white-screens.
        manualChunks(id) {
          // ⚠ STYLESHEETS ARE DELIBERATELY EXCLUDED. These buckets are DYNAMIC
          // chunks (App.tsx loads src/js/main.js on demand), and a dependency's
          // CSS follows whichever chunk claims it — so bucketing
          // `maplibre-gl.css` here would pull its <link> out of index.html and
          // have Vite append it to <head> at runtime, AFTER the entry
          // stylesheet. `.maplibregl-map { position: relative }` and similoo's
          // own `.comparison-map { position: relative }` both hit the same
          // element at (0,1,0), so the later sheet would win the tie, and the
          // suite has already shipped a blank map with no console error from
          // exactly this inversion (hood v0.25.0). Excluding CSS keeps every
          // stylesheet in the eager entry bundle, in main.tsx import order,
          // where maplibre-gl.css is the first import.
          if (id.endsWith('.css')) return undefined;
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
