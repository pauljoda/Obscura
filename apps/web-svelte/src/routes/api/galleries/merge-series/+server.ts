import { json, type RequestHandler } from "@sveltejs/kit";
import { mergeGalleriesIntoSeriesWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  try {
    return json(await mergeGalleriesIntoSeriesWrite(db, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
