import { json, type RequestHandler } from "@sveltejs/kit";
import { previewCollectionRulesRead } from "@obscura/app-core";
import type { CollectionRuleGroup } from "@obscura/contracts";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ request, url }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { ruleTree: CollectionRuleGroup };
  const nsfw = url.searchParams.get("nsfw");
  try {
    return json(
      await previewCollectionRulesRead(db, body.ruleTree, {
        nsfw: nsfw === "on" || nsfw === "off" ? nsfw : undefined,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
