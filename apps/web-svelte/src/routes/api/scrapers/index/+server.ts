import { json, type RequestHandler } from "@sveltejs/kit";
import { fetchCommunityScraperIndexRead } from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

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
