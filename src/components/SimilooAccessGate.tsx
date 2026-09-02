import type { ReactNode } from 'react';
import { AppAccessGate } from '@aireon/shared';
import { TurnstileGate } from '@aireon/shared/turnstile';
import { AppShellSkeleton } from './AppShellSkeleton';

export function SimilooAccessGate({ children }: { children: ReactNode }) {
  return (
    <TurnstileGate
      appId="similoo"
      siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
      fallback={<AppShellSkeleton />}
    >
      <AppAccessGate
        appId="similoo"
        defaultAccess="public"
        loadingFallback={<AppShellSkeleton />}
      >
        {children}
      </AppAccessGate>
    </TurnstileGate>
  );
}
