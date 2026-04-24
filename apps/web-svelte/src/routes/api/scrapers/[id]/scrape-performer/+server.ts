import { json, type RequestHandler } from "@sveltejs/kit";
import { scrapePerformerWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    performerId: string;
    action?: string;
    url?: string;
    query?: string;
  };

  try {
    return json(
      await scrapePerformerWrite(db, {
        scraperId: params.id!,
        performerId: body.performerId,
        action: body.action,
        url: body.url,
        query: body.query,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
