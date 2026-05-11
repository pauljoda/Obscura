import { json, type RequestHandler } from "@sveltejs/kit";
import { updateBookProgressWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const PUT: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(await updateBookProgressWrite(db, params.id!, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
