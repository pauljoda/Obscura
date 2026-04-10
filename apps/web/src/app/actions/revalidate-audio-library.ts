"use server";

import { revalidateTag } from "next/cache";

export async function revalidateAudioLibraryCache(libraryId: string) {
  revalidateTag("audio-libraries");
  revalidateTag(`audio-library-${libraryId}`);
}
