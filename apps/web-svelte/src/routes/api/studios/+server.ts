import { json, type RequestHandler } from "@sveltejs/kit";
import {
  createStudioWrite,
  listStudiosRead,
  type CreateStudioBody,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ url }) => {
  const sfwOnly = url.searchParams.get("nsfw") === "off";
  const db = await getWebDb();
  return json(await listStudiosRead(db, sfwOnly));
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as CreateStudioBody;
  try {
    return json(await createStudioWrite(db, body), { status: 201 });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
