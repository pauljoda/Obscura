import { toApiUrl } from "$lib/api/core";

export interface VideoCardPerformer {
  name: string;
  imagePath?: string;
  isNsfw?: boolean;
}

export interface VideoCardTag {
  name: string;
  isNsfw: boolean;
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
  tags?: VideoCardTag[];
  rating?: number;
  views?: number;
  isNsfw?: boolean;
  hasSubtitles?: boolean;
  seasonNumber?: number;
  episodeNumber?: number;
}

function buildHrefWithFrom(href: string, from?: string): string {
  if (!from) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${encodeURIComponent(from)}`;
}

interface VideoLike {
  id: string;
  title: string;
  thumbnailPath?: string | null;
  cardThumbnailPath?: string | null;
  spritePath?: string | null;
  trickplayVttPath?: string | null;
  duration?: number | null;
  durationFormatted?: string | null;
  resolution?: string | null;
  codec?: string | null;
  fileSizeFormatted?: string | null;
  performers?: Array<{ name: string; imagePath?: string | null; isNsfw?: boolean }>;
  tags?: Array<{ name: string; isNsfw: boolean }>;
  rating?: number | null;
  playCount?: number;
  isNsfw?: boolean;
  hasSubtitles?: boolean;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  updatedAt?: string;
}

export function videoListItemToCardData(video: VideoLike, from?: string): VideoCardData {
  const base = `/videos/${video.id}`;
  const performers = video.performers ?? [];
  const tags = video.tags ?? [];
  return {
    id: video.id,
    href: buildHrefWithFrom(base, from),
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
    performers: performers.map((p) => ({
      name: p.name,
      imagePath: toApiUrl(p.imagePath) ?? undefined,
      isNsfw: p.isNsfw,
    })),
    tags: tags.map((t) => ({ name: t.name, isNsfw: t.isNsfw })),
    rating: video.rating ?? undefined,
    views: video.playCount,
    isNsfw: video.isNsfw,
    hasSubtitles: video.hasSubtitles ?? false,
    seasonNumber: video.seasonNumber ?? undefined,
    episodeNumber: video.episodeNumber ?? undefined,
  };
}
