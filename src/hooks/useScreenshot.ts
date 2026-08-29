import { useCallback, useRef, useState } from 'react';
import { captureBrowserScreenshot, extensionForBlob } from '../lib/captureScreenshot';
import { uploadImage, type ScreenshotMetadata } from '../lib/imageService';
import { t } from '../js/i18n.js';

/**
 * Headless "save image" capture flow, triggered from the shared MapToolbar's
 * camera button (via `onCapture`). The capturing overlay is rendered by
 * {@link ScreenshotOverlay}.
 *
 * similoo has no React toast/i18n context — labels come from the plain-JS dict
 * at `src/js/i18n.js` (the same `t()` App.tsx uses). Since there is no toast
 * infrastructure, success/failure feedback is exposed as a transient `notice`
 * string the caller flashes through the suite-shared <ShareCopiedToast> pill —
 * the same minimal-feedback control similoo already uses for "Link copied".
 */
export function useScreenshot(
  getCaptureMetadata?: () => Promise<ScreenshotMetadata> | ScreenshotMetadata,
) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // `useRef` lost its zero-argument overload in @types/react 19, so the initial
  // value is now explicit. `undefined` is exactly what the old call seeded: the
  // only reader is the `if (noticeTimer.current)` guard in flashNotice.
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }, []);

  const capture = useCallback(async () => {
    setIsCapturing(true);
    // Yield so the overlay paints before the heavy DOM walk starts.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const blob = await captureBrowserScreenshot();
      const extra = getCaptureMetadata ? await getCaptureMetadata() : {};
      await uploadImage(blob, {
        filename: `similoo-${Date.now()}.${extensionForBlob(blob)}`,
        customMetadata: {
          url: window.location.href,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          captured_at: new Date().toISOString(),
          ...extra,
        },
      });
      flashNotice(t('screenshot.saved'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('screenshot.failed');
      flashNotice(message);
    } finally {
      setIsCapturing(false);
    }
  }, [getCaptureMetadata, flashNotice]);

  return { capture, isCapturing, notice };
}
