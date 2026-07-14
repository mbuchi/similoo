import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { PwaUpdateToast, PwaOfflinePill } from '@aireon/shared/pwa';
// similoo has no React i18n context — translations come from the imperative
// vanilla module (src/js/i18n.js). We read labels via t() and re-render on
// locale change so the offline pill / update toast follow the language switch.
import { t, onLocaleChange } from '../js/i18n.js';

/**
 * App-side PWA glue. Owns the `virtual:pwa-register/react` import (which only
 * resolves inside this app's vite build, never in @aireon/shared) and renders
 * the shared offline pill + prompt-to-update toast. Mounted once, high in the
 * tree; see App.tsx.
 */
export default function PwaLayer() {
  // Re-render this subtree when the imperative locale flips so the labels below
  // pick up the new language.
  const [, force] = useState(0);
  useEffect(() => {
    const unsubscribe = onLocaleChange(() => force((n) => n + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err: unknown) {
      console.warn('[pwa] service worker registration failed', err);
    },
  });

  return (
    <>
      <PwaOfflinePill labels={{ offline: t('pwa.offline'), backOnline: t('pwa.back_online') }} />
      <PwaUpdateToast
        needRefresh={needRefresh}
        onUpdate={() => void updateServiceWorker(true)}
        // REQUIRED: without clearing the flag, dismissing mutes all future updates.
        onDismiss={() => setNeedRefresh(false)}
        labels={{
          updateAvailable: t('pwa.update_available'),
          update: t('pwa.update_now'),
          dismiss: t('pwa.dismiss'),
        }}
      />
    </>
  );
}
