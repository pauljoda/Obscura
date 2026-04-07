"use client";

import { useNsfw } from "./nsfw-context";

interface NsfwGateProps {
  children: React.ReactNode;
}

/**
 * Renders children only when NSFW mode is enabled ("blur" or "show").
 * Use for UI elements that should be completely hidden in SFW mode,
 * such as the Identify nav item, NSFW toggles in edit forms, etc.
 */
export function NsfwGate({ children }: NsfwGateProps) {
  const { mode } = useNsfw();
  if (mode === "off") return null;
  return <>{children}</>;
}

interface NsfwBlurProps {
  isNsfw: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Conditionally blurs or hides content based on the entity's NSFW flag and
 * the current global NSFW mode.
 *
 * - isNsfw=false  OR mode="show": render normally
 * - isNsfw=true  AND mode="blur": render with blur overlay (hover reveals)
 * - isNsfw=true  AND mode="off":  render null (hidden)
 *
 * Content remains interactive in blur mode — the blur is applied as a CSS
 * filter on the content layer, with a non-interactive badge overlay on top.
 */
export function NsfwBlur({ isNsfw, children, className }: NsfwBlurProps) {
  const { mode } = useNsfw();

  if (!isNsfw || mode === "show") {
    return <div className={className}>{children}</div>;
  }

  if (mode === "off") {
    return null;
  }

  // mode === "blur" — apply CSS filter only, keep content interactive
  return (
    <div className={`group relative ${className ?? ""}`}>
      <div className="blur-sm brightness-50 transition-all duration-300 group-hover:blur-none group-hover:brightness-100">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-300 pointer-events-none">
        <span className="bg-surface-2/90 border border-border-subtle px-2 py-0.5 text-mono-xs text-text-muted uppercase tracking-widest">
          NSFW
        </span>
      </div>
    </div>
  );
}

interface NsfwTextProps {
  isNsfw: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Inline text variant of NsfwBlur. In off mode (SFW), renders nothing to
 * match NsfwBlur's behavior of hiding NSFW content entirely. In blur mode,
 * blurs text until hover.
 */
export function NsfwText({ isNsfw, children, className }: NsfwTextProps) {
  const { mode } = useNsfw();

  if (!isNsfw || mode === "show") {
    return <span className={className}>{children}</span>;
  }

  if (mode === "off") {
    return null;
  }

  // mode === "blur"
  return (
    <span
      className={`blur-sm hover:blur-none transition-all duration-300 cursor-default ${className ?? ""}`}
      title="NSFW — hover to reveal"
    >
      {children}
    </span>
  );
}
