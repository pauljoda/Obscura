import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteImageWrite,
  getImageDetailRead,
  updateImageWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await getImageDetailRead(db, params.id!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(await updateImageWrite(db, params.id!, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  try {
    return json(
      await deleteImageWrite(
        db,
        params.id!,
        url.searchParams.get("deleteFile") === "true",
      ),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
