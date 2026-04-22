import { json, type RequestHandler } from "@sveltejs/kit";
import { setPerformerImageFromUrlWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapPerformerErrorToJson } from "$lib/server/performer-error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const { imageUrl } = (await request.json()) as { imageUrl: string };
  try {
    return json(await setPerformerImageFromUrlWrite(db, params.id!, imageUrl));
  } catch (err) {
    return mapPerformerErrorToJson(err);
  }
};
