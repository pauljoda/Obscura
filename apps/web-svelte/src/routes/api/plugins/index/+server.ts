import { json, type RequestHandler } from "@sveltejs/kit";
import { getUnifiedPluginIndexRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

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
