import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteMarkerWrite,
  updateMarkerWrite,
  type UpdateMarkerBody,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as UpdateMarkerBody;
  try {
    return json(await updateMarkerWrite(db, params.markerId!, body));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteMarkerWrite(db, params.markerId!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
