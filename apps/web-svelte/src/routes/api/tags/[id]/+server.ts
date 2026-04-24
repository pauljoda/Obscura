import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteTagWrite,
  getTagByIdRead,
  updateTagWrite,
  type UpdateTagBody,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const sfwOnly = url.searchParams.get("nsfw") === "off";
  const db = await getWebDb();
  const detail = await getTagByIdRead(db, params.id!, sfwOnly);
  if (!detail) return json({ error: "Tag not found" }, { status: 404 });
  return json(detail);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as UpdateTagBody;
  try {
    return json(await updateTagWrite(db, params.id!, body));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteTagWrite(db, params.id!));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
