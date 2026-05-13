import { json, type RequestHandler } from "@sveltejs/kit";
import { bulkUpdateImagesWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const PATCH: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  try {
    return json(await bulkUpdateImagesWrite(db, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
