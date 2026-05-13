import { json, type RequestHandler } from "@sveltejs/kit";
import { setPerformerImageFromUrlWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const { imageUrl } = (await request.json()) as { imageUrl: string };
  try {
    return json(await setPerformerImageFromUrlWrite(db, params.id!, imageUrl));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
