"use client";

import { Loader2, ImageOff } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { ImageListItemDto } from "@obscura/contracts";
import { ImageEntityCard } from "./images/image-entity-card";
import { imageItemToCardData } from "./images/image-card-data";

interface ImageGridProps {
  images: ImageListItemDto[];
  onImageClick?: (index: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export function ImageGrid({
  images,
  onImageClick,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
}: ImageGridProps) {
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
            image={imageItemToCardData(image)}
            onSelect={() => onImageClick?.(index)}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm",
              "bg-surface-2 text-text-muted hover:text-text-primary hover:bg-surface-3",
              "transition-colors duration-fast",
              loadingMore && "opacity-50 cursor-wait"
            )}
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            {loadingMore ? "Loading..." : "Load more images"}
          </button>
        </div>
      )}
    </div>
  );
}
