"use server";

import { revalidateTag } from "next/cache";

/** Drop cached server fetches for collection list and affected detail pages. */
export async function revalidateCollectionCache(collectionIds: string[] = []) {
  revalidateTag("collections");
  for (const id of collectionIds) {
    revalidateTag(`collection-${id}`);
  }
}
