"use client";

import { MediaCard } from "@obscura/ui";
import { cn } from "@obscura/ui";
import { Film, Clock, HardDrive, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ViewMode } from "./filter-bar";
import { toApiUrl, type SceneListItem } from "../lib/api";
import { SCENE_TAG_COLORS } from "./scene-tag-colors";

const gradientClasses = [
  "gradient-thumb-1",
  "gradient-thumb-2",
  "gradient-thumb-3",
  "gradient-thumb-4",
  "gradient-thumb-5",
  "gradient-thumb-6",
  "gradient-thumb-7",
  "gradient-thumb-8",
];

interface SceneGridProps {
  scenes: SceneListItem[];
  viewMode: ViewMode;
  loading?: boolean;
}

export function SceneGrid({ scenes, viewMode, loading }: SceneGridProps) {
  if (loading) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-text-accent animate-spin mb-3" />
        <p className="text-text-muted text-sm">Loading scenes...</p>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <Film className="h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted text-sm">No scenes found.</p>
        <p className="text-text-disabled text-xs mt-1">
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-1">
        {scenes.map((scene, i) => (
          <SceneListItem key={scene.id} scene={scene} index={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {scenes.map((scene, i) => (
        <Link key={scene.id} href={`/scenes/${scene.id}`}>
          <MediaCard
            title={scene.title}
            thumbnail={toApiUrl(scene.thumbnailPath)}
            cardThumbnail={toApiUrl(scene.cardThumbnailPath)}
            trickplaySprite={toApiUrl(scene.spritePath)}
            trickplayVtt={toApiUrl(scene.trickplayVttPath)}
            scrubDurationSeconds={scene.duration ?? undefined}
            duration={scene.durationFormatted ?? undefined}
            resolution={scene.resolution ?? undefined}
            codec={scene.codec ?? undefined}
            fileSize={scene.fileSizeFormatted ?? undefined}
            studio={
              scene.performers.length > 0
                ? undefined
                : undefined
            }
            performers={scene.performers.map((p) => p.name)}
            tags={scene.tags.map((t) => t.name)}
            tagColors={SCENE_TAG_COLORS}
            views={scene.playCount}
            gradientClass={gradientClasses[i % gradientClasses.length]}
          />
        </Link>
      ))}
    </div>
  );
}

function SceneListItem({
  scene,
  index,
}: {
  scene: SceneListItem;
  index: number;
}) {
  return (
    <Link href={`/scenes/${scene.id}`}>
      <div className="surface-card-sharp group flex items-center gap-3 px-3 py-2 cursor-pointer">
        {/* Thumbnail */}
        <div
          className={cn(
            "relative w-28 flex-shrink-0 aspect-video rounded-sm overflow-hidden",
            gradientClasses[index % gradientClasses.length]
          )}
        >
          {scene.thumbnailPath && (
            <img
              src={toApiUrl(scene.cardThumbnailPath) || toApiUrl(scene.thumbnailPath)}
              alt={scene.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
          {scene.durationFormatted && (
            <span className="absolute bottom-0.5 right-0.5 text-[0.55rem] font-mono bg-black/70 text-white/80 px-1 rounded-sm">
              {scene.durationFormatted}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-[0.8rem] font-medium text-text-primary">
              {scene.title}
            </h4>
            {scene.resolution && (
              <span className="pill-accent px-1 py-0 text-[0.55rem] font-semibold flex-shrink-0">
                {scene.resolution}
              </span>
            )}
            {scene.codec && (
              <span className="text-[0.55rem] font-mono text-text-disabled flex-shrink-0">
                {scene.codec}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[0.7rem] text-text-muted">
            {scene.performers.length > 0 && (
              <span className="truncate">
                {scene.performers.map((p) => p.name).join(", ")}
              </span>
            )}
          </div>
          {scene.tags.length > 0 && (
            <div className="hidden sm:flex flex-wrap gap-1">
              {scene.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag.id}
                  className={cn(
                    "tag-chip",
                    SCENE_TAG_COLORS[tag.name] || "tag-chip-default"
                  )}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side stats */}
        <div className="hidden md:flex items-center gap-4 text-[0.65rem] text-text-disabled flex-shrink-0">
          {scene.fileSizeFormatted && (
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {scene.fileSizeFormatted}
            </span>
          )}
          {scene.playCount > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {scene.playCount}
            </span>
          )}
          {scene.durationFormatted && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {scene.durationFormatted}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
