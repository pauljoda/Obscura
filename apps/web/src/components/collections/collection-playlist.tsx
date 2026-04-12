"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Film,
  Images,
  Layers,
  Music,
  ChevronRight,
  X,
} from "lucide-react";
import type {
  CollectionItemDto,
  CollectionEntityType,
} from "@obscura/contracts";
import { usePlaylist } from "../../hooks/use-playlist";
import { toApiUrl } from "../../lib/api/core";

const typeIcons: Record<CollectionEntityType, typeof Film> = {
  scene: Film,
  gallery: Images,
  image: Layers,
  "audio-track": Music,
};

interface CollectionPlaylistProps {
  items: CollectionItemDto[];
  slideshowDurationSeconds: number;
  slideshowAutoAdvance: boolean;
  onClose: () => void;
}

export function CollectionPlaylist({
  items,
  slideshowDurationSeconds,
  slideshowAutoAdvance,
  onClose,
}: CollectionPlaylistProps) {
  const playlist = usePlaylist(items);
  const [showQueue, setShowQueue] = useState(true);

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-1 border-b border-border-subtle">
        <span className="text-[0.78rem] font-mono text-text-muted">
          {playlist.orderPosition + 1} of {playlist.items.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQueue((s) => !s)}
            className="text-text-muted hover:text-text-secondary p-1 transition-colors"
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform ${showQueue ? "rotate-180" : ""}`}
            />
          </button>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Player */}
        <div className="flex-1 flex items-center justify-center bg-bg p-4">
          {playlist.currentItem ? (
            <PlaylistItemRenderer
              item={playlist.currentItem}
              isPlaying={playlist.isPlaying}
              slideshowDurationSeconds={slideshowDurationSeconds}
              slideshowAutoAdvance={slideshowAutoAdvance}
              onEnded={playlist.next}
            />
          ) : (
            <p className="text-text-disabled">No items to play</p>
          )}
        </div>

        {/* Queue sidebar */}
        {showQueue && (
          <div className="w-72 border-l border-border-subtle bg-surface-1 overflow-y-auto">
            <div className="px-3 py-2 text-[0.7rem] font-heading font-medium text-text-muted uppercase tracking-wider">
              Queue
            </div>
            <div className="space-y-[1px]">
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
                      className={`h-3.5 w-3.5 flex-shrink-0 ${
                        isCurrent ? "text-text-accent" : "text-text-muted"
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
      </div>

      {/* Transport bar */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 bg-surface-1 border-t border-border-subtle">
        <button
          onClick={playlist.toggleShuffle}
          className={`p-1.5 transition-colors ${
            playlist.shuffle
              ? "text-text-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          <Shuffle className="h-4 w-4" />
        </button>

        <button
          onClick={playlist.previous}
          disabled={!playlist.hasPrevious}
          className="p-1.5 text-text-secondary hover:text-text-primary disabled:text-text-disabled transition-colors"
        >
          <SkipBack className="h-5 w-5" />
        </button>

        <button
          onClick={playlist.togglePlay}
          className="p-3 bg-accent-brass/20 text-text-accent hover:bg-accent-brass/30 transition-colors"
        >
          {playlist.isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={playlist.next}
          disabled={!playlist.hasNext}
          className="p-1.5 text-text-secondary hover:text-text-primary disabled:text-text-disabled transition-colors"
        >
          <SkipForward className="h-5 w-5" />
        </button>

        <button
          onClick={playlist.toggleLoop}
          className={`p-1.5 transition-colors ${
            playlist.loop
              ? "text-text-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          <Repeat className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Item Renderer ──────────────────────────────────────────────

function PlaylistItemRenderer({
  item,
  isPlaying,
  slideshowDurationSeconds,
  slideshowAutoAdvance,
  onEnded,
}: {
  item: CollectionItemDto;
  isPlaying: boolean;
  slideshowDurationSeconds: number;
  slideshowAutoAdvance: boolean;
  onEnded: () => void;
}) {
  switch (item.entityType) {
    case "scene":
      return (
        <ScenePlayer
          item={item}
          isPlaying={isPlaying}
          onEnded={onEnded}
        />
      );
    case "image":
      return (
        <ImageSlide
          item={item}
          isPlaying={isPlaying}
          durationSeconds={slideshowDurationSeconds}
          autoAdvance={slideshowAutoAdvance}
          onEnded={onEnded}
        />
      );
    case "audio-track":
      return (
        <AudioPlayer
          item={item}
          isPlaying={isPlaying}
          onEnded={onEnded}
        />
      );
    case "gallery":
      return (
        <GallerySlideshow
          item={item}
          isPlaying={isPlaying}
          durationSeconds={slideshowDurationSeconds}
          autoAdvance={slideshowAutoAdvance}
          onEnded={onEnded}
        />
      );
    default:
      return <p className="text-text-disabled">Unknown type</p>;
  }
}

function ScenePlayer({
  item,
  isPlaying,
  onEnded,
}: {
  item: CollectionItemDto;
  isPlaying: boolean;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamUrl = toApiUrl(
    item.entity?.directStreamUrl as string | null,
  );

  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  if (!streamUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-disabled">Video unavailable</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={streamUrl}
      onEnded={onEnded}
      autoPlay={isPlaying}
      controls
      className="max-h-full max-w-full"
    />
  );
}

function ImageSlide({
  item,
  isPlaying,
  durationSeconds,
  autoAdvance,
  onEnded,
}: {
  item: CollectionItemDto;
  isPlaying: boolean;
  durationSeconds: number;
  autoAdvance: boolean;
  onEnded: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const thumbnailUrl = toApiUrl(
    (item.entity?.fullPath ?? item.entity?.thumbnailPath) as
      | string
      | null,
  );

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);

    if (isPlaying && autoAdvance) {
      const intervalMs = 100;
      const totalSteps = (durationSeconds * 1000) / intervalMs;
      let step = 0;

      timerRef.current = setInterval(() => {
        step++;
        setProgress((step / totalSteps) * 100);
        if (step >= totalSteps) {
          if (timerRef.current) clearInterval(timerRef.current);
          onEnded();
        }
      }, intervalMs);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, autoAdvance, durationSeconds, onEnded, item.id]);

  return (
    <div className="relative flex items-center justify-center h-full w-full">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={(item.entity?.title as string) ?? "Image"}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <Layers className="h-16 w-16 text-text-disabled" />
      )}

      {/* Progress bar */}
      {isPlaying && autoAdvance && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-2">
          <div
            className="h-full bg-accent-brass/60 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function AudioPlayer({
  item,
  isPlaying,
  onEnded,
}: {
  item: CollectionItemDto;
  isPlaying: boolean;
  onEnded: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamUrl = toApiUrl(`/audio-stream/${item.entityId}`);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Music className="h-20 w-20 text-text-muted" />
      <h2 className="text-lg font-heading font-medium text-text-primary">
        {(item.entity?.title as string) ?? "Untitled Track"}
      </h2>
      <audio
        ref={audioRef}
        src={streamUrl}
        onEnded={onEnded}
        autoPlay={isPlaying}
        controls
        className="w-80"
      />
    </div>
  );
}

function GallerySlideshow({
  item,
  isPlaying,
  durationSeconds,
  autoAdvance,
  onEnded,
}: {
  item: CollectionItemDto;
  isPlaying: boolean;
  durationSeconds: number;
  autoAdvance: boolean;
  onEnded: () => void;
}) {
  // For galleries, show the cover image and advance to next collection item
  const coverUrl = toApiUrl(item.entity?.coverImagePath as string | null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);

    if (isPlaying && autoAdvance) {
      const intervalMs = 100;
      const totalSteps = (durationSeconds * 1000) / intervalMs;
      let step = 0;

      timerRef.current = setInterval(() => {
        step++;
        setProgress((step / totalSteps) * 100);
        if (step >= totalSteps) {
          if (timerRef.current) clearInterval(timerRef.current);
          onEnded();
        }
      }, intervalMs);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, autoAdvance, durationSeconds, onEnded, item.id]);

  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full gap-4">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={(item.entity?.title as string) ?? "Gallery"}
          className="max-h-[70%] max-w-full object-contain"
        />
      ) : (
        <Images className="h-16 w-16 text-text-disabled" />
      )}
      <h2 className="text-base font-heading text-text-secondary">
        {(item.entity?.title as string) ?? "Gallery"}
      </h2>
      {isPlaying && autoAdvance && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-2">
          <div
            className="h-full bg-accent-brass/60 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
