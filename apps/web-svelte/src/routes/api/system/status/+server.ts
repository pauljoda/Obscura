import { dev } from "$app/environment";
import { env as publicEnv } from "$env/dynamic/public";
import { readV2UpgradeGate, resolveV2ApiBase } from "$lib/server/v2-system-gate";
import { json, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ fetch }) => {
  const gate = await readV2UpgradeGate(fetch, resolveV2ApiBase(publicEnv, dev));
  return json({
    awaitingBreakingConsent: gate.awaitingBreakingConsent,
    gateId: gate.gateId,
  });
};
