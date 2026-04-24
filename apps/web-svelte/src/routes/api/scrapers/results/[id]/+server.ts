import { json, type RequestHandler } from "@sveltejs/kit";
import { getScrapeResultRead } from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await getScrapeResultRead(db, { id: params.id! }));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
