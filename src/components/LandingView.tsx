// Landing view — address search, shown first; the engine (boot() in
// src/js/main.js) hides it once an address is picked (sets `hidden` on
// #landingView and reveals #comparisonView). 1:1 port of the vanilla
// index.html markup so src/css/landing.css renders identically and
// bindLandingSearch() binds to #landingSearchInput / #landingResults.
export default function LandingView() {
  return (
    <section id="landingView" className="landing-view">
      <div className="landing-card">
        <h1 className="landing-title" data-i18n="landing.title">
          Type a Swiss address.
        </h1>
        <p className="landing-subtitle" data-i18n="landing.subtitle">
          similoo finds buildings comparable to the one at this address — same
          zone, recent construction — and shows them as LOD 2.5 cubes on the map
          plus a detailed 3D inspection on demand.
        </p>
        <form
          className="landing-search"
          id="landingSearchForm"
          role="search"
          autoComplete="off"
        >
          <input
            type="search"
            id="landingSearchInput"
            className="landing-search-input"
            placeholder="e.g. Bahnhofstrasse 10, Zürich"
            aria-label="Search address"
            data-i18n-attr="placeholder:landing.search_placeholder,aria-label:landing.search_aria"
          />
          <ul
            className="landing-results"
            id="landingResults"
            role="listbox"
            hidden
          />
          <p className="landing-hint" data-i18n="landing.hint">
            Pick a result to load the comparison.
          </p>
        </form>
      </div>
    </section>
  );
}
