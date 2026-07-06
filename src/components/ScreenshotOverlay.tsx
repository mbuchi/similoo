import { createPortal } from 'react-dom';
import { t } from '../js/i18n.js';

interface ScreenshotOverlayProps {
  isCapturing: boolean;
  darkMode: boolean;
}

/**
 * Full-viewport "creating image…" overlay for the export flow. Portalled to
 * document.body so the header's `backdrop-blur-md` (a containing block for
 * descendant `position: fixed`) can't scope it to the 56px header.
 *
 * similoo has no React i18n context — labels come from the plain-JS dict at
 * `src/js/i18n.js`, the same `t()` App.tsx and the rest of similoo's React
 * chrome use.
 */
export default function ScreenshotOverlay({ isCapturing, darkMode }: ScreenshotOverlayProps) {
  if (!isCapturing) return null;

  return createPortal(
    <div
      data-screenshot-ignore="true"
      className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex flex-col items-center gap-3 px-6 py-5 rounded-xl shadow-2xl ${
          darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700'
        }`}
      >
        {/* Skeleton placeholder shaped like the image being captured */}
        <div className="w-28 space-y-2" aria-hidden="true">
          <div className="h-16 w-full rounded-lg bg-slate-200/80 dark:bg-[#161922] animate-pulse" />
          <div className="h-2.5 w-3/4 rounded bg-slate-200/80 dark:bg-[#161922] animate-pulse [animation-delay:150ms]" />
          <div className="h-2.5 w-1/2 rounded bg-slate-200/80 dark:bg-[#161922] animate-pulse [animation-delay:300ms]" />
        </div>
        <span className="text-sm font-medium">{t('screenshot.creating')}</span>
      </div>
    </div>,
    document.body,
  );
}
