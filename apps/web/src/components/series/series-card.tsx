"use client";

import Link from "next/link";
import { FolderOpen, HardDrive, Images } from "lucide-react";
import type { VideoSeriesListItemDto } from "@obscura/contracts";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../../lib/api";
import { EntityPreviewMedia } from "../shared/entity-preview-media";
import { NsfwShowModeChip } from "../nsfw/nsfw-gate";
import { entityTerms, formatVideoCount } from "../../lib/terminology";

interface SeriesCardProps {
  series: VideoSeriesListItemDto;
  href: string;
  compact?: boolean;
}

export function SeriesCard({ series, href, compact }: SeriesCardProps) {
  return (
    <Link
      href={href}
      className="group surface-card overflow-hidden transition-colors duration-fast hover:border-border-accent"
    >
      <EntityPreviewMedia
        title={series.displayTitle}
        mode="cover-or-cycle"
        coverImage={toApiUrl(series.coverImagePath, series.updatedAt)}
        previewImages={series.previewThumbnailPaths
          .map((path) => toApiUrl(path, series.updatedAt))
          .filter(Boolean) as string[]}
        className="aspect-[2/3]"
      >
        <NsfwShowModeChip
          isNsfw={series.isNsfw}
          className="absolute bottom-2 right-2 z-10 pointer-events-none"
        />
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-white/90 backdrop-blur-sm">
          <Images className="h-3 w-3" />
          {series.visibleSfwVideoCount}
        </div>
      </EntityPreviewMedia>

      <div className={cn("px-2.5", compact ? "space-y-0.5 py-1.5" : "space-y-1.5 py-2.5")}>
        <div className="flex items-center gap-2">
          <FolderOpen className={cn("flex-shrink-0 text-text-accent", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          <h3 className={cn("truncate font-medium text-text-primary", compact ? "text-[0.75rem]" : "text-[0.82rem]")}>
            {series.displayTitle}
          </h3>
        </div>
        <div className={cn("flex items-center gap-2 text-text-muted", compact ? "text-[0.62rem]" : "text-[0.68rem]")}>
          <span>{formatVideoCount(series.visibleSfwVideoCount)}</span>
          {series.childSeasonCount > 0 ? (
            <span>
              {series.childSeasonCount} child{" "}
              {series.childSeasonCount === 1
                ? entityTerms.seriesSingular.toLowerCase()
                : entityTerms.series.toLowerCase()}
            </span>
          ) : null}
        </div>
        {series.libraryRootLabel ? (
          <div className={cn("flex items-center gap-1.5 text-text-disabled", compact ? "text-[0.6rem]" : "text-[0.65rem]")}>
            <HardDrive className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{series.libraryRootLabel}</span>
          </div>
        ) : null}
        {!compact && series.containsNsfwDescendants && !series.isNsfw ? (
          <div className="text-[0.65rem] text-text-disabled">
            Mixed-content {entityTerms.seriesSingular.toLowerCase()}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
