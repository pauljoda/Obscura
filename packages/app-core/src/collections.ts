import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import type {
  CollectionAddItemsDto,
  CollectionCreateDto,
  CollectionEntityType,
  CollectionItemListQuery,
  CollectionItemSource,
  CollectionListQuery,
  CollectionMode,
  CollectionPatchDto,
  CollectionRemoveItemsDto,
  CollectionReorderDto,
  CollectionRuleGroup,
} from "@obscura/contracts";
import type { AppDb } from "@obscura/db";
import { schema } from "@obscura/db";
import { getGeneratedCollectionDir } from "@obscura/media-core";
import {
  evaluateRuleTree,
  previewRuleTree,
} from "@obscura/db/src/lib/collection-rule-engine";
import { NotFoundError, ValidationError } from "./errors";
import { buildOrderBy, parsePagination, type SortConfig } from "./media-query-helpers";
import { getGalleriesByIdsRead, getImagesByIdsRead } from "./gallery-media";
import { getTracksByIdsRead } from "./audio-tracks";
import { getVideosByIdsRead } from "./video-collection-reads";

const { collections, collectionItems } = schema;
const COLLECTION_COVER_FILE = "cover-custom.jpg";

const collectionSortConfig: SortConfig = {
  columns: {
    recent: collections.createdAt,
    name: collections.name,
    updated: collections.updatedAt,
    items: collections.itemCount,
  },
  defaultDirs: {
    recent: "desc",
    name: "asc",
    updated: "desc",
    items: "desc",
  },
  fallbackColumn: collections.createdAt,
  randomColumn: collections.id,
};

async function computeTypeCounts(
  db: AppDb,
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

async function updateItemCount(db: AppDb, collectionId: string): Promise<number> {
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
    coverImagePath: row.coverImagePath ? `/assets/collections/${row.id}/cover` : null,
    slideshowDurationSeconds: row.slideshowDurationSeconds,
    slideshowAutoAdvance: row.slideshowAutoAdvance,
    isNsfw: row.isNsfw,
    typeCounts,
    lastRefreshedAt: row.lastRefreshedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCollectionsRead(db: AppDb, query: CollectionListQuery) {
  const { limit, offset } = parsePagination(
    query.limit?.toString(),
    query.offset?.toString(),
    50,
    200,
  );

  const conditions: SQL[] = [];
  if (query.search) conditions.push(ilike(collections.name, `%${query.search}%`));
  if (query.mode) conditions.push(eq(collections.mode, query.mode));
  if (query.nsfw === "off") conditions.push(ne(collections.isNsfw, true));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(collections)
      .where(whereClause)
      .orderBy(buildOrderBy(collectionSortConfig, query.sort, query.order, query.randomSeed))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(collections)
      .where(whereClause),
  ]);

  const items = await Promise.all(
    rows.map(async (row) => toCollectionListItem(row, await computeTypeCounts(db, row.id))),
  );

  return {
    items,
    total: totalRows[0]?.count ?? 0,
    limit,
    offset,
  };
}

export async function getCollectionDetailRead(db: AppDb, id: string) {
  const [row] = await db.select().from(collections).where(eq(collections.id, id));
  if (!row) throw new NotFoundError("Collection not found");

  const typeCounts = await computeTypeCounts(db, id);
  const base = toCollectionListItem(row, typeCounts);

  return {
    ...base,
    ruleTree: row.ruleTree as CollectionRuleGroup | null,
    coverItemId: row.coverItemId,
    coverItemType: row.coverItemType as CollectionEntityType | null,
  };
}

