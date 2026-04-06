"use client";

import type { SearchResultItem } from "@obscura/contracts";
import { toApiUrl, type PerformerItem } from "../../lib/api";

export interface PerformerCardData {
  id: string;
  href: string;
  name: string;
  sceneCount: number;
  favorite: boolean;
  imagePath?: string;
  rating?: number;
  gender?: string;
}

function readMetaNumber(meta: SearchResultItem["meta"], key: string): number | undefined {
  const value = meta[key];
  return typeof value === "number" ? value : undefined;
}

function readMetaString(meta: SearchResultItem["meta"], key: string): string | undefined {
  const value = meta[key];
  return typeof value === "string" ? value : undefined;
}

export function performerItemToCardData(performer: PerformerItem): PerformerCardData {
  return {
    id: performer.id,
    href: `/performers/${performer.id}`,
    name: performer.name,
    sceneCount: performer.sceneCount,
    favorite: performer.favorite,
    imagePath: toApiUrl(performer.imagePath) ?? undefined,
    rating: performer.rating ?? undefined,
    gender: performer.gender ?? undefined,
  };
}

export function searchPerformerItemToCardData(item: SearchResultItem): PerformerCardData | null {
  if (item.kind !== "performer") return null;

  return {
    id: item.id,
    href: item.href,
    name: item.title,
    sceneCount: readMetaNumber(item.meta, "sceneCount") ?? 0,
    favorite: false,
    imagePath: toApiUrl(item.imagePath) ?? undefined,
    rating: item.rating ?? undefined,
    gender: readMetaString(item.meta, "gender"),
  };
}
