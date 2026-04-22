import { json, type RequestHandler } from "@sveltejs/kit";
import { setPerformerRatingWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapPerformerErrorToJson } from "$lib/server/performer-error-mapper";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const { rating } = (await request.json()) as { rating: number | null };
  try {
    return json(await setPerformerRatingWrite(db, params.id!, rating));
  } catch (err) {
    return mapPerformerErrorToJson(err);
  }
};
