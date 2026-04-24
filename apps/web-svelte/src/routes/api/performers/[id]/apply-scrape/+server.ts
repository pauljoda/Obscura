import { json, type RequestHandler } from "@sveltejs/kit";
import { applyPerformerScrapeWrite } from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    fields: Record<string, unknown>;
    selectedFields: string[];
  };

  try {
    return json(
      await applyPerformerScrapeWrite(db, {
        performerId: params.id!,
        fields: body.fields,
        selectedFields: body.selectedFields,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
