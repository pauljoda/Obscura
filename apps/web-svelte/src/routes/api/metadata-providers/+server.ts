import { json, type RequestHandler } from "@sveltejs/kit";
import { listMetadataProvidersRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async () => {
  const db = await getWebDb();
  try {
    return json(await listMetadataProvidersRead(db));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
