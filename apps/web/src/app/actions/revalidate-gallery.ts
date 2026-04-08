"use server";

import { revalidateTag } from "next/cache";

/** Drop cached server fetches for gallery list and affected detail pages after NSFW or metadata edits. */
export async function revalidateGalleryCache(galleryIds: string[]) {
  revalidateTag("galleries");
  for (const gid of galleryIds) {
    revalidateTag(`gallery-${gid}`);
  }
}
