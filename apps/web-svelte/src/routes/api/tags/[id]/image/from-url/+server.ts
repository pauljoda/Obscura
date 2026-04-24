import { json, type RequestHandler } from "@sveltejs/kit";
import { setTagImageFromUrlWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapTagErrorToJson } from "$lib/server/tag-error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const { imageUrl } = (await request.json()) as { imageUrl: string };
  try {
    return json(await setTagImageFromUrlWrite(db, params.id!, imageUrl));
  } catch (err) {
    return mapTagErrorToJson(err);
  }
};
