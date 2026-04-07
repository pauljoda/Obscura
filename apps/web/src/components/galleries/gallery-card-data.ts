"use client";

import type { SearchResultItem, GalleryType, GalleryListItemDto } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";

export interface GalleryCardData {
  id: string;
  href: string;
  title: string;
  galleryType: GalleryType;
  imageCount: number;
  rating?: number;
  date?: string;
  coverImage?: string;
  previewImages: string[];
  tags: string[];
  isNsfw?: boolean;
}

function readMetaNumber(meta: SearchResultItem["meta"], key: string): number | undefined {
  const value = meta[key];
  return typeof value === "number" ? value : undefined;
}

function readMetaGalleryType(meta: SearchResultItem["meta"]): GalleryType {
  const value = meta.galleryType;
  return value === "zip" || value === "virtual" ? value : "folder";
}

function readMetaString(meta: SearchResultItem["meta"], key: string): string | undefined {
  const value = meta[key];
  return typeof value === "string" ? value : undefined;
}

export function galleryListItemToCardData(gallery: GalleryListItemDto): GalleryCardData {
  return {
    id: gallery.id,
    href: `/galleries/${gallery.id}`,
    title: gallery.title,
    galleryType: gallery.galleryType,
    imageCount: gallery.imageCount,
    rating: gallery.rating ?? undefined,
    date: gallery.date ?? undefined,
    coverImage: toApiUrl(gallery.coverImagePath),
    previewImages: gallery.previewImagePaths.map((p) => toApiUrl(p)).filter(Boolean) as string[],
    tags: gallery.tags.map((tag) => tag.name),
    isNsfw: gallery.isNsfw,
  };
}

export function searchGalleryItemToCardData(item: SearchResultItem): GalleryCardData | null {
  if (item.kind !== "gallery") return null;

  return {
    id: item.id,
    href: item.href,
    title: item.title,
    galleryType: readMetaGalleryType(item.meta),
    imageCount: readMetaNumber(item.meta, "imageCount") ?? 0,
    rating: item.rating ?? undefined,
    coverImage: toApiUrl(item.imagePath),
    previewImages: (() => {
      const raw = readMetaString(item.meta, "previewImagePaths");
      if (!raw) return [];
      try {
        return (JSON.parse(raw) as string[]).map((p) => toApiUrl(p)).filter(Boolean) as string[];
      } catch {
        return [];
      }
    })(),
    tags: [],
  };
}
