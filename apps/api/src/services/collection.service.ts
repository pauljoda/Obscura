/**
 * Collection service — CRUD, item management, and rule evaluation.
 */
import { db, schema } from "../db";
import {
  eq,
  and,
  ilike,
  desc,
  asc,
  inArray,
  sql,
  count,
  type SQL,
} from "drizzle-orm";
import {
  buildOrderBy,
  parsePagination,
  type SortConfig,
} from "../lib/query-helpers";
import { AppError } from "../plugins/error-handler";
import {
  evaluateRuleTree,
  previewRuleTree,
} from "./collection-rule-engine";
import type {
  CollectionMode,
  CollectionEntityType,
  CollectionRuleGroup,
  CollectionItemSource,
  CollectionCreateDto,
  CollectionPatchDto,
  CollectionAddItemsDto,
  CollectionRemoveItemsDto,
  CollectionReorderDto,
  CollectionItemListQuery,
  CollectionListQuery,
} from "@obscura/contracts";

// We import the scene list item builder from the scene service
// to construct polymorphic entity embeds
import * as videoSceneService from "./video-scene.service";
import * as galleryService from "./gallery.service";
import * as imageService from "./image.service";
import * as audioTrackService from "./audio-track.service";

const { collections, collectionItems } = schema;

// ─── Sort config ────────────────────────────────────────────────

const collectionSortConfig: SortConfig = {
  columns: {
    recent: collections.createdAt,
    name: collections.name,
    updated: collections.updatedAt,
    items: collections.itemCount,
  } as SortConfig["columns"],
  defaultDirs: {
    recent: "desc",
    name: "asc",
    updated: "desc",
    items: "desc",
  },
  fallbackColumn: collections.createdAt,
};

// ─── Helpers ────────────────────────────────────────────────────

async function computeTypeCounts(
  collectionId: string,
): Promise<Record<CollectionEntityType, number>> {
  const rows = await db
    .select({
      entityType: collectionItems.entityType,
      count: sql<number>`count(*)::int`,
    })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId))
    .groupBy(collectionItems.entityType);

  const typeCounts: Record<CollectionEntityType, number> = {
    video: 0,
    gallery: 0,
    image: 0,
    "audio-track": 0,
  };

  for (const row of rows) {
    const type = row.entityType as CollectionEntityType;
    if (type in typeCounts) {
      typeCounts[type] = row.count;
    }
  }

  return typeCounts;
}

async function updateItemCount(collectionId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId));

  const itemCount = row?.count ?? 0;

  await db
    .update(collections)
    .set({ itemCount, updatedAt: new Date() })
    .where(eq(collections.id, collectionId));

  return itemCount;
}

function toCollectionListItem(
  row: typeof collections.$inferSelect,
  typeCounts: Record<CollectionEntityType, number>,
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    mode: row.mode as CollectionMode,
    itemCount: row.itemCount,
    coverMode: row.coverMode,
    coverImagePath: row.coverImagePath
      ? `/assets/collections/${row.id}/cover`
      : null,
    slideshowDurationSeconds: row.slideshowDurationSeconds,
    slideshowAutoAdvance: row.slideshowAutoAdvance,
    typeCounts,
    lastRefreshedAt: row.lastRefreshedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── List ───────────────────────────────────────────────────────

export async function listCollections(query: CollectionListQuery) {
  const { limit, offset } = parsePagination(
    query.limit?.toString(),
    query.offset?.toString(),
    50,
    200,
  );

  const conditions: SQL[] = [];

  if (query.search) {
    conditions.push(ilike(collections.name, `%${query.search}%`));
  }
  if (query.mode) {
    conditions.push(eq(collections.mode, query.mode));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(collections)
      .where(whereClause)
      .orderBy(buildOrderBy(collectionSortConfig, query.sort, query.order))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(collections)
      .where(whereClause),
  ]);

  const total = totalRows[0]?.count ?? 0;

  // Fetch type counts for all collections in the page
  const items = await Promise.all(
    rows.map(async (row) => {
      const typeCounts = await computeTypeCounts(row.id);
      return toCollectionListItem(row, typeCounts);
    }),
  );

  return { items, total, limit, offset };
}

// ─── Detail ─────────────────────────────────────────────────────

export async function getCollectionById(id: string) {
  const [row] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id));

  if (!row) throw new AppError(404, "Collection not found");

  const typeCounts = await computeTypeCounts(id);
  const base = toCollectionListItem(row, typeCounts);

  return {
    ...base,
    ruleTree: row.ruleTree as CollectionRuleGroup | null,
    coverItemId: row.coverItemId,
    coverItemType: row.coverItemType as CollectionEntityType | null,
  };
}

// ─── Items ──────────────────────────────────────────────────────

