import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteStudioWrite,
  getStudioByIdRead,
  updateStudioWrite,
  type UpdateStudioBody,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapStudioErrorToJson } from "$lib/server/studio-error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const sfwOnly = url.searchParams.get("nsfw") === "off";
  const db = await getWebDb();
  const detail = await getStudioByIdRead(db, params.id!, sfwOnly);
  if (!detail) return json({ error: "Studio not found" }, { status: 404 });
  return json(detail);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as UpdateStudioBody;
  try {
    return json(await updateStudioWrite(db, params.id!, body));
  } catch (err) {
    return mapStudioErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteStudioWrite(db, params.id!));
  } catch (err) {
    return mapStudioErrorToJson(err);
  }
};
