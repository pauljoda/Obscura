import { json, type RequestHandler } from "@sveltejs/kit";
import { getVideoStatsRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  try {
    return json(await getVideoStatsRead(db, url.searchParams.get("nsfw") === "off"));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
