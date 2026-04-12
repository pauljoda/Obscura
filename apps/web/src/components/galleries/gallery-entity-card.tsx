"use client";

import Link from "next/link";
import { Archive, FolderOpen, Images, Sparkles, Star } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { GalleryCardData } from "./gallery-card-data";
import { NsfwBlur, NsfwShowModeChip, NsfwTagLabel, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { EntityPreviewMedia } from "../shared/entity-preview-media";

const typeIcons = {
  folder: FolderOpen,
  zip: Archive,
  virtual: Sparkles,
} as const;

interface GalleryEntityCardProps {
  gallery: GalleryCardData;
  variant?: "grid" | "list" | "compact";
  aspectRatio?: "video" | "standard" | "portrait";
  onSelect?: (href: string) => void;
}

export function GalleryEntityCard({
  gallery,
  variant = "grid",
  aspectRatio = "standard",
  onSelect,
}: GalleryEntityCardProps) {
  if (variant === "list") {
    return <GalleryListCard gallery={gallery} />;
  }

  if (variant === "compact") {
    return <GalleryCompactCard gallery={gallery} onSelect={onSelect} />;
  }

  return <GalleryGridCard gallery={gallery} aspectRatio={aspectRatio} />;
}

function GalleryGridCard({ 
  gallery, 
  aspectRatio = "standard" 
}: { 
  gallery: GalleryCardData;
  aspectRatio?: "video" | "standard" | "portrait";
}) {
  const { mode: nsfwMode } = useNsfw();
  const visibleGalleryTags = tagsVisibleInNsfwMode(gallery.tags, nsfwMode);
  const previews = gallery.previewImages;
  const previewVideoUrl = previews[0] ? previews[0].replace(/\/thumb$/, "/preview") : null;
  const TypeIcon = typeIcons[gallery.galleryType] ?? FolderOpen;

  const aspectClass = 
    aspectRatio === "video" ? "aspect-video" : 
    aspectRatio === "portrait" ? "aspect-[3/4]" : 
    "aspect-[4/3]";

  return (
    <NsfwBlur isNsfw={gallery.isNsfw ?? false} className="h-full">
      <Link href={gallery.href} className="block h-full">
        <div className="surface-card media-card-shell group relative h-full overflow-hidden">
          <EntityPreviewMedia
            title={gallery.title}
            mode="cover-or-cycle"
            coverImage={gallery.coverImage}
            previewImages={gallery.previewImages}
            previewVideoUrl={previewVideoUrl}
            showVideoOnHover
            className={cn("relative overflow-hidden", aspectClass)}
            imageClassName="object-contain"
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <Images className="h-10 w-10 text-text-disabled" />
              </div>
            }
          >
            <NsfwShowModeChip
              isNsfw={gallery.isNsfw}
              className="absolute bottom-2 right-2 z-10 pointer-events-none"
            />

            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-white/90 backdrop-blur-sm">
              <Images className="h-3 w-3" />
              {gallery.imageCount}
            </div>

            <div className="absolute top-1.5 right-1.5 bg-black/60 p-1 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
              <TypeIcon className="h-3 w-3 text-white/80" />
            </div>
          </EntityPreviewMedia>

          <div className="px-2.5 py-2">
            <h3 className="text-[0.78rem] font-medium text-text-primary truncate">
              {gallery.title}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {gallery.date && (
                <span className="text-[0.65rem] text-text-muted">{gallery.date}</span>
              )}
              {gallery.rating != null && (
                <span className="text-[0.65rem] text-accent-500">
                  {"★".repeat(Math.round(gallery.rating / 20))}
                </span>
              )}
            </div>
            {visibleGalleryTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {visibleGalleryTags.slice(0, 3).map((tag) => (
                  <span key={tag.name} className="tag-chip tag-chip-default text-[0.55rem]">
                    <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                  </span>
                ))}
                {visibleGalleryTags.length > 3 && (
                  <span className="text-[0.55rem] text-text-disabled">
                    +{visibleGalleryTags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </NsfwBlur>
  );
}

function GalleryListCard({ gallery }: { gallery: GalleryCardData }) {
  return (
    <NsfwBlur isNsfw={gallery.isNsfw ?? false} className="block">
      <Link href={gallery.href}>
        <div className="surface-card-sharp flex items-center gap-3 px-3 py-2 group hover:bg-surface-2 transition-colors duration-fast">
          <div className="relative w-16 aspect-[4/3] flex-shrink-0 overflow-hidden bg-surface-2">
            {gallery.coverImage ? (
              <img
                src={gallery.coverImage}
                alt={gallery.title}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Images className="h-4 w-4 text-text-disabled" />
              </div>
            )}
            <NsfwShowModeChip
              isNsfw={gallery.isNsfw}
              compact
              className="pointer-events-none absolute bottom-0.5 right-0.5 z-10"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-[0.78rem] font-medium text-text-primary truncate">
              {gallery.title}
            </h3>
            <div className="flex items-center gap-3 mt-0.5 text-[0.65rem] text-text-muted">
              <span className="flex items-center gap-1">
                <Images className="h-3 w-3" />
                {gallery.imageCount}
              </span>
              {gallery.date && <span>{gallery.date}</span>}
              <span className="tag-chip tag-chip-default text-[0.55rem]">
                {gallery.galleryType}
              </span>
            </div>
          </div>

          {gallery.rating != null && (
            <div className="flex items-center gap-0.5 text-accent-500">
              <Star className="h-3 w-3 fill-current" />
              <span className="text-[0.65rem]">{Math.round(gallery.rating / 20)}</span>
            </div>
          )}
        </div>
      </Link>
    </NsfwBlur>
  );
}

function GalleryCompactCard({
  gallery,
  onSelect,
}: {
  gallery: GalleryCardData;
  onSelect?: (href: string) => void;
}) {
  const content = (
    <>
      <div className="shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-12 ">
        {gallery.coverImage ? (
          <img src={gallery.coverImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <Images className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{gallery.title}</div>
        <div className="text-[0.68rem] text-text-muted truncate">
          {gallery.imageCount} images · {gallery.galleryType}
        </div>
      </div>

      <span className="shrink-0 tag-chip tag-chip-default text-[0.6rem]">
        gallery
      </span>
    </>
  );

  if (onSelect) {
    return (
      <NsfwBlur isNsfw={gallery.isNsfw ?? false} className="block w-full text-left">
        <button
          type="button"
          onClick={() => onSelect(gallery.href)}
          className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
        >
          {content}
        </button>
      </NsfwBlur>
    );
  }

  return (
    <NsfwBlur isNsfw={gallery.isNsfw ?? false} className="block w-full">
      <Link
        href={gallery.href}
        className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
      >
        {content}
      </Link>
    </NsfwBlur>
  );
}
