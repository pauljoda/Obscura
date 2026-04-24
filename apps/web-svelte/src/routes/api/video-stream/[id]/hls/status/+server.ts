import type { RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/server/db";
import { serveHlsStatus } from "$lib/server/video-stream";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  return serveHlsStatus(db, params.id!);
};
