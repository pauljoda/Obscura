import { json, type RequestHandler } from "@sveltejs/kit";
import { getBookDetailRead } from "@obscura/app-core";
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
