import { json, type RequestHandler } from "@sveltejs/kit";
import { getStudioByIdRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";

export const GET: RequestHandler = async ({ params, url }) => {
  const sfwOnly = url.searchParams.get("nsfw") === "off";
  const db = await getWebDb();
  const detail = await getStudioByIdRead(db, params.id!, sfwOnly);
  if (!detail) return json({ error: "Studio not found" }, { status: 404 });
  return json(detail);
};
