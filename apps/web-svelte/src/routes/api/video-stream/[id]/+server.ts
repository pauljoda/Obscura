import type { RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/v1/server/db-v1";
import { serveVideoSource } from "$lib/v1/server/video-stream-v1";

export const GET: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  return serveVideoSource(db, params.id!, request.headers.get("range"));
};
