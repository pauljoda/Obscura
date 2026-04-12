"use client";

import type { SearchResultItem } from "@obscura/contracts";
import { toApiUrl, type PerformerItem } from "../../lib/api";
import { buildHrefWithFrom } from "../../lib/back-navigation";

export interface PerformerCardData {
  id: string;
  href: string;
  name: string;
  sceneCount: number;
  imageAppearanceCount: number;
  audioLibraryCount: number;
  favorite: boolean;
  imagePath?: string;
  rating?: number;
  gender?: string;
  isNsfw?: boolean;
}

function readMetaNumber(meta: SearchResultItem["meta"], key: string): number | undefined {
  const value = meta[key];
  return typeof value === "number" ? value : undefined;
}

function readMetaString(meta: SearchResultItem["meta"], key: string): string | undefined {
  const value = meta[key];
  return typeof value === "string" ? value : undefined;
}

export function performerItemToCardData(performer: PerformerItem, from?: string): PerformerCardData {
  const base = `/performers/${performer.id}`;
  return {
    id: performer.id,
    href: from ? buildHrefWithFrom(base, from) : base,
    name: performer.name,
    sceneCount: performer.sceneCount,
    imageAppearanceCount: performer.imageAppearanceCount,
    audioLibraryCount: performer.audioLibraryCount,
    favorite: performer.favorite,
    imagePath: toApiUrl(performer.imagePath) ?? undefined,
    rating: performer.rating ?? undefined,
    gender: performer.gender ?? undefined,
    isNsfw: performer.isNsfw,
  };
}

export function searchPerformerItemToCardData(item: SearchResultItem, from?: string): PerformerCardData | null {
  if (item.kind !== "performer") return null;

  return {
    id: item.id,
    href: from ? buildHrefWithFrom(item.href, from) : item.href,
    name: item.title,
    sceneCount: readMetaNumber(item.meta, "sceneCount") ?? 0,
    imageAppearanceCount: readMetaNumber(item.meta, "imageAppearanceCount") ?? 0,
    audioLibraryCount: readMetaNumber(item.meta, "audioLibraryCount") ?? 0,
    favorite: false,
    imagePath: toApiUrl(item.imagePath) ?? undefined,
    rating: item.rating ?? undefined,
    gender: readMetaString(item.meta, "gender"),
  };
}