async function loadEntitiesForItems(
  db: AppDb,
  rows: (typeof collectionItems.$inferSelect)[],
) {
  const entityMap = new Map<string, Record<string, unknown>>();
  const idsByType: Record<string, string[]> = {};

  for (const row of rows) {
    idsByType[row.entityType] ??= [];
    idsByType[row.entityType].push(row.entityId);
  }

  if (idsByType.video?.length) {
    for (const video of await getVideosByIdsRead(db, idsByType.video)) {
      entityMap.set(`video:${video.id}`, video as Record<string, unknown>);
    }
  }
  if (idsByType.gallery?.length) {
    for (const gallery of await getGalleriesByIdsRead(db, idsByType.gallery)) {
      entityMap.set(`gallery:${gallery.id}`, gallery as Record<string, unknown>);
    }
  }
  if (idsByType.image?.length) {
    for (const image of await getImagesByIdsRead(db, idsByType.image)) {
      entityMap.set(`image:${image.id}`, image as Record<string, unknown>);
    }
  }
  if (idsByType["audio-track"]?.length) {
    for (const track of await getTracksByIdsRead(db, idsByType["audio-track"])) {
      entityMap.set(`audio-track:${track.id}`, track as Record<string, unknown>);
    }
  }

  return entityMap;
}

export async function getCollectionItemsRead(
  db: AppDb,
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
  if (query.entityType) conditions.push(eq(collectionItems.entityType, query.entityType));

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

  const entityMap = await loadEntitiesForItems(db, rows);
  const hideNsfw = query.nsfw === "off";
  const items = rows
    .map((row) => ({
      id: row.id,
      collectionId: row.collectionId,
      entityType: row.entityType as CollectionEntityType,
      entityId: row.entityId,
      source: row.source as CollectionItemSource,
      sortOrder: row.sortOrder,
      addedAt: row.addedAt.toISOString(),
      entity: entityMap.get(`${row.entityType}:${row.entityId}`) ?? null,
    }))
    .filter((item) => !hideNsfw || (item.entity as { isNsfw?: boolean } | null)?.isNsfw !== true);

  return {
    items,
    total: totalRows[0]?.count ?? 0,
    limit,
    offset,
  };
}

export async function createCollectionWrite(db: AppDb, dto: CollectionCreateDto) {
  const [row] = await db
    .insert(collections)
    .values({
      name: dto.name,
      description: dto.description ?? null,
      mode: dto.mode ?? "manual",
      ruleTree: dto.ruleTree ?? null,
      slideshowDurationSeconds: dto.slideshowDurationSeconds ?? 5,
      slideshowAutoAdvance: dto.slideshowAutoAdvance ?? true,
      isNsfw: dto.isNsfw ?? false,
    })
    .returning();

  if (row.mode !== "manual" && row.ruleTree) {
    await refreshCollectionRulesWrite(db, row.id);
  }

  return getCollectionDetailRead(db, row.id);
}

export async function updateCollectionWrite(
  db: AppDb,
  id: string,
  dto: CollectionPatchDto,
) {
  const existing = await getCollectionDetailRead(db, id);
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };

  if (dto.name !== undefined) updateFields.name = dto.name;
  if (dto.description !== undefined) updateFields.description = dto.description;
  if (dto.mode !== undefined) updateFields.mode = dto.mode;
  if (dto.ruleTree !== undefined) updateFields.ruleTree = dto.ruleTree;
  if (dto.coverMode !== undefined) updateFields.coverMode = dto.coverMode;
  if (dto.coverItemId !== undefined) updateFields.coverItemId = dto.coverItemId;
  if (dto.coverItemType !== undefined) updateFields.coverItemType = dto.coverItemType;
  if (dto.slideshowDurationSeconds !== undefined) {
    updateFields.slideshowDurationSeconds = dto.slideshowDurationSeconds;
  }
  if (dto.slideshowAutoAdvance !== undefined) {
    updateFields.slideshowAutoAdvance = dto.slideshowAutoAdvance;
  }
  if (dto.isNsfw !== undefined) updateFields.isNsfw = dto.isNsfw;

  await db.update(collections).set(updateFields).where(eq(collections.id, id));

  const newMode = dto.mode ?? existing.mode;
  if (dto.ruleTree !== undefined && newMode !== "manual") {
    await refreshCollectionRulesWrite(db, id);
  }

  return getCollectionDetailRead(db, id);
}

export async function deleteCollectionWrite(db: AppDb, id: string) {
  const [row] = await db
    .delete(collections)
    .where(eq(collections.id, id))
    .returning({ id: collections.id });
  if (!row) throw new NotFoundError("Collection not found");
  return { id: row.id };
}

