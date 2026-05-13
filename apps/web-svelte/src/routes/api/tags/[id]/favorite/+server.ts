import { json, type RequestHandler } from "@sveltejs/kit";
import { setTagFavoriteWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const { favorite } = (await request.json()) as { favorite: boolean };
  try {
    return json(await setTagFavoriteWrite(db, params.id!, favorite));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
