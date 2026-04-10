"use client";

import type { SearchResultItem } from "@obscura/contracts";
import { toApiUrl, type StudioItem } from "../../lib/api";

export interface StudioCardData {
  id: string;
  href: string;
  name: string;
  sceneCount: number;
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

export function studioItemToCardData(studio: StudioItem): StudioCardData {
  return {
    id: studio.id,
    href: `/studios/${studio.id}`,
    name: studio.name,
    sceneCount: studio.sceneCount,
    imageAppearanceCount: studio.imageAppearanceCount,
    audioLibraryCount: studio.audioLibraryCount,
    favorite: studio.favorite,
    imagePath: studio.imagePath ? toApiUrl(studio.imagePath) : studio.imageUrl ?? undefined,
    rating: studio.rating ?? undefined,
    isNsfw: studio.isNsfw,
  };
}

export function searchStudioItemToCardData(item: SearchResultItem): StudioCardData | null {
  if (item.kind !== "studio") return null;

  return {
    id: item.id,
    href: item.href,
    name: item.title,
    sceneCount: readMetaNumber(item.meta, "sceneCount") ?? 0,
    imageAppearanceCount: readMetaNumber(item.meta, "imageAppearanceCount") ?? 0,
    audioLibraryCount: readMetaNumber(item.meta, "audioLibraryCount") ?? 0,
    favorite: false,
    imagePath: toApiUrl(item.imagePath) ?? undefined,
    rating: item.rating ?? undefined,
  };
}
