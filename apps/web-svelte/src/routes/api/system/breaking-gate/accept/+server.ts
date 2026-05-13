import { dev } from "$app/environment";
import { env as publicEnv } from "$env/dynamic/public";
import { acceptAndPrepareV2Upgrade, resolveV2ApiBase } from "$lib/server/v2-system-gate";
import { json, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ fetch }) => {
  const result = await acceptAndPrepareV2Upgrade(fetch, resolveV2ApiBase(publicEnv, dev));
  return json({ ok: true, ...result });
};
