"use client";

import Link from "next/link";
import { Captions, Clock, Eye, Film, HardDrive, Star } from "lucide-react";
import { MediaCard } from "@obscura/ui/composed/media-card";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { VIDEO_TAG_COLORS } from "../video-tag-colors";
import type { VideoCardData } from "./video-card-data";
import { VIDEO_CARD_GRADIENTS } from "./video-card-gradients";
import { NsfwBlur, NsfwShowModeChip, NsfwTagLabel, NsfwText, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";

interface VideoCardProps {
  video: VideoCardData;
  variant?: "grid" | "list" | "compact";
  index?: number;
  imageLoading?: "eager" | "lazy";
  onSelect?: (href: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function VideoCard({
  video,
  variant = "grid",
  index = 0,
  imageLoading = "lazy",
  onSelect,
  selected,
  onToggleSelect,
}: VideoCardProps) {
  if (variant === "list") {
    return <VideoListCard video={video} index={index} selected={selected} onToggleSelect={onToggleSelect} />;
  }

  if (variant === "compact") {
    return <VideoCompactCard video={video} onSelect={onSelect} />;
  }

  return <VideoGridCard video={video} imageLoading={imageLoading} index={index} />;
}

function VideoGridCard({
  video,
  imageLoading,
  index,
}: {
  video: VideoCardData;
  imageLoading: "eager" | "lazy";
  index: number;
}) {
  const { mode } = useNsfw();
  const tagRow = tagsVisibleInNsfwMode(video.tags, mode);
  const performersRow = tagsVisibleInNsfwMode(video.performers ?? [], mode).map((p) => ({
    name: p.name,
    imagePath: p.imagePath,
  }));

  return (
    <NsfwBlur isNsfw={video.isNsfw ?? false} className="h-full">
      <Link href={video.href} className="block h-full">
        <MediaCard
          title={video.title}
          thumbnail={video.thumbnail}
          cardThumbnail={video.cardThumbnail}
          imageLoading={imageLoading}
          trickplaySprite={video.trickplaySprite}
          trickplayVtt={video.trickplayVtt}
          scrubDurationSeconds={video.scrubDurationSeconds}
          duration={video.duration}
          resolution={video.resolution}
          codec={video.codec}
          hasSubtitles={video.hasSubtitles}
          fileSize={video.fileSize}
          studio={video.studio}
          performers={performersRow}
          thumbnailOverlay={<NsfwShowModeChip isNsfw={video.isNsfw} />}
          topLeftBadge={
            video.episodeNumber != null ? (
              <span className="bg-bg/80 px-1 py-0.5 font-mono text-[0.55rem] text-text-muted">
                {video.seasonNumber != null
                  ? `S${String(video.seasonNumber).padStart(2, "0")}E${String(video.episodeNumber).padStart(2, "0")}`
                  : `E${String(video.episodeNumber).padStart(2, "0")}`}
              </span>
            ) : undefined
          }
          tagsSlot={
            tagRow.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {tagRow.slice(0, 3).map((tag) => (
                  <span
                    key={tag.name}
                    className={cn("tag-chip", VIDEO_TAG_COLORS[tag.name] || "tag-chip-default")}
                  >
                    <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                  </span>
                ))}
                {tagRow.length > 3 && (
                  <span className="tag-chip tag-chip-default text-text-disabled">
                    +{tagRow.length - 3}
                  </span>
                )}
              </div>
            ) : null
          }
          tagColors={VIDEO_TAG_COLORS}
          rating={video.rating}
          views={video.views}
          gradientClass={VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length]}
        />
      </Link>
    </NsfwBlur>
  );
}

function VideoListCard({
  video,
  index,
  selected,
  onToggleSelect,
}: {
  video: VideoCardData;
  index: number;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { mode } = useNsfw();
  const tagRow = tagsVisibleInNsfwMode(video.tags, mode);
  const performersRow = tagsVisibleInNsfwMode(video.performers ?? [], mode);

  return (
    <Link href={video.href}>
      <div className="surface-card-sharp group flex items-center gap-3 px-3 py-2 cursor-pointer">
        {onToggleSelect && (
          <Checkbox
            checked={selected ?? false}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.preventDefault();
              onToggleSelect(video.id);
            }}
            className="flex-shrink-0"
          />
        )}
        <NsfwBlur isNsfw={video.isNsfw ?? false}>
          <div
            className={cn(
              "relative w-28 flex-shrink-0 aspect-video overflow-hidden",
              VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length],
            )}
          >
            {video.thumbnail && (
              <img
                src={video.cardThumbnail || video.thumbnail}
                alt={video.title}
                loading={index < 6 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
            <div className="pointer-events-none absolute bottom-1 right-1 z-10 flex flex-col items-end gap-0.5">
              <NsfwShowModeChip isNsfw={video.isNsfw} />
              {video.hasSubtitles && (
                <span
                  className="inline-flex items-center gap-0.5 bg-black/70 text-accent-100 border border-accent-500/40 px-1 py-px text-[0.5rem] font-mono uppercase tracking-[0.12em]"
                  title="Closed captions available"
                >
                  <Captions className="h-2.5 w-2.5" />
                  CC
                </span>
              )}
              {video.duration ? (
                <span className="text-[0.55rem] font-mono bg-black/70 text-white/80 px-1">
                  {video.duration}
                </span>
              ) : null}
            </div>
          </div>
        </NsfwBlur>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <NsfwText isNsfw={video.isNsfw ?? false} className="truncate text-[0.8rem] font-medium text-text-primary block">
              {video.title}
            </NsfwText>
            {video.resolution && (
              <span className="pill-accent px-1 py-0 text-[0.55rem] font-semibold flex-shrink-0">
                {video.resolution}
              </span>
            )}
            {video.codec && (
              <span className="text-[0.55rem] font-mono text-text-disabled flex-shrink-0">
                {video.codec}
              </span>
            )}
          </div>

          {performersRow.length > 0 && (
            <div className="flex items-center gap-2 text-[0.7rem] text-text-muted">
              <span className="inline-flex items-center gap-1.5 truncate">
                {performersRow.slice(0, 3).map((performer) => (
                  <span key={performer.name} className="inline-flex items-center gap-1">
                    {performer.imagePath && (
                      <span className="h-4 w-3 flex-shrink-0 overflow-hidden">
                        <img
                          src={performer.imagePath}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-4 w-3 object-cover"
                        />
                      </span>
                    )}
                    <span>{performer.name}</span>
                  </span>
                ))}
                {performersRow.length > 3 && (
                  <span className="text-text-disabled">+{performersRow.length - 3}</span>
                )}
              </span>
            </div>
          )}

          {tagRow.length > 0 && (
            <div className="hidden sm:flex flex-wrap gap-1">
              {tagRow.slice(0, 4).map((tag) => (
                <span
                  key={tag.name}
                  className={cn("tag-chip", VIDEO_TAG_COLORS[tag.name] || "tag-chip-default")}
                >
                  <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4 text-[0.65rem] text-text-disabled flex-shrink-0">
          {video.rating != null && video.rating > 0 && (
            <span className="flex items-center gap-0.5 text-glow-accent">
              <Star className="h-3 w-3 fill-current" />
              {Math.round(video.rating / 20)}
            </span>
          )}
          {video.fileSize && (
            <span className="flex items-center gap-1 text-ephemeral">
              <HardDrive className="h-3 w-3" />
              {video.fileSize}
            </span>
          )}
          {video.views != null && video.views > 0 && (
            <span className="flex items-center gap-1 text-ephemeral">
              <Eye className="h-3 w-3" />
              {video.views}
            </span>
          )}
          {video.duration && (
            <span className="flex items-center gap-1 text-ephemeral">
              <Clock className="h-3 w-3" />
              {video.duration}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function VideoCompactCard({
  video,
  onSelect,
}: {
  video: VideoCardData;
  onSelect?: (href: string) => void;
}) {
  const content = (
    <>
      <div
        className={cn(
          "shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-12 ",
          !video.thumbnail && VIDEO_CARD_GRADIENTS[0],
        )}
      >
        {video.cardThumbnail || video.thumbnail ? (
          <img
            src={video.cardThumbnail || video.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <Film className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{video.title}</div>
        <div className="text-[0.68rem] text-text-muted truncate">
          {[video.studio, video.duration].filter(Boolean).join(" · ") || "Video"}
        </div>
      </div>

      <span className="shrink-0 tag-chip tag-chip-default text-[0.6rem]">
        video
      </span>
    </>
  );

  if (onSelect) {
    return (
      <button
        onClick={() => onSelect(video.href)}
        className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={video.href}
      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
    >
      {content}
    </Link>
  );
}
