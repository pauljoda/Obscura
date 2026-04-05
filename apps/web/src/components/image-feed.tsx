"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, ImageOff, Film, Star, Tag, Calendar, HardDrive } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../lib/api";
import { useElementInView } from "../hooks/use-element-in-view";
import { isVideoImage, canUseInlineVideoPreview } from "../lib/image-media";
import type { ImageListItemDto } from "@obscura/contracts";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

interface ImageFeedProps {
  images: ImageListItemDto[];
  onImageClick?: (index: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export function ImageFeed({
  images,
  onImageClick,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
}: ImageFeedProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "600px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (images.length === 0) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16 text-center">
        <ImageOff className="h-8 w-8 text-text-disabled mb-2" />
        <p className="text-text-muted text-sm">No images found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {images.map((image, index) => (
        <FeedCard
          key={image.id}
          image={image}
          onClick={() => onImageClick?.(index)}
        />
      ))}

      {hasMore && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more...
          </div>
        </div>
      )}
    </div>
  );
}

function FeedCard({
  image,
  onClick,
}: {
  image: ImageListItemDto;
  onClick: () => void;
}) {
  const [error, setError] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useElementInView(containerRef, { rootMargin: "400px" });

  const thumbUrl = toApiUrl(image.thumbnailPath);
  const previewUrl = toApiUrl(image.previewPath);
  const fullUrl = toApiUrl(image.fullPath);
  const isVideo = isVideoImage(image);
  const canPreview = canUseInlineVideoPreview(image) && !previewFailed;
  const showVideoPreview = isVideo && canPreview && isInView;

  const handleError = useCallback(() => setError(true), []);

  const ratingStars = image.rating ? Math.round(image.rating / 20) : 0;
  const sizeStr = formatFileSize(image.fileSize);

  return (
    <div
      ref={containerRef}
      className="surface-card-sharp overflow-hidden"
    >
      {/* Media area */}
      <button
        type="button"
        onClick={onClick}
        className="block w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-inset"
      >
        <div className="relative bg-surface-2">
          {!isInView ? (
            <div className="aspect-video" />
          ) : error || !thumbUrl ? (
            <div className="flex items-center justify-center bg-surface-2 aspect-video">
              <ImageOff className="h-8 w-8 text-text-disabled" />
            </div>
          ) : showVideoPreview && previewUrl ? (
            <video
              src={previewUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              poster={thumbUrl}
              onError={() => setPreviewFailed(true)}
              className="w-full object-contain bg-black"
              style={{ maxHeight: "70vh" }}
            />
          ) : (
            <img
              src={fullUrl ?? thumbUrl}
              alt={image.title}
              loading="lazy"
              decoding="async"
              onError={handleError}
              className="w-full object-contain bg-black"
              style={{ maxHeight: "70vh" }}
            />
          )}

          {isVideo && (
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-sm bg-black/70 px-2 py-1 text-xs text-white/90 backdrop-blur-sm">
              <Film className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      </button>

      {/* Metadata area */}
      <div className="px-4 py-3 space-y-2">
        {/* Title */}
        <h3 className="text-sm font-medium text-text-primary truncate">
          {image.title}
        </h3>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] text-text-muted">
          {image.date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {image.date}
            </span>
          )}
          {sizeStr && (
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {sizeStr}
            </span>
          )}
          {image.width && image.height && (
            <span className="font-mono text-text-disabled">
              {image.width}×{image.height}
            </span>
          )}
          {image.format && (
            <span className="font-mono text-text-disabled uppercase">
              {image.format}
            </span>
          )}
        </div>

        {/* Rating */}
        {ratingStars > 0 && (
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-3.5 w-3.5",
                  i < ratingStars
                    ? "text-accent-500 fill-accent-500"
                    : "text-text-disabled"
                )}
              />
            ))}
          </div>
        )}

        {/* Tags */}
        {image.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {image.tags.map((tag) => (
              <span
                key={tag.id}
                className="tag-chip tag-chip-default text-[0.6rem]"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
