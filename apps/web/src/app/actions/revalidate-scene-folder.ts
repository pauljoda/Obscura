"use server";

import { revalidateTag } from "next/cache";

export async function revalidateSceneFolderCache(folderId: string) {
  revalidateTag("scene-folders");
  revalidateTag(`scene-folder-${folderId}`);
  revalidateTag("scenes");
}
