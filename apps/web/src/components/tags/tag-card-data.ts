"use client";

import type { SearchResultItem } from "@obscura/contracts";
import { toApiUrl, type TagItem } from "../../lib/api";
import { buildHrefWithFrom } from "../../lib/back-navigation";

export interface TagCardData {
  id: string;
  href: string;
  name: string;
  sceneCount: number;
  imageCount: number;
  imagePath?: string;
  isNsfw?: boolean;
}

function readMetaNumber(meta: SearchResultItem["meta"], key: string): number | undefined {
  const value = meta[key];
  return typeof value === "number" ? value : undefined;
}

export function tagItemToCardData(tag: TagItem, from?: string): TagCardData {
  const base = `/tags/${encodeURIComponent(tag.name)}`;
  return {
    id: tag.id,
    href: from ? buildHrefWithFrom(base, from) : base,
    name: tag.name,
    sceneCount: tag.sceneCount,
    imageCount: tag.imageCount ?? 0,
    imagePath: toApiUrl(tag.imagePath) ?? undefined,
    isNsfw: tag.isNsfw,
  };
}

export function searchTagItemToCardData(item: SearchResultItem, from?: string): TagCardData | null {
  if (item.kind !== "tag") return null;

  return {
    id: item.id,
    href: from ? buildHrefWithFrom(item.href, from) : item.href,
    name: item.title,
    sceneCount: readMetaNumber(item.meta, "sceneCount") ?? 0,
    imageCount: readMetaNumber(item.meta, "imageCount") ?? 0,
    imagePath: toApiUrl(item.imagePath) ?? undefined,
  };
}
