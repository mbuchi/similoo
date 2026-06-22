import type { ReactNode } from 'react';
import { AppAccessGate, useAppAccess } from '@aireon/shared';
import { AppShellSkeleton } from './AppShellSkeleton';

/**
 * Local wrapper around the shared <AppAccessGate> that shows an app-shell
 * skeleton (not the gate's built-in centered spinner) during the on-open access
 * check, per the suite "skeletons, not spinners" rule.
 *
 * The shared gate stays mounted so there's no remount flash; we just overlay
 * <AppShellSkeleton> while the exported useAppAccess hook reports `loading`
 * (the same /me + app-settings fetch the gate runs internally — useAppAccess
 * caches the in-flight promise, so reading it here is free). Once the decision
 * resolves the overlay drops and the gate renders its real outcome
 * (children for `granted`, or its own notice for member/admin/construction).
 */
export function SimilooAccessGate({ children }: { children: ReactNode }) {
  const { decision } = useAppAccess('similoo', 'public');
  return (
    <>
      <AppAccessGate appId="similoo" defaultAccess="public">
        {children}
      </AppAccessGate>
      {decision === 'loading' && <AppShellSkeleton overlay />}
    </>
  );
}
