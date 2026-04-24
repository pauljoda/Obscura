import { json, type RequestHandler } from "@sveltejs/kit";
import { setPerformerFavoriteWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const { favorite } = (await request.json()) as { favorite: boolean };
  try {
    return json(await setPerformerFavoriteWrite(db, params.id!, favorite));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
