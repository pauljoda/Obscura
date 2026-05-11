import type {
  CollectionItemDto,
  SearchResultItem,
} from "@obscura/contracts";
import { toApiUrl } from "$lib/api/core";
import { videoListItemToCardData, type VideoCardData } from "$lib/video-card-data";
import type { EntityThumbnailProps } from "./thumbnail-types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function stringArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function searchResultToVideoCardData(
  item: SearchResultItem,
  currentPath?: string,
): VideoCardData {
  const meta = item.meta ?? {};
  return {
    id: item.id,
    href: buildHrefWithFrom(item.href, currentPath),
    title: item.title,
    thumbnail: toApiUrl(item.imagePath ?? undefined),
    cardThumbnail: toApiUrl(stringValue(meta.cardThumbnailPath) ?? undefined),
    trickplaySprite: toApiUrl(stringValue(meta.spritePath) ?? undefined),
    trickplayVtt: toApiUrl(stringValue(meta.trickplayVttPath) ?? undefined),
    scrubDurationSeconds: numberValue(meta.durationSeconds) ?? undefined,
    duration: stringValue(meta.durationFormatted) ?? undefined,
    resolution: stringValue(meta.resolution) ?? undefined,
    codec: stringValue(meta.codec) ?? undefined,
    fileSize: stringValue(meta.fileSizeFormatted) ?? undefined,
    studio: stringValue(meta.studio) ?? undefined,
    views: numberValue(meta.views) ?? undefined,
    rating: item.rating ?? undefined,
    isNsfw: booleanValue(meta.isNsfw),
    hasSubtitles: booleanValue(meta.hasSubtitles),
  };
}

export function searchResultToThumbnailProps(
  item: SearchResultItem,
  index = 0,
  currentPath?: string,
): EntityThumbnailProps {
  const meta = item.meta ?? {};
  switch (item.kind) {
    case "video":
      return {
        kind: "video",
        video: searchResultToVideoCardData(item, currentPath),
        gradientIndex: index,
      };
    case "video-series":
      return {
        kind: "video-series",
        title: item.title,
        coverImagePath: item.imagePath,
        isNsfw: booleanValue(meta.isNsfw),
        videoCount: numberValue(meta.videoCount),
        gradientIndex: index,
      };
    case "gallery": {
      const isComic = booleanValue(meta.isComic);
      const previewBackedSeries =
        (numberValue(meta.imageCount) ?? 0) === 0 &&
        stringArrayValue(meta.previewImagePaths).length > 0;
      return {
        kind: "gallery",
        title: item.title,
        coverImagePath: item.imagePath,
        previewImagePaths: stringArrayValue(meta.previewImagePaths),
        imageCount: numberValue(meta.imageCount),
        isNsfw: booleanValue(meta.isNsfw),
        isComic,
        aspectRatio: isComic ? null : numberValue(meta.coverAspectRatio),
        aspectClass: previewBackedSeries && !isComic ? "aspect-[4/3]" : undefined,
        fit: isComic || previewBackedSeries ? "contain" : "cover",
        gradientIndex: index,
      };
    }
    case "book":
      return {
        kind: "book",
        title: item.title,
        coverImagePath: item.imagePath,
        pageCount: numberValue(meta.pageCount),
        isNsfw: booleanValue(meta.isNsfw),
        aspectClass: "aspect-[2/3]",
        fit: "contain",
        gradientIndex: index,
      };
    case "image":
      return {
        kind: "image",
        title: item.title,
        thumbnailPath: item.imagePath,
        previewPath: stringValue(meta.previewPath),
        isVideo: !!stringValue(meta.previewPath),
        isNsfw: booleanValue(meta.isNsfw),
        width: numberValue(meta.width),
        height: numberValue(meta.height),
      };
    case "performer":
      return {
        kind: "performer",
        performer: {
          name: item.title,
          imagePath: item.imagePath,
          isNsfw: booleanValue(meta.isNsfw),
          videoCount: numberValue(meta.videoCount),
          seriesCount: numberValue(meta.seriesCount),
          galleryCount: numberValue(meta.galleryCount),
          imageCount: numberValue(meta.imageCount),
          audioLibraryCount: numberValue(meta.audioLibraryCount),
          audioTrackCount: numberValue(meta.audioTrackCount),
        },
        gradientIndex: index,
      };
    case "studio":
      return {
        kind: "studio",
        studio: {
          name: item.title,
          imagePath: item.imagePath,
          isNsfw: booleanValue(meta.isNsfw),
        },
        gradientIndex: index,
      };
    case "tag":
      return {
        kind: "tag",
        tag: {
          name: item.title,
          imagePath: item.imagePath,
          isNsfw: booleanValue(meta.isNsfw),
          videoCount: numberValue(meta.videoCount),
          imageCount: numberValue(meta.imageCount),
          galleryCount: numberValue(meta.galleryCount),
          audioTrackCount: numberValue(meta.audioTrackCount),
        },
      };
    case "audio-library":
      return {
        kind: "audio-library",
        library: {
          title: item.title,
          coverImagePath: item.imagePath,
          isNsfw: booleanValue(meta.isNsfw),
          trackCount: numberValue(meta.trackCount),
        },
        gradientIndex: index,
      };
    case "audio-track":
      return {
        kind: "audio-track",
        track: {
          title: item.title,
          coverImagePath: item.imagePath,
          isNsfw: booleanValue(meta.isNsfw),
          trackNumber: numberValue(meta.trackNumber),
        },
        gradientIndex: index,
      };
  }
}

