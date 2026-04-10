"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Music, FolderOpen } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { buildHierarchyTree } from "@obscura/ui/lib/tree";
import type {
  AudioLibraryListItemDto,
  AudioLibraryStatsDto,
} from "@obscura/contracts";
import { formatDuration } from "@obscura/contracts";
import { HierarchyBrowser } from "../shared/hierarchy-browser";
import { useNsfw } from "../nsfw/nsfw-context";
import { NsfwBlur } from "../nsfw/nsfw-gate";
import { SCENE_CARD_GRADIENTS } from "../scenes/scene-card-gradients";
import type { TagItem, StudioItem } from "../../lib/api";
import { toApiUrl } from "../../lib/api";

interface AudioPageClientProps {
  initialLibraries: AudioLibraryListItemDto[];
  initialTotal: number;
  initialStats: AudioLibraryStatsDto;
  initialTags: TagItem[];
  initialStudios: StudioItem[];
}

export function AudioPageClient({
  initialLibraries,
  initialTotal,
  initialStats,
  initialTags,
  initialStudios,
}: AudioPageClientProps) {
  const { mode: nsfwMode } = useNsfw();
  const [viewMode, setViewMode] = useState<"browser" | "grid">("grid");
  const libraries = initialLibraries;

  const tree = useMemo(
    () =>
      buildHierarchyTree(
        libraries.map((l) => ({ ...l, parentId: l.parentId ?? null })),
        (a, b) => a.title.localeCompare(b.title),
      ),
    [libraries],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-semibold">Audio</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {initialStats.totalLibraries} libraries &middot; {initialStats.totalTracks} tracks
            {initialStats.totalDuration > 0 && (
              <> &middot; {formatDuration(initialStats.totalDuration)}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "px-3 py-1.5 text-xs transition-colors",
              viewMode === "grid"
                ? "surface-card-sharp text-text-accent"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("browser")}
            className={cn(
              "px-3 py-1.5 text-xs transition-colors",
              viewMode === "browser"
                ? "surface-card-sharp text-text-accent"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            Browser
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "browser" ? (
        <HierarchyBrowser<AudioLibraryListItemDto>
          tree={tree}
          getHref={(l) => `/audio/${l.id}`}
          getTitle={(l) => l.title}
          isHidden={nsfwMode === "off" ? (l) => l.isNsfw === true : undefined}
          renderBadge={(l) => (
            <span className="flex items-center gap-1 text-[0.65rem] text-text-muted flex-shrink-0">
              <Music className="h-3 w-3" />
              {l.trackCount}
            </span>
          )}
          expandedIcon={FolderOpen}
          emptyState={
            <div className="surface-well flex flex-col items-center justify-center py-16 text-center px-4">
              <Music className="h-8 w-8 text-text-disabled mb-2" />
              <h3 className="text-base font-medium font-heading text-text-secondary mb-1">No audio libraries found</h3>
              <p className="text-text-muted text-sm max-w-xs">
                Run a library scan to discover audio files, or check that audio scanning is enabled in settings.
              </p>
            </div>
          }
        />
      ) : (
        <div>
          {libraries.length === 0 ? (
            <div className="surface-well flex flex-col items-center justify-center py-16 text-center px-4">
              <Music className="h-8 w-8 text-text-disabled mb-2" />
              <h3 className="text-base font-medium font-heading text-text-secondary mb-1">No audio libraries found</h3>
              <p className="text-text-muted text-sm max-w-xs">
                Run a library scan to discover audio files, or check that audio scanning is enabled in settings.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {libraries
                .filter((l) => nsfwMode !== "off" || !l.isNsfw)
                .map((lib, index) => (
                  <AudioLibraryCard key={lib.id} library={lib} index={index} />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AudioLibraryCard({
  library,
  index,
}: {
  library: AudioLibraryListItemDto;
  index: number;
}) {
  const coverUrl = toApiUrl(library.coverImagePath);
  const gradientClass = SCENE_CARD_GRADIENTS[index % SCENE_CARD_GRADIENTS.length];

  return (
    <Link
      href={`/audio/${library.id}`}
      className="group surface-card-sharp overflow-hidden hover:border-border-accent transition-colors"
    >
      <NsfwBlur isNsfw={library.isNsfw} className="aspect-square overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={library.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={cn("w-full h-full flex items-center justify-center", gradientClass)}>
            <Music className="h-10 w-10 text-white/20" />
          </div>
        )}
      </NsfwBlur>
      <div className="p-2.5">
        <h3 className="text-sm font-medium truncate">{library.title}</h3>
        <p className="text-xs text-text-muted mt-0.5">
          {library.trackCount} track{library.trackCount !== 1 ? "s" : ""}
        </p>
        {library.performers.length > 0 && (
          <p className="text-xs text-text-disabled mt-0.5 truncate">
            {library.performers.map((p) => p.name).join(", ")}
          </p>
        )}
      </div>
    </Link>
  );
}
