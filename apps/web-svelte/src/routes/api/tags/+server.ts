import { json, type RequestHandler } from "@sveltejs/kit";
import { listTagsRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";

export const GET: RequestHandler = async ({ url }) => {
  const sfwOnly = url.searchParams.get("nsfw") === "off";
  const db = await getWebDb();
  return json(await listTagsRead(db, sfwOnly));
};
