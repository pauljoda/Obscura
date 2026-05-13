import { json, type RequestHandler } from "@sveltejs/kit";
import { getObscuraPluginIndexRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();

  try {
    return json(
      await getObscuraPluginIndexRead(db, {
        refresh: url.searchParams.get("refresh") ?? undefined,
      }),
    );
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
