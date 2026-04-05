"use client";

import Link from "next/link";
import { Images, Film } from "lucide-react";
import { MediaCard, cn } from "@obscura/ui";
import {
  toApiUrl,
  type GalleryListItem,
  type SceneListItem,
} from "../../lib/api";
import { SCENE_TAG_COLORS } from "../scene-tag-colors";
import { DASHBOARD_STAT_GRADIENTS, formatIngestStamp } from "./dashboard-utils";

const MERGE_CAP = 11;

type IngestRow =
  | { kind: "scene"; at: string; scene: SceneListItem }
  | { kind: "gallery"; at: string; gallery: GalleryListItem };

function mergeIngest(
  scenes: SceneListItem[],
  galleries: GalleryListItem[]
): IngestRow[] {
  const rows: IngestRow[] = [
    ...scenes.map((scene) => ({
      kind: "scene" as const,
      at: scene.createdAt,
      scene,
    })),
    ...galleries.map((gallery) => ({
      kind: "gallery" as const,
      at: gallery.createdAt,
      gallery,
    })),
  ];
  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return rows.slice(0, MERGE_CAP);
}

function SceneIngestTile({
  scene,
  gradientClass,
}: {
  scene: SceneListItem;
  gradientClass: string;
}) {
  return (
    <div className="snap-start shrink-0 w-[min(78vw,280px)] sm:w-[240px]">
      <Link
        href={`/scenes/${scene.id}`}
        className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <MediaCard
          title={scene.title}
          thumbnail={toApiUrl(scene.thumbnailPath)}
          cardThumbnail={scene.thumbnailPath?.includes("thumb-custom") ? undefined : toApiUrl(scene.cardThumbnailPath)}
          trickplaySprite={toApiUrl(scene.spritePath)}
          trickplayVtt={toApiUrl(scene.trickplayVttPath)}
          scrubDurationSeconds={scene.duration ?? undefined}
          duration={scene.durationFormatted ?? undefined}
          resolution={scene.resolution ?? undefined}
          codec={scene.codec ?? undefined}
          fileSize={scene.fileSizeFormatted ?? undefined}
          performers={scene.performers.map((p) => ({ name: p.name, imagePath: toApiUrl(p.imagePath) ?? undefined }))}
          tags={scene.tags.map((t) => t.name)}
          tagColors={SCENE_TAG_COLORS}
          rating={scene.rating ?? undefined}
          views={scene.playCount}
          gradientClass={gradientClass}
        />
      </Link>
      <p className="text-mono-sm text-text-disabled mt-1.5 px-0.5">
        {formatIngestStamp(scene.createdAt)}
      </p>
    </div>
  );
}

