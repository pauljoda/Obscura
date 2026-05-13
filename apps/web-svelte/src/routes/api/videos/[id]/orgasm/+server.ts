import { json, type RequestHandler } from "@sveltejs/kit";
import { recordVideoOrgasmWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await recordVideoOrgasmWrite(db, params.id!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
