import { useState } from 'react';
import { MapLegendChip } from '@aireon/shared';
import ZoomControl from './ZoomControl';
import { t } from '../js/i18n.js';

interface ComparisonViewProps {
  /** Mirrors the suite `.dark` / similoo `data-theme` so the glass zoom control themes correctly. */
  dark: boolean;
  /** Drives the zoom control's localized aria-labels/tooltips. */
  locale: string;
}

// Comparison surface — full-bleed map + (engine-injected) sidebar, revealed by
// the engine after an address pick. boot() in src/js/main.js mounts the MapLibre
// viewer into #mapContainer; the "Comparable Buildings" sidebar, building-detail
// modal, comparable markers and map legend are created imperatively by the engine
// and appended to the body / map container.
//
// There is no in-view header bar any more: searching (and re-searching) happens
// through the suite-standard navbar address search (see App.tsx), which also
// surfaces the active parcel's address — so the old "Search again" pill +
// address strip were redundant and have been removed. The map now fills the
// whole section below the fixed navbar.
//
// The suite-standard glass <ZoomControl> overlays the map bottom-right (it lives
// inside this section, so it's hidden with it on the landing view); it replaces
// the bespoke maplibre NavigationControl the engine used to mount top-right.
export default function ComparisonView({ dark, locale }: ComparisonViewProps) {
  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <section id="comparisonView" className="comparison-view" hidden>
      <div id="mapContainer" className="comparison-map" />
      <div
        data-screenshot-ignore="true"
        className="absolute bottom-6 left-3 z-10 md:hidden"
      >
        <MapLegendChip
          open={legendOpen}
          onOpen={() => setLegendOpen(true)}
          onClose={() => setLegendOpen(false)}
          chipLabel={t('legend.title')}
          collapseLabel={t('legend.collapse')}
          dark={dark}
        >
          <div
            className="map-legend map-legend--mobile"
            role="region"
            aria-label={t('legend.title')}
          >
            <div className="map-legend-title">{t('legend.title')}</div>
            <ul className="map-legend-rows">
              <li className="map-legend-row">
                <span className="map-legend-swatch map-legend-swatch--target" aria-hidden="true" />
                <span className="map-legend-label">{t('legend.target')}</span>
              </li>
              <li className="map-legend-row">
                <span className="map-legend-swatch map-legend-swatch--same-zone" aria-hidden="true" />
                <span className="map-legend-label">{t('legend.same_zone')}</span>
              </li>
              <li className="map-legend-row">
                <span className="map-legend-swatch map-legend-swatch--comparable" aria-hidden="true" />
                <span className="map-legend-label">{t('legend.comparable')}</span>
              </li>
            </ul>
          </div>
        </MapLegendChip>
      </div>
      <ZoomControl dark={dark} locale={locale} className="bottom-8 right-4" />
    </section>
  );
}
