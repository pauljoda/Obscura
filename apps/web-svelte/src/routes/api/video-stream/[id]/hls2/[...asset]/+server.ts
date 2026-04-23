import type { RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/server/db";
import { serveVirtualHlsAsset } from "$lib/server/video-stream";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  return serveVirtualHlsAsset(db, params.id!, params.asset ?? "");
};
