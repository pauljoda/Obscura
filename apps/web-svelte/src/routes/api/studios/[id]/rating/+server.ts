import { json, type RequestHandler } from "@sveltejs/kit";
import { setStudioRatingWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const { rating } = (await request.json()) as { rating: number | null };
  try {
    return json(await setStudioRatingWrite(db, params.id!, rating));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
