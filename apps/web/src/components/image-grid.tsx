"use client";

import { useState, useCallback } from "react";
import { Loader2, ImageOff } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";

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
        className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-1"
        style={{ contentVisibility: "auto" }}
      >
        {images.map((image, index) => (
          <ImageCell
            key={image.id}
            image={image}
            index={index}
            onClick={() => onImageClick?.(index)}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm",
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

function ImageCell({
  image,
  index,
  onClick,
}: {
  image: ImageListItemDto;
  index: number;
  onClick: () => void;
}) {
  const [error, setError] = useState(false);
  const thumbUrl = toApiUrl(image.thumbnailPath);

  const handleError = useCallback(() => setError(true), []);

  return (
    <button
      onClick={onClick}
      className="block w-full mb-1 break-inside-avoid cursor-pointer group focus:outline-none focus:ring-2 focus:ring-accent-500 rounded-sm overflow-hidden"
    >
      {error || !thumbUrl ? (
        <div className="flex items-center justify-center bg-surface-2 aspect-square">
          <ImageOff className="h-6 w-6 text-text-disabled" />
        </div>
      ) : (
        <img
          src={thumbUrl}
          alt={image.title}
          loading={index < 8 ? "eager" : "lazy"}
          decoding="async"
          onError={handleError}
          className="w-full object-cover rounded-sm group-hover:brightness-110 transition-all duration-fast"
        />
      )}
    </button>
  );
}
