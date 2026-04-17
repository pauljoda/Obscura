"use server";

import { revalidateTag } from "next/cache";

const ALLOWED_TAGS = new Set([
  "videos",
  "video-series",
  "galleries",
  "images",
  "audio-libraries",
  "performers",
  "studios",
  "tags",
  "collections",
]);

export async function revalidateLibraryCaches(tags: string[]) {
  for (const tag of tags) {
    if (!ALLOWED_TAGS.has(tag)) continue;
    revalidateTag(tag);
  }
}
