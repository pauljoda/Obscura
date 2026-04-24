import { json, type RequestHandler } from "@sveltejs/kit";
import { getVideoStatsRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  try {
    return json(await getVideoStatsRead(db, url.searchParams.get("nsfw") === "off"));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
