import { useEffect, useState } from 'react';

export const COMPACT_LAYOUT_BREAKPOINT = 1024;
const QUERY = `(max-width: ${COMPACT_LAYOUT_BREAKPOINT - 1}px)`;

export function matchesCompactLayout(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

/**
 * similoo's compact-layout switch (the scoore 1024px suite standard): below
 * 1024px the navbar collapses to wordmark + search + account menu — the hub
 * badge, the Open-with / help / about icon cluster and the MapToolbar all
 * fold into the one account menu. The initial read is synchronous so a phone
 * load never flashes the desktop navbar before the first effect runs.
 */
export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(matchesCompactLayout);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(QUERY);
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);
  return compact;
}
