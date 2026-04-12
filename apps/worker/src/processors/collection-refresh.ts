import { eq, and, sql } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { db, collections, collectionItems } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { evaluateRuleTree } from "../../../api/src/services/collection-rule-engine.js";
import type { CollectionRuleGroup } from "@obscura/contracts";

export async function processCollectionRefresh(job: Job) {
  const collectionId = String(job.data.collectionId);

  const [coll] = await db
    .select({
      id: collections.id,
      name: collections.name,
      mode: collections.mode,
      ruleTree: collections.ruleTree,
    })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!coll) {
    throw new Error(`Collection ${collectionId} not found`);
  }

  if (coll.mode === "manual" || !coll.ruleTree) {
    return;
  }

  await markJobActive(job, "collection-refresh", {
    type: "collection",
    id: coll.id,
    label: coll.name,
  });

  // Evaluate rules
  const ruleTree = coll.ruleTree as CollectionRuleGroup;
  const resolvedItems = await evaluateRuleTree(ruleTree);

  await markJobProgress(job, "collection-refresh", 50);

  // Transaction: delete dynamic items, insert new ones
  await db.transaction(async (tx) => {
    // Remove all dynamic items
    await tx
      .delete(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.source, "dynamic"),
        ),
      );

    // Get max sort order of remaining (manual) items
    const [maxRow] = await tx
      .select({ maxSort: sql<number>`coalesce(max(sort_order), -1)::int` })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));

    let sortOrder = (maxRow?.maxSort ?? -1) + 1;

    // Insert resolved items as dynamic, ON CONFLICT DO NOTHING
    for (const item of resolvedItems) {
      await tx
        .insert(collectionItems)
        .values({
          collectionId,
          entityType: item.entityType,
          entityId: item.entityId,
          source: "dynamic",
          sortOrder: sortOrder++,
        })
        .onConflictDoNothing();
    }

    // Update counts
    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));

    await tx
      .update(collections)
      .set({
        itemCount: countRow?.count ?? 0,
        lastRefreshedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(collections.id, collectionId));
  });

  await markJobProgress(job, "collection-refresh", 100);
}
