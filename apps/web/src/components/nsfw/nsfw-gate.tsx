"use client";

import { cn } from "@obscura/ui/lib/utils";
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
      <div className="min-h-0 min-w-0 h-full w-full blur-sm brightness-50 transition-all duration-300 group-hover:blur-none group-hover:brightness-100">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-300 pointer-events-none">
        <span className="inline-flex items-center border-2 border-error bg-error-muted/95 px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-error-text [text-shadow:0_0_12px_rgba(204,120,128,0.55),0_0_4px_rgba(168,72,80,0.4)] shadow-[0_0_18px_rgba(168,72,80,0.55),0_0_6px_rgba(204,120,128,0.35)]">
          NSFW
        </span>
      </div>
    </div>
  );
}

/**
 * Red "NSFW" chip for display in metadata sections.
 * Shown only when isNsfw is true — no mode gating, it's informational metadata.
 */
export function NsfwChip() {
  return (
    <span className="inline-flex items-center border border-error/40 bg-error-muted/50 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-error-text shadow-[0_0_8px_rgba(168,72,80,0.25)]">
      NSFW
    </span>
  );
}

/**
 * Toggle button for marking an entity as NSFW in edit forms.
 * Wraps in NsfwGate so it is hidden in SFW mode (marking content NSFW in SFW
 * mode would immediately make it disappear, confusing the user).
 */
export function NsfwEditToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <NsfwGate>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[0.72rem] font-medium transition-colors duration-fast ${
          value
            ? "border border-error/45 bg-error-muted/40 text-error-text hover:bg-error-muted/55"
            : "bg-surface-2 text-text-muted border border-border-subtle hover:border-border-accent hover:text-text-primary"
        }`}
      >
        <span
          className={`inline-block h-2 w-2 border ${value ? "border-error bg-error" : "border-border-subtle"}`}
        />
        NSFW
      </button>
    </NsfwGate>
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

const TAG_GARBLE_CHARS = ["▒", "░", "█"] as const;

function garbleTagLabelText(text: string): string {
  return [...text]
    .map((ch, i) => (/\s/.test(ch) ? ch : TAG_GARBLE_CHARS[i % TAG_GARBLE_CHARS.length]!))
    .join("");
}

/**
 * NSFW tag names in global "blur" mode: garbled block glyphs plus a light blur;
 * hover shows the real text. Matches NsfwBlur/NsfwText off/show behavior.
 */
export function NsfwTagLabel({
  isNsfw,
  children,
  className,
}: {
  isNsfw: boolean;
  children: string;
  className?: string;
}) {
  const { mode } = useNsfw();

  if (!isNsfw || mode === "show") {
    return <span className={className}>{children}</span>;
  }

  if (mode === "off") {
    return null;
  }

  const garbled = garbleTagLabelText(children);

  return (
    <span
      className={cn("group/nsfw-tag inline max-w-full align-baseline", className)}
      title="NSFW — hover to reveal"
    >
      <span
        aria-hidden
        className="inline blur-[2.5px] contrast-[0.85] transition-[filter] duration-200 group-hover/nsfw-tag:hidden"
      >
        {garbled}
      </span>
      <span className="hidden group-hover/nsfw-tag:inline">{children}</span>
    </span>
  );
}
