import { type RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";
import { createDbAssetDeps } from "$lib/v1/server/assets/database-deps-v1";
import { resolveAssetRequest } from "$lib/v1/server/assets/resolve-asset-request-v1";

export const GET: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();

  try {
    return await resolveAssetRequest(
      createDbAssetDeps(db),
      params.asset ?? "",
      request.headers.get("range"),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
