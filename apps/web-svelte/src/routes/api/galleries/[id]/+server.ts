import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteGalleryWrite,
  getGalleryDetailRead,
  updateGalleryWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  try {
    return json(
      await getGalleryDetailRead(db, params.id!, {
        imageLimit: url.searchParams.get("imageLimit") ?? undefined,
        imageOffset: url.searchParams.get("imageOffset") ?? undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(await updateGalleryWrite(db, params.id!, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteGalleryWrite(db, params.id!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
