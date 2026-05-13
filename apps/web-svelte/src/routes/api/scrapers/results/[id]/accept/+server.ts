import { json, type RequestHandler } from "@sveltejs/kit";
import { acceptScrapeResultWrite } from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    fields?: string[];
    excludePerformers?: string[];
    excludeTags?: string[];
  };

  try {
    return json(
      await acceptScrapeResultWrite(db, {
        id: params.id!,
        fields: body.fields,
        excludePerformers: body.excludePerformers,
        excludeTags: body.excludeTags,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
