import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteGalleryChapterWrite,
  updateGalleryChapterWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(
      await updateGalleryChapterWrite(db, params.chapterId!, await request.json()),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteGalleryChapterWrite(db, params.chapterId!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
