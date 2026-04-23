import { json, type RequestHandler } from "@sveltejs/kit";
import { getPluginAuthStatusesRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();

  try {
    return json(await getPluginAuthStatusesRead(db, params.id!));
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
