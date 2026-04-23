import type { RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/server/db";
import { serveLegacyHlsAsset } from "$lib/server/video-stream";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  return serveLegacyHlsAsset(db, params.id!, params.asset ?? "");
};
