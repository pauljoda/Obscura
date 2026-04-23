import { json, type RequestHandler } from "@sveltejs/kit";
import { getVideoSeriesLibraryDetailRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  const nsfw = url.searchParams.get("nsfw") ?? undefined;
  try {
    return json(await getVideoSeriesLibraryDetailRead(db, params.id!, nsfw));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
