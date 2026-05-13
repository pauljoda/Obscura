import type { RequestHandler } from "@sveltejs/kit";
import { getWebDb } from "$lib/v1/server/db-v1";
import { serveLegacyHlsAsset } from "$lib/v1/server/video-stream-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  return serveLegacyHlsAsset(db, params.id!, params.asset ?? "");
};
