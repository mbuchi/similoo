import { useEffect, useRef } from 'react';
import AppNavbar from './components/AppNavbar';
import LandingView from './components/LandingView';
import ComparisonView from './components/ComparisonView';
// The preserved imperative engine. boot() owns all behaviour (map, Three.js
// scene, comparison sidebar/panels, address search, deep-linking, theme/locale/
// overflow navbar wiring, auth, bug report). It binds to the static DOM that the
// components below render — same ids/classes as the old vanilla index.html.
import { boot } from './js/main.js';

export default function App() {
  // Run the engine exactly once, after the scaffold is committed to the DOM.
  // React 18 StrictMode double-invokes effects in dev; the ref guard keeps the
  // imperative engine from booting twice (it isn't idempotent on its own).
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    boot();
  }, []);

  return (
    <>
      <AppNavbar />
      <LandingView />
      <ComparisonView />
    </>
  );
}
