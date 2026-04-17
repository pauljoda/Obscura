"use client";

import { Film, Images, Music } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";

interface MediaAppearanceCountsProps {
  videoCount: number;
  imageAppearanceCount: number;
  audioLibraryCount: number;
  className?: string;
  /** Tighter icon + text for dense rows */
  compact?: boolean;
  /** e.g. gender, appended after counts */
  trailing?: string | null;
}

export function MediaAppearanceCounts({
  videoCount,
  imageAppearanceCount,
  audioLibraryCount,
  className,
  compact,
  trailing,
}: MediaAppearanceCountsProps) {
  const iconClass = compact ? "h-2.5 w-2.5 flex-shrink-0" : "h-3 w-3 flex-shrink-0";
  const textClass = compact ? "text-[0.65rem]" : "text-[0.68rem]";

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-text-disabled",
        textClass,
        className,
      )}
    >
      <span className="inline-flex items-center gap-1" title="Videos">
        <Film className={cn(iconClass)} aria-hidden />
        <span>{videoCount}</span>
      </span>
      <span className="inline-flex items-center gap-1" title="Galleries and images">
        <Images className={cn(iconClass)} aria-hidden />
        <span>{imageAppearanceCount}</span>
      </span>
      <span className="inline-flex items-center gap-1" title="Audio libraries">
        <Music className={cn(iconClass)} aria-hidden />
        <span>{audioLibraryCount}</span>
      </span>
      {trailing ? <span className="text-text-disabled/90">· {trailing}</span> : null}
    </p>
  );
}
