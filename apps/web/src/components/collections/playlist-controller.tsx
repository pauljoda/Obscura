"use client";

import { useState } from "react";
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
  ListMusic,
} from "lucide-react";
import type { CollectionEntityType } from "@obscura/contracts";
import { usePlaylistContext } from "./playlist-context";

const typeIcons: Record<CollectionEntityType, typeof Film> = {
  scene: Film,
  gallery: Images,
  image: Layers,
  "audio-track": Music,
};

/**
 * Global floating playlist controller bar.
 * Renders at the bottom of the viewport when a playlist is active.
 * Shows current item, transport controls, and an expandable queue.
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
      {/* Queue panel (above the bar) */}
      {showQueue && (
        <div className="fixed bottom-14 right-4 left-4 md:left-auto md:w-96 max-h-[50vh] z-50 bg-surface-1 border border-border-default shadow-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
            <span className="text-[0.7rem] font-heading font-medium text-text-muted uppercase tracking-wider">
              <ListMusic className="inline h-3 w-3 mr-1" />
              Queue — {playlist.collectionName}
            </span>
            <span className="text-[0.65rem] font-mono text-text-disabled">
              {playlist.currentIndex + 1}/{playlist.items.length}
            </span>
          </div>
          <div className="overflow-y-auto flex-1">
            {playlist.items.map((item, index) => {
              const Icon = typeIcons[item.entityType];
              const title =
                (item.entity?.title as string) ?? "Untitled";
              const isCurrent = index === playlist.currentIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => playlist.jumpTo(index)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isCurrent
                      ? "bg-accent-brass/10 border-l-2 border-accent-brass"
                      : "hover:bg-surface-2 border-l-2 border-transparent"
                  }`}
                >
                  <Icon
                    className={`h-3 w-3 flex-shrink-0 ${
                      isCurrent
                        ? "text-text-accent"
                        : "text-text-muted"
                    }`}
                  />
                  <span
                    className={`text-[0.75rem] truncate ${
                      isCurrent
                        ? "text-text-accent font-medium"
                        : "text-text-secondary"
                    }`}
                  >
                    {title}
                  </span>
                  <span className="text-[0.6rem] font-mono text-text-disabled ml-auto flex-shrink-0">
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Controller bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1 border-t border-border-subtle h-14 flex items-center px-4 gap-3 md:bottom-0">
        {/* Current item info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CurrentTypeIcon className="h-4 w-4 text-text-accent flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[0.78rem] text-text-primary truncate font-medium leading-tight">
              {currentTitle}
            </p>
            <p className="text-[0.65rem] text-text-muted truncate leading-tight">
              {playlist.collectionName} —{" "}
              {playlist.currentIndex + 1}/{playlist.items.length}
            </p>
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