export async function getCollectionItems(
  collectionId: string,
  query: CollectionItemListQuery,
) {
  const { limit, offset } = parsePagination(
    query.limit?.toString(),
    query.offset?.toString(),
    50,
    500,
  );

  const conditions: SQL[] = [eq(collectionItems.collectionId, collectionId)];

  if (query.entityType) {
    conditions.push(eq(collectionItems.entityType, query.entityType));
  }

  const whereClause = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(collectionItems)
      .where(whereClause)
      .orderBy(asc(collectionItems.sortOrder), asc(collectionItems.addedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionItems)
      .where(whereClause),
  ]);

  const total = totalRows[0]?.count ?? 0;

  // Polymorphic entity loading — group IDs by type, bulk-fetch each
  const entityMap = await loadEntitiesForItems(rows);

  const items = rows.map((row) => ({
    id: row.id,
    collectionId: row.collectionId,
    entityType: row.entityType as CollectionEntityType,
    entityId: row.entityId,
    source: row.source as CollectionItemSource,
    sortOrder: row.sortOrder,
    addedAt: row.addedAt.toISOString(),
    entity: entityMap.get(`${row.entityType}:${row.entityId}`) ?? null,
  }));

  return { items, total, limit, offset };
}

/**
 * Bulk-load entities for a set of collection items.
 * Groups by entity type, fetches each type in a single query,
 * and returns a map from "entityType:entityId" to entity data.
 */
async function loadEntitiesForItems(
  rows: (typeof collectionItems.$inferSelect)[],
): Promise<Map<string, Record<string, unknown>>> {
  const entityMap = new Map<string, Record<string, unknown>>();

  // Group by entity type
  const idsByType: Record<string, string[]> = {};
  for (const row of rows) {
    if (!idsByType[row.entityType]) idsByType[row.entityType] = [];
    idsByType[row.entityType].push(row.entityId);
  }

  // Fetch each type. Collection items with entityType "video" resolve
  // against the video_episodes / video_movies tables.
  if (idsByType.video?.length) {
    const videos = await videoSceneService.getVideosByIds(idsByType.video);
    for (const video of videos) {
      entityMap.set(`video:${video.id}`, video as Record<string, unknown>);
    }
  }

  if (idsByType.gallery?.length) {
    const galleries = await galleryService.getGalleriesByIds(idsByType.gallery);
    for (const gallery of galleries) {
      entityMap.set(
        `gallery:${gallery.id}`,
        gallery as Record<string, unknown>,
      );
    }
  }

  if (idsByType.image?.length) {
    const images = await imageService.getImagesByIds(idsByType.image);
    for (const image of images) {
      entityMap.set(`image:${image.id}`, image as Record<string, unknown>);
    }
  }

  if (idsByType["audio-track"]?.length) {
    const tracks = await audioTrackService.getTracksByIds(
      idsByType["audio-track"],
    );
    for (const track of tracks) {
      entityMap.set(
        `audio-track:${track.id}`,
        track as Record<string, unknown>,
      );
    }
  }

  return entityMap;
}

// ─── Create ─────────────────────────────────────────────────────

export async function createCollection(dto: CollectionCreateDto) {
  const [row] = await db
    .insert(collections)
    .values({
      name: dto.name,
      description: dto.description ?? null,
      mode: dto.mode ?? "manual",
      ruleTree: dto.ruleTree ?? null,
      slideshowDurationSeconds: dto.slideshowDurationSeconds ?? 5,
      slideshowAutoAdvance: dto.slideshowAutoAdvance ?? true,
    })
    .returning();

  // If dynamic/hybrid with rules, evaluate immediately
  if (
    row.mode !== "manual" &&
    row.ruleTree
  ) {
    await refreshCollectionRules(row.id);
  }

  return getCollectionById(row.id);
}

// ─── Update ─────────────────────────────────────────────────────

export async function updateCollection(id: string, dto: CollectionPatchDto) {
  const existing = await getCollectionById(id);

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };

  if (dto.name !== undefined) updateFields.name = dto.name;
  if (dto.description !== undefined) updateFields.description = dto.description;
  if (dto.mode !== undefined) updateFields.mode = dto.mode;
  if (dto.ruleTree !== undefined) updateFields.ruleTree = dto.ruleTree;
  if (dto.coverMode !== undefined) updateFields.coverMode = dto.coverMode;
  if (dto.coverItemId !== undefined) updateFields.coverItemId = dto.coverItemId;
  if (dto.coverItemType !== undefined)
    updateFields.coverItemType = dto.coverItemType;
  if (dto.slideshowDurationSeconds !== undefined)
    updateFields.slideshowDurationSeconds = dto.slideshowDurationSeconds;
  if (dto.slideshowAutoAdvance !== undefined)
    updateFields.slideshowAutoAdvance = dto.slideshowAutoAdvance;

  await db
    .update(collections)
    .set(updateFields)
    .where(eq(collections.id, id));

  // If rules changed and mode is dynamic/hybrid, re-evaluate
  const newMode = dto.mode ?? existing.mode;
  if (dto.ruleTree !== undefined && newMode !== "manual") {
    await refreshCollectionRules(id);
  }

  return getCollectionById(id);
}

