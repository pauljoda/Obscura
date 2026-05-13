import { json, type RequestHandler } from "@sveltejs/kit";
import { getPluginAuthStatusesRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();

  try {
    return json(await getPluginAuthStatusesRead(db, params.id!));
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
