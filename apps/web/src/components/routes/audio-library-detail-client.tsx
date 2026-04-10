"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Music, Play, Pause, ChevronLeft } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { formatDuration } from "@obscura/contracts";
import type { AudioLibraryDetailDto } from "@obscura/contracts";
import {
  MetadataPanel,
  PerformersSection,
  TagsSection,
  InfoRow,
} from "../shared/metadata-panel";
import { StarRatingPicker } from "../shared/star-rating-picker";
import { NsfwBlur } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { SCENE_CARD_GRADIENTS } from "../scenes/scene-card-gradients";
import { toApiUrl } from "../../lib/api";
import type { TagItem } from "../../lib/api";
import { AudioPlayer } from "../audio/audio-player";

interface AudioLibraryDetailClientProps {
  library: AudioLibraryDetailDto;
  allTags: TagItem[];
}

export function AudioLibraryDetailClient({
  library,
  allTags,
}: AudioLibraryDetailClientProps) {
  const { mode: nsfwMode } = useNsfw();
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const coverUrl = toApiUrl(library.coverImagePath);

  const visibleTracks = library.tracks.filter(
    (t) => nsfwMode !== "off" || !t.isNsfw,
  );

  const handleTrackChange = useCallback((trackId: string) => {
    setActiveTrackId(trackId);
  }, []);

  const handlePlayAll = useCallback(() => {
    if (visibleTracks.length > 0) {
      setActiveTrackId(visibleTracks[0].id);
    }
  }, [visibleTracks]);

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        href="/audio"
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-accent transition-colors w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Audio
      </Link>

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start">
        <NsfwBlur
          isNsfw={library.isNsfw}
          className="w-36 h-36 sm:w-44 sm:h-44 flex-shrink-0 overflow-hidden surface-card-sharp"
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={library.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={cn("w-full h-full flex items-center justify-center", SCENE_CARD_GRADIENTS[0])}>
              <Music className="h-12 w-12 text-white/20" />
            </div>
          )}
        </NsfwBlur>
        <div className="flex-1 min-w-0 py-1">
          <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">Audio Library</p>
          <h1 className="text-2xl font-heading font-semibold leading-tight">{library.title}</h1>
          {library.details && (
            <p className="text-sm text-text-muted mt-1.5 line-clamp-2">{library.details}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
            <span>{library.trackCount} track{library.trackCount !== 1 ? "s" : ""}</span>
            {library.totalDuration != null && library.totalDuration > 0 && (
              <>
                <span className="text-text-disabled">&middot;</span>
                <span>{formatDuration(library.totalDuration)}</span>
              </>
            )}
          </div>
          {library.rating != null && (
            <div className="mt-2">
              <StarRatingPicker value={library.rating} readOnly />
            </div>
          )}

          {/* Play All button */}
          {visibleTracks.length > 0 && (
            <button
              type="button"
              onClick={handlePlayAll}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-accent-500 text-bg text-sm font-medium hover:bg-accent-400 transition-colors shadow-[0_0_16px_rgba(196,154,90,0.2)]"
            >
              <Play className="h-4 w-4" />
              Play All
            </button>
          )}
        </div>
      </div>

      {/* ─── Player (always visible) ────────────────────────────── */}
      <AudioPlayer
        tracks={visibleTracks}
        activeTrackId={activeTrackId}
        onTrackChange={handleTrackChange}
      />

      {/* ─── Sub-libraries ──────────────────────────────────────── */}
      {library.children.length > 0 && (
        <section>
          <h2 className="text-kicker mb-3">Sub-Libraries</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {library.children
              .filter((c) => nsfwMode !== "off" || !c.isNsfw)
              .map((child, i) => {
                const childCover = toApiUrl(child.coverImagePath);
                return (
                  <Link
                    key={child.id}
                    href={`/audio/${child.id}`}
                    className="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors"
                  >
                    <div className="aspect-square overflow-hidden">
                      {childCover ? (
                        <img src={childCover} alt={child.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className={cn("w-full h-full flex items-center justify-center", SCENE_CARD_GRADIENTS[i % SCENE_CARD_GRADIENTS.length])}>
                          <Music className="h-8 w-8 text-white/20" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <h3 className="text-xs font-medium truncate">{child.title}</h3>
                      <p className="text-[0.65rem] text-text-muted">{child.trackCount} tracks</p>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      )}

      {/* ─── Track list ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-kicker mb-3">Tracks</h2>
        {visibleTracks.length === 0 ? (
          <div className="surface-well p-8 text-center">
            <p className="text-text-muted text-sm">No tracks in this library</p>
          </div>
        ) : (
          <div className="surface-well">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border-subtle text-xs text-text-disabled uppercase tracking-wider">
              <span className="w-8 text-right">#</span>
              <span className="flex-1">Title</span>
              <span className="w-12 text-right">Time</span>
            </div>
            {/* Track rows */}
            {visibleTracks.map((track, index) => {
              const isActive = track.id === activeTrackId;

              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => handleTrackChange(track.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group",
                    "hover:bg-surface-2",
                    isActive && "bg-surface-2",
                    index < visibleTracks.length - 1 && "border-b border-border-subtle",
                  )}
                >
                  {/* Track number / playing indicator */}
                  <span className="w-8 text-right text-xs font-mono flex-shrink-0">
                    {isActive ? (
                      <span className="inline-flex items-center justify-center">
                        <span className="flex gap-[2px] items-end h-3">
                          <span className={cn("w-[2px] bg-accent-500 animate-[bar-bounce_0.6s_ease-in-out_infinite]")} style={{ height: "8px", animationDelay: "0ms" }} />
                          <span className={cn("w-[2px] bg-accent-500 animate-[bar-bounce_0.6s_ease-in-out_infinite]")} style={{ height: "12px", animationDelay: "150ms" }} />
                          <span className={cn("w-[2px] bg-accent-500 animate-[bar-bounce_0.6s_ease-in-out_infinite]")} style={{ height: "6px", animationDelay: "300ms" }} />
                        </span>
                      </span>
                    ) : (
                      <span className="text-text-muted group-hover:hidden">
                        {track.trackNumber ?? index + 1}
                      </span>
                    )}
                    {!isActive && (
                      <Play className="h-3 w-3 text-text-muted hidden group-hover:inline" />
                    )}
                  </span>

                  {/* Title + artist */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm truncate",
                      isActive ? "text-accent-400 font-medium" : "text-text-primary",
                    )}>
                      {nsfwMode === "blur" && track.isNsfw ? (
                        <span className="blur-sm hover:blur-none transition-all">{track.title}</span>
                      ) : (
                        track.title
                      )}
                    </p>
                    {track.embeddedArtist && (
                      <p className="text-xs text-text-muted truncate">{track.embeddedArtist}</p>
                    )}
                  </div>

                  {/* Rating (if any) */}
                  {track.rating != null && (
                    <div className="flex-shrink-0 hidden sm:block">
                      <StarRatingPicker value={track.rating} readOnly />
                    </div>
                  )}

                  {/* Duration */}
                  <span className="text-xs text-text-muted font-mono flex-shrink-0 w-12 text-right tabular-nums">
                    {track.duration ? formatDuration(track.duration) : "--:--"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Metadata ───────────────────────────────────────────── */}
      <MetadataPanel
        sidebar={
          <>
            <h4 className="text-kicker">Library Info</h4>
            <div className="space-y-2.5">
              <InfoRow icon={Music} label="Tracks" value={String(library.trackCount)} />
              {library.totalDuration != null && library.totalDuration > 0 && (
                <InfoRow icon={Play} label="Duration" value={formatDuration(library.totalDuration) ?? "--:--"} />
              )}
              {library.folderPath && (
                <div className="text-xs text-text-disabled break-all mt-2">{library.folderPath}</div>
              )}
            </div>
          </>
        }
      >
        <PerformersSection performers={library.performers} parentIsNsfw={library.isNsfw} />
        <TagsSection tags={library.tags} />
      </MetadataPanel>
    </div>
  );
}
