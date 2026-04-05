"use client";

import Link from "next/link";
import { Images } from "lucide-react";
import { GalleryCard } from "./gallery-card";
import { GalleryListItem } from "./gallery-list-item";
import { GalleryBrowser } from "./gallery-browser";
import { GalleryTimeline } from "./gallery-timeline";
import type { GalleryViewMode } from "./gallery-filter-bar";
import type { GalleryListItemDto } from "@obscura/contracts";

interface GalleryGridProps {
  galleries: GalleryListItemDto[];
  viewMode: GalleryViewMode;
  loading?: boolean;
}

export function GalleryGrid({ galleries, viewMode, loading }: GalleryGridProps) {
  if (loading) {
    return (
      <div className="surface-well flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          Loading...
        </div>
      </div>
    );
  }

  if (galleries.length === 0) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-3 mb-4">
          <Images className="h-8 w-8 text-text-disabled" />
        </div>
        <h3 className="text-base font-medium font-heading text-text-secondary mb-1">
          No galleries found
        </h3>
        <p className="text-text-muted text-sm max-w-xs">
          Try adjusting your filters or run a library scan to discover galleries.
        </p>
      </div>
    );
  }

  if (viewMode === "browser") {
    return <GalleryBrowser galleries={galleries} />;
  }

  if (viewMode === "timeline") {
    return <GalleryTimeline galleries={galleries} />;
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-1">
        {galleries.map((gallery) => (
          <Link key={gallery.id} href={`/galleries/${gallery.id}`}>
            <GalleryListItem gallery={gallery} />
          </Link>
        ))}
      </div>
    );
  }

  // Grid view (default)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {galleries.map((gallery, index) => (
        <Link
          key={gallery.id}
          href={`/galleries/${gallery.id}`}
          style={{ animationDelay: `${index * 20}ms` }}
          className="animate-vault-enter"
        >
          <GalleryCard gallery={gallery} />
        </Link>
      ))}
    </div>
  );
}
