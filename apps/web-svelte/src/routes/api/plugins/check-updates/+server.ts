import { json, type RequestHandler } from "@sveltejs/kit";
import { getPluginUpdateStatusesRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();

  try {
    return json(
      await getPluginUpdateStatusesRead(db, {
        refresh: url.searchParams.get("refresh") ?? undefined,
      }),
    );
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
