import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deletePerformerWrite,
  getPerformerByIdRead,
  updatePerformerWrite,
  type UpdatePerformerBody,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const sfwOnly = url.searchParams.get("nsfw") === "off";
  const db = await getWebDb();
  const detail = await getPerformerByIdRead(db, params.id!, sfwOnly);
  if (!detail) return json({ error: "Actor not found" }, { status: 404 });
  return json(detail);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as UpdatePerformerBody;
  try {
    return json(await updatePerformerWrite(db, params.id!, body));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deletePerformerWrite(db, params.id!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
