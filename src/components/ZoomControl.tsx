import { Plus, Minus, Compass } from 'lucide-react';
import type { Map } from 'maplibre-gl';
import { t } from '../js/i18n.js';

interface ZoomControlProps {
  /** Force dark styling (App mirrors the suite `.dark` + similoo `data-theme`). */
  dark: boolean;
  /** Re-render trigger so the localized aria-labels/tooltips follow the locale. */
  locale?: string;
  /** Positioning classes for the absolute wrapper. */
  className?: string;
}

/**
 * Suite-standard glass zoom control — the same frosted +/−/compass stack roofs,
 * scoops and choose render (the suite zoom is a per-app component, not a shared
 * export). Replaces the bespoke maplibre `NavigationControl` similoo mounted at
 * top-right. It drives the engine's MapLibre instance, exposed on
 * `window.__similooMap`, so no engine refactor is needed to wire it up.
 */
export default function ZoomControl({ dark, className = '' }: ZoomControlProps) {
  const getMap = () =>
    (window as unknown as { __similooMap?: Map }).__similooMap ?? null;

  const handleZoomIn = () => getMap()?.zoomIn({ duration: 250 });
  const handleZoomOut = () => getMap()?.zoomOut({ duration: 250 });
  const handleResetNorth = () => getMap()?.easeTo({ bearing: 0, pitch: 0, duration: 500 });

  const panel = dark
    ? 'bg-slate-900/95 border-slate-700/60 text-slate-200'
    : 'bg-white/95 border-slate-200/80 text-slate-700';
  const hover = dark
    ? 'hover:bg-slate-800/70 hover:text-blue-400 active:bg-slate-800'
    : 'hover:bg-slate-50 hover:text-blue-600 active:bg-slate-100';
  const divider = dark ? 'border-slate-700/60' : 'border-slate-200/80';
  const btn = `w-9 h-9 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${hover}`;

  return (
    <div data-screenshot-ignore="true" className={`absolute z-10 similoo-zoom-control ${className}`}>
      <div className={`flex flex-col rounded-xl shadow-xl backdrop-blur-sm border overflow-hidden ${panel}`}>
        <button type="button" onClick={handleZoomIn} aria-label={t('panel.zoom.in')} title={t('panel.zoom.in')} className={btn}>
          <Plus size={16} strokeWidth={2.25} />
        </button>
        <div className={`border-t ${divider}`} />
        <button type="button" onClick={handleZoomOut} aria-label={t('panel.zoom.out')} title={t('panel.zoom.out')} className={btn}>
          <Minus size={16} strokeWidth={2.25} />
        </button>
        <div className={`border-t ${divider}`} />
        <button type="button" onClick={handleResetNorth} aria-label={t('panel.zoom.reset_north')} title={t('panel.zoom.reset_north')} className={btn}>
          <Compass size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
