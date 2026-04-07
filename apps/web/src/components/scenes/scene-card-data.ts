"use client";

import type { SearchResultItem } from "@obscura/contracts";
import { formatDuration } from "@obscura/contracts";
import { toApiUrl, type SceneListItem } from "../../lib/api";

export interface SceneCardPerformer {
  name: string;
  imagePath?: string;
}

export interface SceneCardData {
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
  performers?: SceneCardPerformer[];
  tags?: string[];
  rating?: number;
  views?: number;
}

function readMetaString(meta: SearchResultItem["meta"], key: string): string | undefined {
  const value = meta[key];
  return typeof value === "string" ? value : undefined;
}

function readMetaNumber(meta: SearchResultItem["meta"], key: string): number | undefined {
  const value = meta[key];
  return typeof value === "number" ? value : undefined;
}

export function sceneListItemToCardData(scene: SceneListItem): SceneCardData {
  return {
    id: scene.id,
    href: `/scenes/${scene.id}`,
    title: scene.title,
    thumbnail: toApiUrl(scene.thumbnailPath, scene.updatedAt),
    cardThumbnail: scene.thumbnailPath?.includes("thumb-custom")
      ? undefined
      : toApiUrl(scene.cardThumbnailPath, scene.updatedAt),
    trickplaySprite: toApiUrl(scene.spritePath, scene.updatedAt),
    trickplayVtt: toApiUrl(scene.trickplayVttPath, scene.updatedAt),
    scrubDurationSeconds: scene.duration ?? undefined,
    duration: scene.durationFormatted ?? undefined,
    resolution: scene.resolution ?? undefined,
    codec: scene.codec ?? undefined,
    fileSize: scene.fileSizeFormatted ?? undefined,
    performers: scene.performers.map((performer) => ({
      name: performer.name,
      imagePath: toApiUrl(performer.imagePath) ?? undefined,
    })),
    tags: scene.tags.map((tag) => tag.name),
    rating: scene.rating ?? undefined,
    views: scene.playCount,
  };
}

export function searchSceneItemToCardData(item: SearchResultItem): SceneCardData | null {
  if (item.kind !== "scene") return null;

  const thumbnailPath = toApiUrl(item.imagePath);
  const rawCardThumbnailPath = readMetaString(item.meta, "cardThumbnailPath");

  return {
    id: item.id,
    href: item.href,
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
