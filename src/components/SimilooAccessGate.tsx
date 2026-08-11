import type { ReactNode } from 'react';
import { AppAccessGate } from '@aireon/shared';
import { AppShellSkeleton } from './AppShellSkeleton';

export function SimilooAccessGate({ children }: { children: ReactNode }) {
  return (
    <AppAccessGate
      appId="similoo"
      defaultAccess="public"
      loadingFallback={<AppShellSkeleton />}
    >
      {children}
    </AppAccessGate>
  );
}
