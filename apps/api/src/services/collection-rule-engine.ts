/**
 * Collection Rule Engine — API-bound wrappers.
 *
 * Delegates to the shared implementation in @obscura/db, passing
 * the API's database connection.
 */
import type { CollectionRuleGroup } from "@obscura/contracts";
import { db } from "../db";
import {
  evaluateRuleTree as evaluateRuleTreeImpl,
  previewRuleTree as previewRuleTreeImpl,
  RESOLUTION_MAP,
  type ResolvedItem,
} from "@obscura/db/src/lib/collection-rule-engine";

export { RESOLUTION_MAP, type ResolvedItem };

/**
 * Evaluate a rule tree and return all matching entity references.
 */
export async function evaluateRuleTree(
  ruleTree: CollectionRuleGroup,
): Promise<ResolvedItem[]> {
  return evaluateRuleTreeImpl(db, ruleTree);
}

/**
 * Evaluate a rule tree and return a preview with counts and sample items.
 */
export async function previewRuleTree(
  ruleTree: CollectionRuleGroup,
  sampleLimit = 20,
) {
  return previewRuleTreeImpl(db, ruleTree, sampleLimit);
}
