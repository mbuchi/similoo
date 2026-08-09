import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

// similoo is a React shell hosting a preserved imperative engine (MapLibre map,
// Three.js building scene, comparison sidebar, panels) under src/js. The React
// plugin compiles the .tsx shell with Oxc; the engine .js modules are plain ES
// modules Vite handles as-is. plugin-react 6 dropped its `babel` option, so
// React Compiler runs as a separate @rolldown/plugin-babel pass. Because the app
// stays on React 18, the compiler target must match react-compiler-runtime.
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset({ target: '18' })] }),
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
