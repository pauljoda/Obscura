import type { RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/v1/server/db-v1";
import { serveHlsStatus } from "$lib/v1/server/video-stream-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  return serveHlsStatus(db, params.id!);
};
