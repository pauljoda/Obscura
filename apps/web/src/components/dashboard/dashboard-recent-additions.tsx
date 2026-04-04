"use client";

import Link from "next/link";
import { Images, Film } from "lucide-react";
import { cn } from "@obscura/ui";
import {
  toApiUrl,
  type GalleryListItem,
  type SceneListItem,
} from "../../lib/api";
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
  const thumb =
    toApiUrl(scene.cardThumbnailPath) || toApiUrl(scene.thumbnailPath);

  return (
    <Link
      href={`/scenes/${scene.id}`}
      className="group snap-start shrink-0 w-[min(78vw,280px)] sm:w-[240px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden rounded-sm border border-border-subtle bg-surface-1 transition-[border-color,box-shadow] duration-normal",
          "group-hover:border-border-accent group-hover:shadow-[var(--shadow-card-hover)]"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-normal",
            thumb ? "opacity-0 group-hover:opacity-35" : "opacity-100",
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
          <span className="glass-chip rounded-sm px-1.5 py-0.5 text-[0.55rem] font-mono font-semibold uppercase tracking-[0.14em] text-white/85 border border-white/10">
            Motion
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/8 bg-[color-mix(in_srgb,var(--color-overlay-glass)_88%,transparent)] px-2 py-1.5 backdrop-blur-md">
          <p className="truncate text-[0.78rem] font-medium leading-tight text-text-primary">
            {scene.title}
          </p>
          <p className="text-mono-sm text-text-disabled mt-0.5">
            {formatIngestStamp(scene.createdAt)}
            {scene.durationFormatted ? (
              <span className="text-text-disabled/80"> · {scene.durationFormatted}</span>
            ) : null}
          </p>
        </div>
      </div>
    </Link>
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
  return (
    <div className="flex gap-2 overflow-hidden">
      {[
        "min-w-[240px] aspect-video",
        "min-w-[148px] aspect-[3/4]",
        "min-w-[240px] aspect-video",
        "min-w-[148px] aspect-[3/4]",
      ].map((cls, i) => (
        <div
          key={i}
          className={cn(
            "shrink-0 rounded-sm border border-border-subtle bg-surface-2/80 animate-pulse",
            cls
          )}
        />
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
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-kicker">Ingest</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight font-heading">
            Recent additions
          </h2>
          <p className="text-mono-sm text-text-disabled mt-1 max-w-md leading-relaxed">
            Motion and stills sorted by when they entered the index — scrub sideways.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link
            href="/scenes"
            className="glass-chip rounded-sm border border-white/6 px-2.5 py-1 text-[0.7rem] font-medium text-text-muted hover:border-border-accent hover:text-text-accent transition-colors duration-fast"
          >
            <span className="inline-flex items-center gap-1.5">
              <Film className="h-3 w-3 opacity-70" />
              All video
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
            <p className="text-sm text-text-muted max-w-sm">
              Nothing new in the index yet. Run a library scan after you point Obscura at a
              media root.
            </p>
            <Link
              href="/settings"
              className="mt-3 text-xs font-medium text-text-accent hover:text-text-accent-bright transition-colors duration-fast"
            >
              Library settings →
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
                <div>
                  <p className="text-[0.72rem] font-medium text-text-secondary leading-snug">
                    Stills slot
                  </p>
                  <p className="text-[0.62rem] text-text-disabled mt-1.5 leading-relaxed">
                    Folder-based galleries are not in the index yet. They will show up here next
                    to new video.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
