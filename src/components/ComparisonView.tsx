// Comparison surface — split-screen map + (engine-injected) sidebar, revealed
// by the engine after an address pick. 1:1 port of the vanilla index.html markup
// so src/css/comparison.css + map.css render identically and boot() in
// src/js/main.js binds #backToSearch, fills #comparisonAddress, and mounts the
// MapLibre viewer into #mapContainer. The "Comparable Buildings" sidebar,
// building-detail modal, comparable markers and map legend are created
// imperatively by the engine and appended to the body / map container.
export default function ComparisonView() {
  return (
    <section id="comparisonView" className="comparison-view" hidden>
      <div id="comparisonHeader" className="comparison-header">
        <button
          id="backToSearch"
          className="comparison-back"
          type="button"
          aria-label="Back to search"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span data-i18n="comparison.back">Search again</span>
        </button>
        <div className="comparison-address" id="comparisonAddress" />
      </div>
      <div id="mapContainer" className="comparison-map" />
    </section>
  );
}
