import { json, type RequestHandler } from "@sveltejs/kit";
import { getUnifiedPluginIndexRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();

  try {
    return json(
      await getUnifiedPluginIndexRead(db, {
        source: url.searchParams.get("source") ?? undefined,
        isNsfw: url.searchParams.get("isNsfw") ?? undefined,
      }),
    );
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