function GalleryIngestTile({
  gallery,
  gradientClass,
}: {
  gallery: GalleryListItem;
  gradientClass: string;
}) {
  const thumb = gallery.coverImagePath ? toApiUrl(gallery.coverImagePath) : null;

  return (
    <Link
      href="/galleries"
      className="group snap-start shrink-0 w-[min(52vw,168px)] sm:w-[148px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-sm border border-border-subtle bg-surface-1 transition-[border-color,box-shadow] duration-normal",
          "group-hover:border-border-accent group-hover:shadow-[var(--shadow-card-hover)]"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-normal",
            thumb ? "opacity-0 group-hover:opacity-40" : "opacity-100",
            gradientClass
          )}
        />
        {thumb && (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute left-1.5 top-1.5">
          <span className="glass-chip-accent rounded-sm px-1.5 py-0.5 text-[0.55rem] font-mono font-semibold uppercase tracking-[0.14em] text-accent-100">
            Stills
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/8 bg-[color-mix(in_srgb,var(--color-overlay-glass)_88%,transparent)] px-2 py-1.5 backdrop-blur-md">
          <p className="truncate text-[0.78rem] font-medium leading-tight text-text-primary">
            {gallery.title}
          </p>
          <p className="text-mono-sm text-text-disabled mt-0.5">
            {gallery.imageCount} file{gallery.imageCount !== 1 ? "s" : ""} ·{" "}
            {formatIngestStamp(gallery.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function IngestSkeleton() {
  const slots = [
    { w: "w-[min(78vw,280px)] sm:w-[240px]", aspect: "aspect-video" },
    { w: "w-[min(52vw,168px)] sm:w-[148px]", aspect: "aspect-[3/4]" },
    { w: "w-[min(78vw,280px)] sm:w-[240px]", aspect: "aspect-video" },
    { w: "w-[min(52vw,168px)] sm:w-[148px]", aspect: "aspect-[3/4]" },
  ] as const;

  return (
    <div className="flex gap-2.5 overflow-hidden">
      {slots.map((slot, i) => (
        <div key={i} className={cn("shrink-0 space-y-2", slot.w)}>
          <div
            className={cn(
              "w-full rounded-sm border border-border-subtle bg-surface-2/80 animate-pulse",
              slot.aspect
            )}
          />
          {slot.aspect === "aspect-video" && (
            <>
              <div className="h-3 w-3/4 rounded-xs bg-surface-2/80 animate-pulse" />
              <div className="h-3 w-1/2 rounded-xs bg-surface-2/80 animate-pulse" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function DashboardRecentAdditions({
  loading,
  scenes,
  galleries,
}: {
  loading: boolean;
  scenes: SceneListItem[];
  galleries: GalleryListItem[];
}) {
  const merged = mergeIngest(scenes, galleries);
  const showStillsSlot =
    !loading && galleries.length === 0 && merged.some((r) => r.kind === "scene");

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight font-heading">New</h2>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link
            href="/scenes"
            className="glass-chip rounded-sm border border-white/6 px-2.5 py-1 text-[0.7rem] font-medium text-text-muted hover:border-border-accent hover:text-text-accent transition-colors duration-fast"
          >
            <span className="inline-flex items-center gap-1.5">
              <Film className="h-3 w-3 opacity-70" />
              Scenes
            </span>
          </Link>
          <Link
            href="/galleries"
            className="glass-chip rounded-sm border border-white/6 px-2.5 py-1 text-[0.7rem] font-medium text-text-muted hover:border-border-accent hover:text-text-accent transition-colors duration-fast"
          >
            <span className="inline-flex items-center gap-1.5">
              <Images className="h-3 w-3 opacity-70" />
              Galleries
            </span>
          </Link>
        </div>
      </div>

      <div className="surface-card-sharp no-lift p-3 sm:p-4">
        {loading ? (
          <IngestSkeleton />
        ) : merged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-border-subtle bg-surface-2 mb-3">
              <Film className="h-5 w-5 text-text-disabled" />
            </div>
            <p className="text-sm text-text-muted">No recent items.</p>
            <Link
              href="/settings"
              className="mt-3 text-xs font-medium text-text-accent hover:text-text-accent-bright transition-colors duration-fast"
            >
              Settings →
            </Link>
          </div>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-hidden snap-x snap-mandatory">
            {merged.map((row, i) => {
              const g = DASHBOARD_STAT_GRADIENTS[i % DASHBOARD_STAT_GRADIENTS.length];
              if (row.kind === "scene") {
                return (
                  <SceneIngestTile
                    key={`s-${row.scene.id}`}
                    scene={row.scene}
                    gradientClass={g}
                  />
                );
              }
              return (
                <GalleryIngestTile
                  key={`g-${row.gallery.id}`}
                  gallery={row.gallery}
                  gradientClass={g}
                />
              );
            })}

            {showStillsSlot && (
              <div className="snap-start shrink-0 flex w-[min(48vw,152px)] sm:w-[136px] flex-col justify-between rounded-sm border border-dashed border-border-default bg-surface-1/40 px-2.5 py-3">
                <Images className="h-4 w-4 text-text-disabled mb-2" />
                <p className="text-[0.68rem] text-text-muted leading-snug">
                  No stills in index yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
