import { json, type RequestHandler } from "@sveltejs/kit";
import { getScrapeResultRead } from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await getScrapeResultRead(db, { id: params.id! }));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
