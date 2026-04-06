"use client";

import type { ImageListItemDto, SearchResultItem } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";

export interface ImageCardData {
  id: string;
  href: string;
  title: string;
  date?: string;
  rating?: number;
  width?: number;
  height?: number;
  format?: string;
  isVideo: boolean;
  fileSize?: number;
  thumbnail?: string;
  preview?: string;
  full?: string;
  galleryTitle?: string;
  tags: string[];
}

function readMetaNumber(meta: SearchResultItem["meta"], key: string): number | undefined {
  const value = meta[key];
  return typeof value === "number" ? value : undefined;
}

export function imageItemToCardData(image: ImageListItemDto): ImageCardData {
  return {
    id: image.id,
    href: image.galleryId ? `/galleries/${image.galleryId}` : `/images/${image.id}`,
    title: image.title,
    date: image.date ?? undefined,
    rating: image.rating ?? undefined,
    width: image.width ?? undefined,
    height: image.height ?? undefined,
    format: image.format ?? undefined,
    isVideo: image.isVideo,
    fileSize: image.fileSize ?? undefined,
    thumbnail: toApiUrl(image.thumbnailPath),
    preview: toApiUrl(image.previewPath),
    full: toApiUrl(image.fullPath),
    tags: image.tags.map((tag) => tag.name),
  };
}

export function searchImageItemToCardData(item: SearchResultItem): ImageCardData | null {
  if (item.kind !== "image") return null;

  return {
    id: item.id,
    href: item.href,
    title: item.title,
    rating: item.rating ?? undefined,
    width: readMetaNumber(item.meta, "width"),
    height: readMetaNumber(item.meta, "height"),
    format: typeof item.meta.format === "string" ? item.meta.format : undefined,
    isVideo: typeof item.meta.format === "string"
      ? ["mp4", "mov", "webm", "mkv", "avi", "m4v"].includes(item.meta.format.toLowerCase())
      : false,
    thumbnail: toApiUrl(item.imagePath),
    preview: typeof item.meta.previewPath === "string" ? toApiUrl(item.meta.previewPath) : undefined,
    full: typeof item.meta.fullPath === "string" ? toApiUrl(item.meta.fullPath) : undefined,
    galleryTitle: item.subtitle ?? undefined,
    tags: [],
  };
}
