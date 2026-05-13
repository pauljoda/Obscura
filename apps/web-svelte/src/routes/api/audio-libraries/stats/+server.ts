import { json, type RequestHandler } from "@sveltejs/kit";
import { getAudioLibraryStatsRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  return json(await getAudioLibraryStatsRead(db, url.searchParams.get("nsfw") ?? undefined));
};
