"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Music, Play, Pause, ChevronLeft, Star } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { formatDuration } from "@obscura/contracts";
import type {
  AudioLibraryDetailDto,
  AudioTrackListItemDto,
} from "@obscura/contracts";
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
  const activeTrack = library.tracks.find((t) => t.id === activeTrackId) ?? null;

  const handleTrackPlay = useCallback((trackId: string) => {
    setActiveTrackId(trackId);
  }, []);

  const handleNextTrack = useCallback(() => {
    if (!activeTrackId) return;
    const idx = library.tracks.findIndex((t) => t.id === activeTrackId);
    if (idx >= 0 && idx < library.tracks.length - 1) {
      setActiveTrackId(library.tracks[idx + 1].id);
    }
  }, [activeTrackId, library.tracks]);

  const handlePrevTrack = useCallback(() => {
    if (!activeTrackId) return;
    const idx = library.tracks.findIndex((t) => t.id === activeTrackId);
    if (idx > 0) {
      setActiveTrackId(library.tracks[idx - 1].id);
    }
  }, [activeTrackId, library.tracks]);

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

      {/* Header */}
      <div className="flex gap-6 items-start">
        <NsfwBlur
          isNsfw={library.isNsfw}
          className="w-40 h-40 flex-shrink-0 overflow-hidden surface-card-sharp"
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
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-heading font-semibold">{library.title}</h1>
          {library.details && (
            <p className="text-sm text-text-muted mt-1">{library.details}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
            <span>{library.trackCount} tracks</span>
            {library.totalDuration != null && library.totalDuration > 0 && (
              <span>{formatDuration(library.totalDuration)}</span>
            )}
          </div>
          {library.rating != null && (
            <div className="mt-2">
              <StarRatingPicker value={library.rating} readOnly />
            </div>
          )}
        </div>
      </div>

      {/* Sub-libraries */}
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

      {/* Audio Player */}
      {activeTrack && (
        <AudioPlayer
          track={activeTrack}
          onNext={handleNextTrack}
          onPrev={handlePrevTrack}
          hasNext={library.tracks.findIndex((t) => t.id === activeTrackId) < library.tracks.length - 1}
          hasPrev={library.tracks.findIndex((t) => t.id === activeTrackId) > 0}
        />
      )}

      {/* Track list */}
      <section>
        <h2 className="text-kicker mb-3">Tracks</h2>
        {library.tracks.length === 0 ? (
          <div className="surface-well p-8 text-center">
            <p className="text-text-muted text-sm">No tracks in this library</p>
          </div>
        ) : (
          <div className="surface-well divide-y divide-border-subtle">
            {library.tracks.map((track, index) => {
              const isActive = track.id === activeTrackId;
              const isHidden = nsfwMode === "off" && track.isNsfw;
              if (isHidden) return null;

              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => handleTrackPlay(track.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2",
                    isActive && "bg-surface-2 border-l-2 border-l-accent-500",
                  )}
                >
                  {/* Track number */}
                  <span className="w-8 text-right text-xs text-text-muted font-mono flex-shrink-0">
                    {isActive ? (
                      <Music className="h-3.5 w-3.5 text-accent-500 inline" />
                    ) : (
                      track.trackNumber ?? index + 1
                    )}
                  </span>

                  {/* Title + artist */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm truncate", isActive && "text-accent-400 font-medium")}>
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

                  {/* Rating */}
                  {track.rating != null && (
                    <div className="flex-shrink-0">
                      <StarRatingPicker value={track.rating} readOnly />
                    </div>
                  )}

                  {/* Duration */}
                  <span className="text-xs text-text-muted font-mono flex-shrink-0 w-12 text-right">
                    {track.duration ? formatDuration(track.duration) : "--:--"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Metadata */}
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
