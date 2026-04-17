"use client";

import Link from "next/link";
import { Images, Film } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import {
  toApiUrl,
  type GalleryListItem,
  type SceneListItem,
} from "../../lib/api";
import { GalleryEntityCard } from "../galleries/gallery-entity-card";
import { galleryListItemToCardData } from "../galleries/gallery-card-data";
import { SceneCard } from "../videos/video-card";
import { videoListItemToCardData } from "../videos/video-card-data";
import { DASHBOARD_STAT_GRADIENTS, formatIngestStamp } from "./dashboard-utils";
import { useNsfw } from "../nsfw/nsfw-context";
import { useTerms } from "../../lib/terminology";

const MERGE_CAP = 11;

type IngestRow =
  | { kind: "video"; at: string; scene: SceneListItem }
  | { kind: "gallery"; at: string; gallery: GalleryListItem };

function mergeIngest(
  scenes: SceneListItem[],
  galleries: GalleryListItem[]
): IngestRow[] {
  const rows: IngestRow[] = [
    ...scenes.map((scene) => ({
      kind: "video" as const,
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
  index,
  from,
}: {
  scene: SceneListItem;
  index: number;
  from?: string;
}) {
  return (
    <div className="snap-start shrink-0 w-[min(78vw,280px)] sm:w-[240px]">
      <div className="focus-within:ring-2 focus-within:ring-border-accent-strong focus-within:ring-offset-2 focus-within:ring-offset-bg">
        <SceneCard
          scene={videoListItemToCardData(scene, from)}
          index={index}
          imageLoading="lazy"
        />
      </div>
      <p className="text-mono-sm text-text-disabled mt-1.5 px-0.5">
        {formatIngestStamp(scene.createdAt)}
      </p>
    </div>
  );
}

function GalleryIngestTile({
  gallery,
  from,
}: {
  gallery: GalleryListItem;
  from?: string;
}) {
  return (
    <div className="snap-start shrink-0 w-[min(78vw,280px)] sm:w-[240px]">
      <div className="focus-within:ring-2 focus-within:ring-border-accent-strong focus-within:ring-offset-2 focus-within:ring-offset-bg">
        <GalleryEntityCard
          gallery={galleryListItemToCardData(gallery, from)}
          aspectRatio="video"
        />
      </div>
      <p className="text-mono-sm text-text-disabled mt-1.5 px-0.5">
        {formatIngestStamp(gallery.createdAt)}
      </p>
    </div>
  );
}

function IngestSkeleton() {
  const slots = [
    { w: "w-[min(78vw,280px)] sm:w-[240px]", aspect: "aspect-video" },
    { w: "w-[min(78vw,280px)] sm:w-[240px]", aspect: "aspect-video" },
    { w: "w-[min(78vw,280px)] sm:w-[240px]", aspect: "aspect-video" },
    { w: "w-[min(78vw,280px)] sm:w-[240px]", aspect: "aspect-video" },
  ] as const;

  return (
    <div className="flex gap-2.5 overflow-hidden">
      {slots.map((slot, i) => (
        <div key={i} className={cn("shrink-0 space-y-2", slot.w)}>
          <div
            className={cn(
              "w-full border border-border-subtle bg-surface-2/80 animate-pulse",
              slot.aspect
            )}
          />
          {slot.aspect === "aspect-video" && (
            <>
              <div className="h-3 w-3/4 bg-surface-2/80 animate-pulse" />
              <div className="h-3 w-1/2 bg-surface-2/80 animate-pulse" />
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
  const { mode } = useNsfw();
  const terms = useTerms();

  const allMerged = mergeIngest(scenes, galleries);
  // In SFW mode, filter out NSFW items entirely so they leave no blank space
  const merged = mode === "off"
    ? allMerged.filter((r) => r.kind === "video" ? !r.scene.isNsfw : !r.gallery.isNsfw)
    : allMerged;

  const showStillsSlot =
    !loading && galleries.length === 0 && merged.some((r) => r.kind === "video");

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">New Additions</h2>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link
            href="/videos"
            className="glass-chip border border-white/6 px-2.5 py-1 text-[0.7rem] font-medium text-text-muted hover:border-border-accent hover:text-text-accent transition-colors duration-fast"
          >
            <span className="inline-flex items-center gap-1.5">
              <Film className="h-3 w-3 opacity-70" />
              {terms.scenes}
            </span>
          </Link>
          <Link
            href="/galleries"
            className="glass-chip border border-white/6 px-2.5 py-1 text-[0.7rem] font-medium text-text-muted hover:border-border-accent hover:text-text-accent transition-colors duration-fast"
          >
            <span className="inline-flex items-center gap-1.5">
              <Images className="h-3 w-3 opacity-70" />
              Galleries
            </span>
          </Link>
        </div>
      </div>

      <div className="surface-card no-lift p-3 sm:p-4">
        {loading ? (
          <IngestSkeleton />
        ) : merged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-4">
            <div className="flex h-11 w-11 items-center justify-center border border-border-subtle bg-surface-2 mb-3">
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
              if (row.kind === "video") {
                return (
                  <SceneIngestTile
                    key={`s-${row.scene.id}`}
                    scene={row.scene}
                    index={i}
                    from="/"
                  />
                );
              }
              return (
                <GalleryIngestTile
                  key={`g-${row.gallery.id}`}
                  gallery={row.gallery}
                  from="/"
                />
              );
            })}

            {showStillsSlot && (
              <div className="snap-start shrink-0 flex w-[min(48vw,152px)] sm:w-[136px] flex-col justify-between border border-dashed border-border-default bg-surface-1/40 px-2.5 py-3">
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
