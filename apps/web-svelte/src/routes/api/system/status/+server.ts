import { checkBreakingGate } from "@obscura/app-core";
import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";

const DEFAULT_DATABASE_URL =
  "postgres://obscura:obscura@localhost:5432/obscura";

export const GET: RequestHandler = async () => {
  const gate = await checkBreakingGate(env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  return json({
    awaitingBreakingConsent: gate.awaitingConsent,
  });
};