// ─── Delete ─────────────────────────────────────────────────────

export async function deleteCollection(id: string) {
  const [row] = await db
    .delete(collections)
    .where(eq(collections.id, id))
    .returning({ id: collections.id });

  if (!row) throw new AppError(404, "Collection not found");
  return { id: row.id };
}

// ─── Add Items (manual) ─────────────────────────────────────────

export async function addItems(collectionId: string, dto: CollectionAddItemsDto) {
  // Verify collection exists
  const [coll] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, collectionId));
  if (!coll) throw new AppError(404, "Collection not found");

  // Get current max sort order
  const [maxRow] = await db
    .select({ maxSort: sql<number>`coalesce(max(sort_order), -1)::int` })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId));

  let sortOrder = (maxRow?.maxSort ?? -1) + 1;

  for (const item of dto.items) {
    await db
      .insert(collectionItems)
      .values({
        collectionId,
        entityType: item.entityType,
        entityId: item.entityId,
        source: "manual",
        sortOrder: sortOrder++,
      })
      .onConflictDoNothing();
  }

  await updateItemCount(collectionId);
  return { added: dto.items.length };
}

// ─── Remove Items ───────────────────────────────────────────────

export async function removeItems(
  collectionId: string,
  dto: CollectionRemoveItemsDto,
) {
  if (dto.itemIds.length === 0) return { removed: 0 };

  await db
    .delete(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        inArray(collectionItems.id, dto.itemIds),
      ),
    );

  await updateItemCount(collectionId);
  return { removed: dto.itemIds.length };
}

// ─── Reorder Items ──────────────────────────────────────────────

export async function reorderItems(
  collectionId: string,
  dto: CollectionReorderDto,
) {
  // Update sort_order for each item based on position in array
  for (let i = 0; i < dto.itemIds.length; i++) {
    await db
      .update(collectionItems)
      .set({ sortOrder: i })
      .where(
        and(
          eq(collectionItems.id, dto.itemIds[i]),
          eq(collectionItems.collectionId, collectionId),
        ),
      );
  }

  return { reordered: dto.itemIds.length };
}

// ─── Refresh (dynamic rules) ────────────────────────────────────

export async function refreshCollectionRules(collectionId: string) {
  const [coll] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId));

  if (!coll) throw new AppError(404, "Collection not found");
  if (coll.mode === "manual") return { refreshed: false, reason: "manual" };
  if (!coll.ruleTree) return { refreshed: false, reason: "no-rules" };

  const ruleTree = coll.ruleTree as CollectionRuleGroup;
  const resolvedItems = await evaluateRuleTree(ruleTree);

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
    // (manual items that also match rules are preserved)
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

  return {
    refreshed: true,
    itemCount: resolvedItems.length,
  };
}

// ─── Preview Rules ──────────────────────────────────────────────

export async function previewRules(ruleTree: CollectionRuleGroup) {
  const preview = await previewRuleTree(ruleTree, 20);

  // Load entity data for sample items
  const fakeRows = preview.items.map((item, idx) => ({
    id: `preview-${idx}`,
    collectionId: "preview",
    entityType: item.entityType,
    entityId: item.entityId,
    source: "dynamic" as const,
    sortOrder: idx,
    addedAt: new Date(),
  }));

  const entityMap = await loadEntitiesForItems(fakeRows);

  const sample = preview.items.map((item, idx) => ({
    id: `preview-${idx}`,
    collectionId: "preview",
    entityType: item.entityType,
    entityId: item.entityId,
    source: "dynamic" as CollectionItemSource,
    sortOrder: idx,
    addedAt: new Date().toISOString(),
    entity: entityMap.get(`${item.entityType}:${item.entityId}`) ?? null,
  }));

  return {
    total: preview.total,
    byType: preview.byType,
    sample,
  };
}

// ─── Refresh all dynamic collections ────────────────────────────

export async function refreshAllDynamicCollections() {
  const dynamicCollections = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      sql`${collections.mode} IN ('dynamic', 'hybrid') AND ${collections.ruleTree} IS NOT NULL`,
    );

  const results = [];
  for (const coll of dynamicCollections) {
    try {
      const result = await refreshCollectionRules(coll.id);
      results.push({ id: coll.id, ...result });
    } catch (err) {
      results.push({
        id: coll.id,
        refreshed: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return results;
}