export function collectionItemToThumbnailProps(
  item: CollectionItemDto,
  title: string,
): EntityThumbnailProps {
  const entity = record(item.entity);
  switch (item.entityType) {
    case "video":
      return {
        kind: "video",
        video: videoListItemToCardData({
          id: item.entityId,
          title,
          thumbnailPath: stringValue(entity.thumbnailPath),
          cardThumbnailPath: stringValue(entity.cardThumbnailPath),
          spritePath: stringValue(entity.spritePath),
          trickplayVttPath: stringValue(entity.trickplayVttPath),
          duration: numberValue(entity.duration),
          durationFormatted: stringValue(entity.durationFormatted),
          resolution: stringValue(entity.resolution),
          codec: stringValue(entity.codec),
          fileSizeFormatted: stringValue(entity.fileSizeFormatted),
          rating: numberValue(entity.rating),
          playCount: numberValue(entity.playCount) ?? undefined,
          isNsfw: booleanValue(entity.isNsfw),
          hasSubtitles: booleanValue(entity.hasSubtitles),
          seasonNumber: numberValue(entity.seasonNumber),
          episodeNumber: numberValue(entity.episodeNumber),
          updatedAt: stringValue(entity.updatedAt) ?? undefined,
        }),
      };
    case "gallery": {
      const isComic = booleanValue(entity.isComic);
      return {
        kind: "gallery",
        title,
        coverImagePath: stringValue(entity.coverImagePath),
        previewImagePaths: stringArrayValue(entity.previewImagePaths),
        imageCount: numberValue(entity.imageCount),
        isNsfw: booleanValue(entity.isNsfw),
        isComic,
        updatedAt: stringValue(entity.updatedAt),
        aspectClass: "aspect-video",
        fit: isComic ? "contain" : "cover",
        showCount: false,
      };
    }
    case "book":
      return {
        kind: "book",
        title,
        coverImagePath: stringValue(entity.coverImagePath),
        pageCount: numberValue(entity.pageCount),
        isNsfw: booleanValue(entity.isNsfw),
        aspectClass: "aspect-[2/3]",
        fit: "contain",
        showCount: false,
      };
    case "image":
      return {
        kind: "image",
        title,
        thumbnailPath: stringValue(entity.thumbnailPath),
        previewPath: stringValue(entity.previewPath),
        isVideo: !!stringValue(entity.previewPath),
        isNsfw: booleanValue(entity.isNsfw),
        width: numberValue(entity.width),
        height: numberValue(entity.height),
        updatedAt: stringValue(entity.updatedAt),
        aspectClass: "aspect-video",
        showChips: false,
      };
    case "audio-track":
      return {
        kind: "audio-track",
        track: {
          title,
          coverImagePath: stringValue(entity.coverImagePath),
          libraryCoverImagePath: stringValue(entity.libraryCoverImagePath),
          trackNumber: numberValue(entity.trackNumber),
          isNsfw: booleanValue(entity.isNsfw),
        },
        aspectClass: "aspect-video",
        showChips: false,
        showPlayOverlay: false,
      };
  }
}

function buildHrefWithFrom(href: string, from?: string): string {
  if (!from) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${encodeURIComponent(from)}`;
}
