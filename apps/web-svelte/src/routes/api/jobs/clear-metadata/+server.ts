import { json, type RequestHandler } from "@sveltejs/kit";
import { clearMetadataWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async () => {
  const db = await getWebDb();
  try {
    return json(await clearMetadataWrite(db));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
