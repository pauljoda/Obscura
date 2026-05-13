import { json, type RequestHandler } from "@sveltejs/kit";
import { createAudioTrackMarkerWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(await createAudioTrackMarkerWrite(db, params.id!, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
