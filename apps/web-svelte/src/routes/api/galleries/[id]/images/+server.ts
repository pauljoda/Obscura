import { json, type RequestHandler } from "@sveltejs/kit";
import { getGalleryImagesRead } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  try {
    return json(
      await getGalleryImagesRead(db, params.id!, {
        limit: url.searchParams.get("limit") ?? undefined,
        offset: url.searchParams.get("offset") ?? undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
