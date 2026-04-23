import { json, type RequestHandler } from "@sveltejs/kit";
import { cancelAllJobsWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async () => {
  const db = await getWebDb();
  try {
    return json(await cancelAllJobsWrite(db));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
