/**
 * App-shell skeleton — a navbar + map + side-panel placeholder shown while the
 * app is opening: first the access check, then the lazy route chunk, then the
 * page's own data load. Replaces the loading spinners with a skeleton that
 * approximates the real layout, per the suite "skeletons, not spinners" rule.
 *
 * `overlay` pins it above the shared AppAccessGate's built-in spinner (fixed at
 * z-index 99999) so the access-check phase reads as a skeleton too. Theme
 * follows the `.dark` class via Tailwind (already applied by initTheme before
 * first paint), so it matches the resolved app theme — not just system dark.
 */
export function AppShellSkeleton({ overlay = false }: { overlay?: boolean }) {
  const block = 'animate-pulse rounded-lg bg-slate-200/80 dark:bg-[#161922]';
  const root = overlay ? 'fixed inset-0 z-[100000] overflow-hidden' : 'min-h-screen';
  return (
    <div className={`${root} bg-slate-50 dark:bg-[#08090d]`} role="status" aria-label="Loading">
      {/* Navbar */}
      <div className="flex h-14 items-center gap-3 border-b border-slate-200 px-4 dark:border-[#1a1d28]">
        <div className={`h-7 w-24 ${block}`} />
        <div className={`mx-auto h-9 w-full max-w-xl ${block}`} />
        <div className={`h-7 w-7 rounded-full ${block}`} />
        <div className={`hidden h-7 w-20 sm:block ${block}`} />
      </div>
      {/* Body: map + side panel */}
      <div className="flex flex-col gap-4 p-4 lg:flex-row">
        <div className={`h-[38vh] lg:h-[calc(100vh-7rem)] lg:flex-1 ${block}`} />
        <div className="space-y-4 lg:w-[480px]">
          <div className={`h-6 w-40 ${block}`} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-20 ${block}`} style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className={`h-56 ${block}`} />
          <div className={`h-40 ${block}`} />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
