"use client";

import { useRef, useState, useCallback } from "react";
import { Images, FolderOpen, Archive, Sparkles } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../lib/api";
import type { GalleryListItemDto } from "@obscura/contracts";

const typeIcons = {
  folder: FolderOpen,
  zip: Archive,
  virtual: Sparkles,
} as const;

interface GalleryCardProps {
  gallery: GalleryListItemDto;
}

export function GalleryCard({ gallery }: GalleryCardProps) {
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(-1);
  const [videoFailed, setVideoFailed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const coverUrl = toApiUrl(gallery.coverImagePath);
  const previews = gallery.previewImagePaths?.map(toApiUrl).filter(Boolean) ?? [];

  // Derive animated preview URL from the first preview thumb path
  // /assets/images/:id/thumb → /assets/images/:id/preview
  const previewVideoUrl = previews[0]
    ? previews[0].replace(/\/thumb$/, "/preview")
    : null;

  const startScrub = useCallback(() => {
    if (previews.length <= 1) return;
    let idx = 0;
    setCurrentPreviewIndex(0);
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % previews.length;
      setCurrentPreviewIndex(idx);
    }, 800);
  }, [previews.length]);

  const stopScrub = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCurrentPreviewIndex(-1);
  }, []);

  const displayUrl = currentPreviewIndex >= 0 ? previews[currentPreviewIndex] : coverUrl;
  const TypeIcon = typeIcons[gallery.galleryType] ?? FolderOpen;

  return (
    <div
      className="surface-card-sharp media-card-shell group relative overflow-hidden"
      onPointerEnter={startScrub}
      onPointerLeave={stopScrub}
    >
      {/* Cover image / video */}
      <div className="relative aspect-[4/3] bg-surface-2 overflow-hidden">
        {/* Try animated video preview first, fall back to static image */}
        {previewVideoUrl && !videoFailed ? (
          <video
            src={previewVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            onError={() => setVideoFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : displayUrl ? (
          <img
            src={displayUrl}
            alt={gallery.title}
            className="h-full w-full object-cover transition-opacity duration-fast"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Images className="h-10 w-10 text-text-disabled" />
          </div>
        )}

        {/* Image count badge */}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-white/90 backdrop-blur-sm">
          <Images className="h-3 w-3" />
          {gallery.imageCount}
        </div>

        {/* Type badge */}
        <div className="absolute top-1.5 right-1.5 rounded-sm bg-black/60 p-1 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
          <TypeIcon className="h-3 w-3 text-white/80" />
        </div>

        {/* Scrub progress bar */}
        {currentPreviewIndex >= 0 && previews.length > 1 && videoFailed && (
          <div className="absolute bottom-0 left-0 right-0 flex gap-0.5 px-1 pb-0.5">
            {previews.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors duration-fast",
                  i === currentPreviewIndex ? "bg-accent-500" : "bg-white/30"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-2.5 py-2">
        <h3 className="text-[0.78rem] font-medium text-text-primary truncate">
          {gallery.title}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          {gallery.date && (
            <span className="text-[0.65rem] text-text-muted">{gallery.date}</span>
          )}
          {gallery.rating != null && (
            <span className="text-[0.65rem] text-accent-500">{"★".repeat(Math.round(gallery.rating / 20))}</span>
          )}
        </div>
        {gallery.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {gallery.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="tag-chip tag-chip-default text-[0.55rem]">
                {tag.name}
              </span>
            ))}
            {gallery.tags.length > 3 && (
              <span className="text-[0.55rem] text-text-disabled">+{gallery.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
