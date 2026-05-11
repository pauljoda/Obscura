import { json, type RequestHandler } from "@sveltejs/kit";
import { deleteBookWrite, getBookDetailRead, updateBookWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  try {
    return json(await getBookDetailRead(db, params.id!, url.searchParams.get("nsfw") ?? undefined));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  try {
    return json(await updateBookWrite(db, params.id!, await request.json()));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params, url }) => {
  const db = await getWebDb();
  try {
    return json(await deleteBookWrite(db, params.id!, url.searchParams.get("deleteFile") === "true"));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
