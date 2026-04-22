import { json, type RequestHandler } from "@sveltejs/kit";
import { setStudioFavoriteWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapStudioErrorToJson } from "$lib/server/studio-error-mapper";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const { favorite } = (await request.json()) as { favorite: boolean };
  try {
    return json(await setStudioFavoriteWrite(db, params.id!, favorite));
  } catch (err) {
    return mapStudioErrorToJson(err);
  }
};
