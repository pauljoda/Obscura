"use server";

import { revalidateTag } from "next/cache";

export async function revalidateVideosCache() {
  revalidateTag("videos");
}
