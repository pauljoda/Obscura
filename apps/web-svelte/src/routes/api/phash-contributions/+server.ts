import { json, type RequestHandler } from "@sveltejs/kit";
import { listPhashContributionsRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  try {
    return json(
      await listPhashContributionsRead(db, {
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
