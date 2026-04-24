import { json, type RequestHandler } from "@sveltejs/kit";
import { getGalleryStatsRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  return json(await getGalleryStatsRead(db));
};
