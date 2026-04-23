import { type RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";
import { createDbAssetDeps } from "$lib/server/assets/database-deps";
import { resolveAssetRequest } from "$lib/server/assets/resolve-asset-request";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();

  try {
    return await resolveAssetRequest(
      createDbAssetDeps(db),
      params.asset ?? "",
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
