/**
 * Default Next.js App Router loading UI for the `(app)` segment.
 * Centered brass LED with concentric square ripples and a pulsing core field.
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
        <div className="relative flex size-36 items-center justify-center">
          <div className="route-loader-ripples" aria-hidden>
            <span className="route-loader-ripple-ring" />
            <span className="route-loader-ripple-ring" />
            <span className="route-loader-ripple-ring" />
          </div>
          <div className="route-loader-core-field" aria-hidden />
          <div
            className="relative z-10 flex size-[2.875rem] items-center justify-center border border-accent-500/35 bg-surface-1/90 shadow-[var(--shadow-glow-accent-strong)]"
            aria-hidden
          >
            <span className="led led-lg led-accent led-pulse" />
          </div>
        </div>
        <p className="font-mono text-sm tracking-wide text-text-muted">Loading</p>
      </div>
    </div>
  );
}
