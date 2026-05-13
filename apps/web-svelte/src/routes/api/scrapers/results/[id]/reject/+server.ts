import { json, type RequestHandler } from "@sveltejs/kit";
import { rejectScrapeResultWrite } from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await rejectScrapeResultWrite(db, { id: params.id! }));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
