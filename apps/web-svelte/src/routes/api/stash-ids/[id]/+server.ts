import { json, type RequestHandler } from "@sveltejs/kit";
import { deleteStashIdWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteStashIdWrite(db, { id: params.id! }));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
