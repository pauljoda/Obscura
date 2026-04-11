"use client";

import { cn } from "@obscura/ui/lib/utils";
import type { SubtitleAppearance } from "@obscura/contracts";
import { captionClassName } from "../lib/subtitle-appearance";

interface SubtitleCaptionOverlayProps {
  text: string | null;
  appearance: SubtitleAppearance;
  /** Optional extra positioning classes applied to the wrapper. */
  className?: string;
  /** When true, render even if text is null (useful for settings preview). */
  alwaysVisible?: boolean;
  /** Placeholder text shown when alwaysVisible and text is null. */
  placeholder?: string;
}

export function SubtitleCaptionOverlay({
  text,
  appearance,
  className,
  alwaysVisible = false,
  placeholder = "Example subtitle line",
}: SubtitleCaptionOverlayProps) {
  if (!text && !alwaysVisible) return null;
  const display = text ?? placeholder;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4",
        className,
      )}
      style={{
        top: `${appearance.positionPercent}%`,
        transform: "translateY(-100%)",
        opacity: appearance.opacity,
      }}
    >
      <div
        className={cn(
          captionClassName(appearance.style),
          "max-w-[86%] whitespace-pre-line text-center font-medium leading-snug",
        )}
        style={{ fontSize: `${appearance.fontScale * 1.05}rem` }}
      >
        {display}
      </div>
    </div>
  );
}
