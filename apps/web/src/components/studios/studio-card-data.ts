"use client";

import type { SearchResultItem } from "@obscura/contracts";
import { toApiUrl, type StudioItem } from "../../lib/api";
import { buildHrefWithFrom } from "../../lib/back-navigation";

export interface StudioCardData {
  id: string;
  href: string;
  name: string;
  videoCount: number;
  imageAppearanceCount: number;
  audioLibraryCount: number;
  favorite: boolean;
  imagePath?: string;
  rating?: number;
  isNsfw?: boolean;
}

function readMetaNumber(meta: SearchResultItem["meta"], key: string): number | undefined {
  const value = meta[key];
  return typeof value === "number" ? value : undefined;
}

export function studioItemToCardData(studio: StudioItem, from?: string): StudioCardData {
  const base = `/studios/${studio.id}`;
  return {
    id: studio.id,
    href: from ? buildHrefWithFrom(base, from) : base,
    name: studio.name,
    videoCount: studio.videoCount,
    imageAppearanceCount: studio.imageAppearanceCount,
    audioLibraryCount: studio.audioLibraryCount,
    favorite: studio.favorite,
    imagePath: studio.imagePath ? toApiUrl(studio.imagePath) : studio.imageUrl ?? undefined,
    rating: studio.rating ?? undefined,
    isNsfw: studio.isNsfw,
  };
}

export function searchStudioItemToCardData(item: SearchResultItem, from?: string): StudioCardData | null {
  if (item.kind !== "studio") return null;

  return {
    id: item.id,
    href: from ? buildHrefWithFrom(item.href, from) : item.href,
    name: item.title,
    videoCount: readMetaNumber(item.meta, "videoCount") ?? 0,
    imageAppearanceCount: readMetaNumber(item.meta, "imageAppearanceCount") ?? 0,
    audioLibraryCount: readMetaNumber(item.meta, "audioLibraryCount") ?? 0,
    favorite: false,
    imagePath: toApiUrl(item.imagePath) ?? undefined,
    rating: item.rating ?? undefined,
  };
}
