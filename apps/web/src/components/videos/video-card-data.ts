"use client";

import type { SearchResultItem } from "@obscura/contracts";
import { formatDuration } from "@obscura/contracts";
import { toApiUrl, type VideoListItem } from "../../lib/api";
import { buildHrefWithFrom } from "../../lib/back-navigation";

export interface VideoCardPerformer {
  name: string;
  imagePath?: string;
  isNsfw?: boolean;
}

export interface VideoCardData {
  id: string;
  href: string;
  title: string;
  thumbnail?: string;
  cardThumbnail?: string;
  trickplaySprite?: string;
  trickplayVtt?: string;
  scrubDurationSeconds?: number;
  duration?: string;
  resolution?: string;
  codec?: string;
  fileSize?: string;
  studio?: string;
  performers?: VideoCardPerformer[];
  tags?: { name: string; isNsfw: boolean }[];
  rating?: number;
  views?: number;
  isNsfw?: boolean;
  hasSubtitles?: boolean;
  seasonNumber?: number;
  episodeNumber?: number;
}

function readMetaString(meta: SearchResultItem["meta"], key: string): string | undefined {
  const value = meta[key];
  return typeof value === "string" ? value : undefined;
}

function readMetaNumber(meta: SearchResultItem["meta"], key: string): number | undefined {
  const value = meta[key];
  return typeof value === "number" ? value : undefined;
}

export function videoListItemToCardData(video: VideoListItem, from?: string): VideoCardData {
  const base = `/videos/${video.id}`;
  return {
    id: video.id,
    href: from ? buildHrefWithFrom(base, from) : base,
    title: video.title,
    thumbnail: toApiUrl(video.thumbnailPath, video.updatedAt),
    cardThumbnail: video.thumbnailPath?.includes("thumb-custom")
      ? undefined
      : toApiUrl(video.cardThumbnailPath, video.updatedAt),
    trickplaySprite: toApiUrl(video.spritePath, video.updatedAt),
    trickplayVtt: toApiUrl(video.trickplayVttPath, video.updatedAt),
    scrubDurationSeconds: video.duration ?? undefined,
    duration: video.durationFormatted ?? undefined,
    resolution: video.resolution ?? undefined,
    codec: video.codec ?? undefined,
    fileSize: video.fileSizeFormatted ?? undefined,
    performers: video.performers.map((performer) => ({
      name: performer.name,
      imagePath: toApiUrl(performer.imagePath) ?? undefined,
      isNsfw: performer.isNsfw,
    })),
    tags: video.tags.map((tag) => ({ name: tag.name, isNsfw: tag.isNsfw })),
    rating: video.rating ?? undefined,
    views: video.playCount,
    isNsfw: video.isNsfw,
    hasSubtitles: video.hasSubtitles ?? false,
    seasonNumber: video.seasonNumber ?? undefined,
    episodeNumber: video.episodeNumber ?? undefined,
  };
}

export function searchVideoItemToCardData(item: SearchResultItem, from?: string): VideoCardData | null {
  if (item.kind !== "video") return null;

  const thumbnailPath = toApiUrl(item.imagePath);
  const rawCardThumbnailPath = readMetaString(item.meta, "cardThumbnailPath");

  return {
    id: item.id,
    href: from ? buildHrefWithFrom(item.href, from) : item.href,
    title: item.title,
    thumbnail: thumbnailPath,
    cardThumbnail:
      item.imagePath?.includes("thumb-custom") || !rawCardThumbnailPath
        ? undefined
        : toApiUrl(rawCardThumbnailPath),
    trickplaySprite: readMetaString(item.meta, "spritePath")
      ? toApiUrl(readMetaString(item.meta, "spritePath"))
      : undefined,
    trickplayVtt: readMetaString(item.meta, "trickplayVttPath")
      ? toApiUrl(readMetaString(item.meta, "trickplayVttPath"))
      : undefined,
    scrubDurationSeconds: readMetaNumber(item.meta, "durationSeconds"),
    duration:
      readMetaString(item.meta, "durationFormatted") ??
      formatDuration(readMetaNumber(item.meta, "durationSeconds")) ?? undefined,
    resolution: readMetaString(item.meta, "resolution"),
    codec: readMetaString(item.meta, "codec"),
    fileSize: readMetaString(item.meta, "fileSizeFormatted"),
    studio: item.subtitle ?? readMetaString(item.meta, "studio"),
    rating: item.rating ?? undefined,
    views: readMetaNumber(item.meta, "views"),
  };
}
