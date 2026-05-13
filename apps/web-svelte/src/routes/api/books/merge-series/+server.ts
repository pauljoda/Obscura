import { json, type RequestHandler } from "@sveltejs/kit";
import { mergeBooksIntoSeriesWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  try {
    return json(await mergeBooksIntoSeriesWrite(db, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
