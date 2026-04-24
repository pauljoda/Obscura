import { json, type RequestHandler } from "@sveltejs/kit";
import { setTagRatingWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const { rating } = (await request.json()) as { rating: number | null };
  try {
    return json(await setTagRatingWrite(db, params.id!, rating));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