export async function uploadCollectionCoverWrite(
  db: AppDb,
  id: string,
  buffer: Buffer,
) {
  if (!buffer.length) throw new ValidationError("Empty file");
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  if (!collection) throw new NotFoundError("Collection not found");

  const dir = getGeneratedCollectionDir(id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, COLLECTION_COVER_FILE), buffer);

  const coverImagePath = `/assets/collections/${id}/cover`;
  await db
    .update(collections)
    .set({
      coverMode: "custom",
      coverImagePath,
      coverItemId: null,
      coverItemType: null,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, id));

  return { ok: true as const, coverImagePath };
}

export async function deleteCollectionCoverWrite(db: AppDb, id: string) {
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  if (!collection) throw new NotFoundError("Collection not found");

  const filePath = path.join(getGeneratedCollectionDir(id), COLLECTION_COVER_FILE);
  try {
    if (existsSync(filePath)) await unlink(filePath);
  } catch {
    /* non-fatal */
  }

  await db
    .update(collections)
    .set({
      coverMode: "mosaic",
      coverImagePath: null,
      coverItemId: null,
      coverItemType: null,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, id));

  return { ok: true as const };
}

export async function addCollectionItemsWrite(
  db: AppDb,
  collectionId: string,
  dto: CollectionAddItemsDto,
) {
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, collectionId));
  if (!collection) throw new NotFoundError("Collection not found");

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

  await updateItemCount(db, collectionId);
  return { added: dto.items.length };
}

export async function removeCollectionItemsWrite(
  db: AppDb,
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

  await updateItemCount(db, collectionId);
  return { removed: dto.itemIds.length };
}

export async function reorderCollectionItemsWrite(
  db: AppDb,
  collectionId: string,
  dto: CollectionReorderDto,
) {
  for (let index = 0; index < dto.itemIds.length; index += 1) {
    await db
      .update(collectionItems)
      .set({ sortOrder: index })
      .where(
        and(
          eq(collectionItems.id, dto.itemIds[index]),
          eq(collectionItems.collectionId, collectionId),
        ),
      );
  }

  return { reordered: dto.itemIds.length };
}

export async function refreshCollectionRulesWrite(db: AppDb, collectionId: string) {
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId));
  if (!collection) throw new NotFoundError("Collection not found");
  if (collection.mode === "manual") return { refreshed: false, reason: "manual" };
  if (!collection.ruleTree) return { refreshed: false, reason: "no-rules" };

  const resolvedItems = await evaluateRuleTree(db, collection.ruleTree as CollectionRuleGroup);
  await db.transaction(async (tx) => {
    await tx
      .delete(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.source, "dynamic"),
        ),
      );

    const [maxRow] = await tx
      .select({ maxSort: sql<number>`coalesce(max(sort_order), -1)::int` })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));

    let sortOrder = (maxRow?.maxSort ?? -1) + 1;
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

  return { refreshed: true, itemCount: resolvedItems.length };
}

export async function previewCollectionRulesRead(
  db: AppDb,
  ruleTree: CollectionRuleGroup,
  options: { nsfw?: "on" | "off" } = {},
) {
  const preview = await previewRuleTree(db, ruleTree, 20);
  const previewRows = preview.items.map((item, index) => ({
    id: `preview-${index}`,
    collectionId: "preview",
    entityType: item.entityType,
    entityId: item.entityId,
    source: "dynamic" as const,
    sortOrder: index,
    addedAt: new Date(),
  }));
  const entityMap = await loadEntitiesForItems(db, previewRows);
  const hideNsfw = options.nsfw === "off";

  const sample = preview.items
    .map((item, index) => ({
      id: `preview-${index}`,
      collectionId: "preview",
      entityType: item.entityType,
      entityId: item.entityId,
      source: "dynamic" as CollectionItemSource,
      sortOrder: index,
      addedAt: new Date().toISOString(),
      entity: entityMap.get(`${item.entityType}:${item.entityId}`) ?? null,
    }))
    .filter((s) => !hideNsfw || (s.entity as { isNsfw?: boolean } | null)?.isNsfw !== true);

  return {
    total: preview.total,
    byType: preview.byType,
    sample,
  };
}
