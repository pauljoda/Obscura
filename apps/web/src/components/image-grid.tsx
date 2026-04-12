"use client";

import { useEffect, useRef } from "react";
import { Loader2, ImageOff } from "lucide-react";
import type { ImageListItemDto } from "@obscura/contracts";
import { ImageEntityCard } from "./images/image-entity-card";
import { imageItemToCardData } from "./images/image-card-data";

interface ImageGridProps {
  images: ImageListItemDto[];
  onImageClick?: (index: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  from?: string;
}

export function ImageGrid({
  images,
  onImageClick,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  from,
}: ImageGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "600px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (images.length === 0) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16 text-center">
        <ImageOff className="h-8 w-8 text-text-disabled mb-2" />
        <p className="text-text-muted text-sm">No images in this gallery</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-1"
        style={{ contentVisibility: "auto" }}
      >
        {images.map((image, index) => (
          <ImageEntityCard
            key={image.id}
            image={imageItemToCardData(image, from)}
            onSelect={() => onImageClick?.(index)}
          />
        ))}
      </div>

      {hasMore && <div ref={sentinelRef} className="h-1 w-full" aria-hidden />}
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
