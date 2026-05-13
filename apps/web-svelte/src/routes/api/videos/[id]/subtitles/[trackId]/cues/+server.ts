import { json, type RequestHandler } from "@sveltejs/kit";
import { getSubtitleCuesRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    const cues = await getSubtitleCuesRead(db, params.id!, params.trackId!);
    return json({ cues });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
