/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// The preserved engine modules under src/js are plain untyped ES modules. We
// import only a couple of them from the .tsx shell (the boot orchestrator);
// declare them as `any` so the TS shell compiles without porting the whole
// engine to TypeScript. Engine-internal imports between .js files are not
// type-checked (checkJs:false), so this only covers the shell→engine boundary.
declare module './js/main.js';
declare module '*/js/main.js';
