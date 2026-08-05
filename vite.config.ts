import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
