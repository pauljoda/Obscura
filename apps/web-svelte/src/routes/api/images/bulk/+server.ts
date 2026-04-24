import { json, type RequestHandler } from "@sveltejs/kit";
import { bulkUpdateImagesWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const PATCH: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  try {
    return json(await bulkUpdateImagesWrite(db, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
