"use client";

import { Images, Star } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../lib/api";
import type { GalleryListItemDto } from "@obscura/contracts";

interface GalleryListItemProps {
  gallery: GalleryListItemDto;
}

export function GalleryListItem({ gallery }: GalleryListItemProps) {
  const coverUrl = toApiUrl(gallery.coverImagePath);

  return (
    <div className="surface-card-sharp flex items-center gap-3 px-3 py-2 group hover:bg-surface-2 transition-colors duration-fast">
      {/* Thumbnail */}
      <div className="w-16 aspect-[4/3] bg-surface-2 rounded-sm overflow-hidden flex-shrink-0">
        {coverUrl ? (
          <img
            src={coverUrl}
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
      </div>

      {/* Title + info */}
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
          <span className="tag-chip tag-chip-default text-[0.55rem]">{gallery.galleryType}</span>
        </div>
      </div>

      {/* Rating */}
      {gallery.rating != null && (
        <div className="flex items-center gap-0.5 text-accent-500">
          <Star className="h-3 w-3 fill-current" />
          <span className="text-[0.65rem]">{Math.round(gallery.rating / 20)}</span>
        </div>
      )}
    </div>
  );
}
