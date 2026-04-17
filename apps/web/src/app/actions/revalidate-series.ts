"use server";

import { revalidateTag } from "next/cache";

export async function revalidateSeriesCache(seriesId: string) {
  revalidateTag("video-series");
  revalidateTag(`video-series-${seriesId}`);
  revalidateTag("videos");
}
