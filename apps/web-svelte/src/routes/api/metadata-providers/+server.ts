import { json, type RequestHandler } from "@sveltejs/kit";
import { listMetadataProvidersRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  try {
    return json(await listMetadataProvidersRead(db));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
