import { json, type RequestHandler } from "@sveltejs/kit";
import { listScrapeResultsRead } from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  try {
    return json(
      await listScrapeResultsRead(db, {
        status: url.searchParams.get("status") ?? undefined,
        videoId: url.searchParams.get("videoId") ?? undefined,
        limit: url.searchParams.get("limit") ?? undefined,
        offset: url.searchParams.get("offset") ?? undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
