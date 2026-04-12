"use client";

import { useEffect, useRef } from "react";
import { Images, Loader2 } from "lucide-react";

import { GalleryCard } from "./gallery-card";
import { GalleryListItem } from "./gallery-list-item";
import { GalleryBrowser } from "./gallery-browser";
import { GalleryTimeline } from "./gallery-timeline";
import type { GalleryViewMode } from "./gallery-filter-bar";
import type { GalleryListItemDto } from "@obscura/contracts";
import { useNsfw } from "./nsfw/nsfw-context";

interface GalleryGridProps {
  galleries: GalleryListItemDto[];
  viewMode: GalleryViewMode;
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  from?: string;
}

export function GalleryGrid({
  galleries,
  viewMode,
  loading,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  from,
}: GalleryGridProps) {
  const { mode: nsfwMode } = useNsfw();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const galleryVisibleInShell = (g: GalleryListItemDto) =>
    nsfwMode !== "off" || g.isNsfw !== true;

  // IntersectionObserver for auto-loading more galleries
  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (loading) {
    return (
      <div className="surface-well flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <div className="h-4 w-4 animate-spin border-2 border-accent-500 border-t-transparent" />
          Loading...
        </div>
      </div>
    );
  }

  if (galleries.length === 0) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center bg-surface-3 mb-4">
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

  const loadMoreSentinel = (
    <>
      {/* Invisible sentinel that triggers loading when scrolled into view */}
      {hasMore && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more galleries...
          </div>
        </div>
      )}
    </>
  );

  /** SFW mode may hide items; empty copy stays neutral (no implication that hidden content exists). */
  const emptyGalleriesInViewMessage = (
    <div className="surface-well flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center bg-surface-3 mb-4">
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

  if (viewMode === "browser") {
    return (
      <>
        <GalleryBrowser galleries={galleries} />
        {loadMoreSentinel}
      </>
    );
  }

  if (viewMode === "timeline") {
    return (
      <>
        <GalleryTimeline galleries={galleries} />
        {loadMoreSentinel}
      </>
    );
  }

  if (viewMode === "list") {
    const listGalleries = galleries.filter(galleryVisibleInShell);
    if (listGalleries.length === 0) {
      return (
        <>
          {emptyGalleriesInViewMessage}
          {loadMoreSentinel}
        </>
      );
    }
    return (
      <>
        <div className="space-y-1">
          {listGalleries.map((gallery) => (
            <GalleryListItem key={gallery.id} gallery={gallery} from={from} />
          ))}
        </div>
        {loadMoreSentinel}
      </>
    );
  }

  // Grid view (default)
  const gridGalleries = galleries.filter(galleryVisibleInShell);
  if (gridGalleries.length === 0) {
    return (
      <>
        {emptyGalleriesInViewMessage}
        {loadMoreSentinel}
      </>
    );
  }
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {gridGalleries.map((gallery, index) => (
          <div
            key={gallery.id}
            style={{ animationDelay: `${Math.min(index, 20) * 20}ms` }}
            className="animate-vault-enter"
          >
            <GalleryCard gallery={gallery} from={from} />
          </div>
        ))}
      </div>
      {loadMoreSentinel}
    </>
  );
}
