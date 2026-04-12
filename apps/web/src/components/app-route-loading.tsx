/**
 * Default Next.js App Router loading UI for the `(app)` segment.
 * Centered pulsing brass LED with ambient glow + mono “Loading” label.
 */
export function AppRouteLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        className="flex flex-col items-center gap-5"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="relative flex size-32 items-center justify-center">
          {/* Soft field bloom — reads as rack power-up, not a spinner */}
          <div
            className="pointer-events-none absolute inset-1 animate-pulse bg-gradient-to-b from-accent-500/20 via-accent-500/5 to-transparent shadow-[0_0_56px_rgba(199,155,92,0.22)]"
            aria-hidden
          />
          <div
            className="relative flex size-[4.25rem] items-center justify-center border border-accent-500/40 bg-gradient-to-b from-accent-950/50 to-surface-1 shadow-[var(--shadow-glow-accent-strong)]"
            aria-hidden
          >
            <span className="led led-lg led-accent led-pulse origin-center scale-[2.4]" />
          </div>
        </div>
        <p className="font-mono text-sm tracking-wide text-text-muted">Loading</p>
      </div>
    </div>
  );
}
