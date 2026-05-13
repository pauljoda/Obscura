import { json, type RequestHandler } from "@sveltejs/kit";
import {
  createMarkerWrite,
  listMarkersRead,
  type CreateMarkerBody,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    const markers = await listMarkersRead(db, params.id!);
    return json({ markers });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as CreateMarkerBody;
  try {
    return json(await createMarkerWrite(db, params.id!, body));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
