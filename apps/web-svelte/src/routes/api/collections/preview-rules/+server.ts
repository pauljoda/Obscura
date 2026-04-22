import { json, type RequestHandler } from "@sveltejs/kit";
import { previewCollectionRulesRead } from "@obscura/app-core";
import type { CollectionRuleGroup } from "@obscura/contracts";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { ruleTree: CollectionRuleGroup };
  try {
    return json(await previewCollectionRulesRead(db, body.ruleTree));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
