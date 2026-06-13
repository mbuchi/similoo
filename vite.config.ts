import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// similoo is a React shell hosting a preserved imperative engine (MapLibre map,
// Three.js building scene, comparison sidebar, panels) under src/js. The React
// plugin compiles the .tsx shell; the engine .js modules are plain ES modules
// Vite handles as-is. No path aliases or extra resolve config needed.
export default defineConfig({
  plugins: [react()],
  build: {
    // The bundle is dominated by maplibre-gl + three; the previous vanilla
    // build already exceeded the 500 kB default warning. Keep the build quiet
    // (behaviour-preserving — this is the same single-bundle output as before).
    chunkSizeWarningLimit: 2000,
  },
});
