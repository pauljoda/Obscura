"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  X,
  ChevronUp,
  ChevronDown,
  Film,
  Images,
  Layers,
  Music,
} from "lucide-react";
import type { CollectionEntityType } from "@obscura/contracts";
import { usePlaylistContext } from "./playlist-context";
import { PlaylistQueueSheet } from "./playlist-queue-sheet";
import { getEntityHref } from "./collection-item-helpers";

const typeIcons: Record<CollectionEntityType, typeof Film> = {
  scene: Film,
  gallery: Images,
  image: Layers,
  "audio-track": Music,
};

/**
 * Global floating playlist controller bar.
 * Renders at the bottom of the viewport when a playlist is active.
 * Shows current item, transport controls, and an expandable queue sheet.
 */
export function PlaylistController() {
  const playlist = usePlaylistContext();
  const [showQueue, setShowQueue] = useState(false);

  if (!playlist.isActive) return null;

  const currentTitle =
    (playlist.currentItem?.entity?.title as string) ?? "Untitled";
  const CurrentTypeIcon = playlist.currentItem
    ? typeIcons[playlist.currentItem.entityType]
    : Film;

  return (
    <>
      <PlaylistQueueSheet
        open={showQueue}
        onClose={() => setShowQueue(false)}
      />

      {/* Controller bar — sits above MobileNav on mobile */}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-[55] bg-surface-1/95 backdrop-blur-xl border-t border-border-subtle h-14 flex items-center px-4 gap-3">
        {/* Current item info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CurrentTypeIcon className="h-4 w-4 text-text-accent flex-shrink-0" />
          <div className="min-w-0">
            <Link
              href={playlist.currentItem ? getEntityHref(playlist.currentItem) : "#"}
              className="text-[0.78rem] text-text-primary truncate font-medium leading-tight block hover:text-text-accent transition-colors"
            >
              {currentTitle}
            </Link>
            <Link
              href={`/collections/${playlist.collectionId}`}
              className="text-[0.65rem] text-text-muted truncate leading-tight block hover:text-text-accent transition-colors"
            >
              {playlist.collectionName} —{" "}
              {playlist.currentPosition + 1}/{playlist.items.length}
            </Link>
          </div>
        </div>

        {/* Transport controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={playlist.toggleShuffle}
            className={`p-1.5 transition-colors ${
              playlist.shuffle
                ? "text-text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
            title="Shuffle"
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={playlist.previous}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
            title="Previous"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            onClick={playlist.next}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
            title="Next"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <button
            onClick={playlist.toggleLoop}
            className={`p-1.5 transition-colors ${
              playlist.loop
                ? "text-text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
            title="Loop"
          >
            <Repeat className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Queue toggle & dismiss */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowQueue((s) => !s)}
            className="p-1.5 text-text-muted hover:text-text-secondary transition-colors"
            title="Queue"
          >
            {showQueue ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={playlist.clearPlaylist}
            className="p-1.5 text-text-muted hover:text-error-text transition-colors"
            title="End playlist"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
