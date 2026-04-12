/**
 * Default Next.js App Router loading UI for the `(app)` segment.
 * Centered brass spinning square + mono “Loading” label.
 */
export function AppRouteLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div
          className="size-6 border-2 border-accent-500 border-t-transparent animate-spin"
          aria-hidden
        />
        <p className="font-mono text-sm text-text-muted">Loading</p>
      </div>
    </div>
  );
}
