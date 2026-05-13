import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteGalleryCoverWrite,
  setGalleryCoverWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { imageId: string };
  try {
    return json(await setGalleryCoverWrite(db, params.id!, body.imageId));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteGalleryCoverWrite(db, params.id!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
