import { json, type RequestHandler } from "@sveltejs/kit";
import { setCustomVideoThumbnailFromFrameWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { seconds?: number };
  try {
    return json(
      await setCustomVideoThumbnailFromFrameWrite(
        db,
        params.id!,
        Number(body?.seconds),
      ),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
