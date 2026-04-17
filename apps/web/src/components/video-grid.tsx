"use client";

import { useEffect, useRef } from "react";
import { Film, Loader2 } from "lucide-react";
import type { ViewMode } from "../lib/video-browse-types";
import type { VideoListItem } from "../lib/api";
import { useTerms } from "../lib/terminology";
import { VideoCard } from "./videos/video-card";
import { videoListItemToCardData } from "./videos/video-card-data";

interface VideoGridProps {
  videos: VideoListItem[];
  viewMode: ViewMode;
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Current page path — when provided, video cards include a `from` query param so the detail back button returns here. */
  from?: string;
}

export function VideoGrid({ videos, viewMode, loading, hasMore = false, loadingMore = false, onLoadMore, selectedIds, onToggleSelect, from }: VideoGridProps) {
  const terms = useTerms();
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  const loadMoreSentinel = (
    <>
      {hasMore && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more {terms.videos.toLowerCase()}...
          </div>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-text-accent animate-spin mb-3" />
        <p className="text-text-muted text-sm">Loading {terms.videos.toLowerCase()}...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <Film className="h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted text-sm">No {terms.videos.toLowerCase()} found.</p>
        <p className="text-text-disabled text-xs mt-1">
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <>
        <div className="space-y-1">
          {videos.map((video, i) => (
            <VideoCard
              key={video.id}
              video={videoListItemToCardData(video, from)}
              variant="list"
              index={i}
              selected={selectedIds?.has(video.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
        {loadMoreSentinel}
      </>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {videos.map((video, i) => (
        <VideoCard
          key={video.id}
          video={videoListItemToCardData(video, from)}
          index={i}
          imageLoading={i < 8 ? "eager" : "lazy"}
        />
      ))}
    </div>
    {loadMoreSentinel}
    </>
  );
}
