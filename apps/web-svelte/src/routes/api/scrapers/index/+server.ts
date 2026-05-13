import { json, type RequestHandler } from "@sveltejs/kit";
import { fetchCommunityScraperIndexRead } from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  try {
    return json(
      await fetchCommunityScraperIndexRead(db, {
        force: url.searchParams.get("force") === "true",
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
