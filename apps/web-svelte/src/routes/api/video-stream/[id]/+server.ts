import type { RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/server/db";
import { serveVideoSource } from "$lib/server/video-stream";

export const GET: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  return serveVideoSource(db, params.id!, request.headers.get("range"));
};
