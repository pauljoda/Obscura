/**
 * Collection Rule Engine
 *
 * Translates a CollectionRuleGroup tree into per-entity-type SQL queries,
 * evaluates them, and returns the matching entity references.
 */
import {
  eq,
  ne,
  and,
  or,
  not,
  gte,
  lte,
  gt,
  lt,
  ilike,
  inArray,
  isNull,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db, schema } from "../db";
import {
  RESOLUTION_MAP,
} from "../lib/query-helpers";
import type {
  CollectionEntityType,
  CollectionRuleGroup,
  CollectionRuleCondition,
  CollectionRuleNode,
  CollectionOperator,
  CollectionConditionValue,
} from "@obscura/contracts";

const {
  scenes,
  galleries,
  images,
  audioTracks,
  sceneTags,
  scenePerformers,
  galleryTags,
  galleryPerformers,
  imageTags,
  imagePerformers,
  audioTrackTags,
  audioTrackPerformers,
  tags,
  performers,
  studios,
} = schema;

// ─── Entity table metadata ────────────────────────────────────────

interface EntityTableMeta {
  table: typeof scenes | typeof galleries | typeof images | typeof audioTracks;
  idCol: PgColumn;
  columns: Record<string, PgColumn>;
  tagJoin: { table: any; entityIdCol: PgColumn; tagIdCol: PgColumn };
  performerJoin: { table: any; entityIdCol: PgColumn; performerIdCol: PgColumn };
  studioIdCol: PgColumn | null;
}

const ENTITY_META: Record<CollectionEntityType, EntityTableMeta> = {
  scene: {
    table: scenes,
    idCol: scenes.id,
    columns: {
      title: scenes.title,
      rating: scenes.rating,
      date: scenes.date,
      organized: scenes.organized,
      isNsfw: scenes.isNsfw,
      createdAt: scenes.createdAt,
      fileSize: scenes.fileSize,
      duration: scenes.duration,
      height: scenes.height,
      codec: scenes.codec,
      interactive: scenes.interactive,
      playCount: scenes.playCount,
      sceneFolderId: scenes.sceneFolderId,
    },
    tagJoin: { table: sceneTags, entityIdCol: sceneTags.sceneId, tagIdCol: sceneTags.tagId },
    performerJoin: { table: scenePerformers, entityIdCol: scenePerformers.sceneId, performerIdCol: scenePerformers.performerId },
    studioIdCol: scenes.studioId,
  },
  gallery: {
    table: galleries,
    idCol: galleries.id,
    columns: {
      title: galleries.title,
      rating: galleries.rating,
      date: galleries.date,
      organized: galleries.organized,
      isNsfw: galleries.isNsfw,
      createdAt: galleries.createdAt,
      galleryType: galleries.galleryType,
      imageCount: galleries.imageCount,
    },
    tagJoin: { table: galleryTags, entityIdCol: galleryTags.galleryId, tagIdCol: galleryTags.tagId },
    performerJoin: { table: galleryPerformers, entityIdCol: galleryPerformers.galleryId, performerIdCol: galleryPerformers.performerId },
    studioIdCol: galleries.studioId,
  },
  image: {
    table: images,
    idCol: images.id,
    columns: {
      title: images.title,
      rating: images.rating,
      date: images.date,
      organized: images.organized,
      isNsfw: images.isNsfw,
      createdAt: images.createdAt,
      fileSize: images.fileSize,
      width: images.width,
      height: images.height,
      format: images.format,
    },
    tagJoin: { table: imageTags, entityIdCol: imageTags.imageId, tagIdCol: imageTags.tagId },
    performerJoin: { table: imagePerformers, entityIdCol: imagePerformers.imageId, performerIdCol: imagePerformers.performerId },
    studioIdCol: images.studioId,
  },
  "audio-track": {
    table: audioTracks,
    idCol: audioTracks.id,
    columns: {
      title: audioTracks.title,
      rating: audioTracks.rating,
      date: audioTracks.date,
      organized: audioTracks.organized,
      isNsfw: audioTracks.isNsfw,
      createdAt: audioTracks.createdAt,
      fileSize: audioTracks.fileSize,
      duration: audioTracks.duration,
      bitRate: audioTracks.bitRate,
      channels: audioTracks.channels,
      codec: audioTracks.codec,
      playCount: audioTracks.playCount,
    },
    tagJoin: { table: audioTrackTags, entityIdCol: audioTrackTags.trackId, tagIdCol: audioTrackTags.tagId },
    performerJoin: { table: audioTrackPerformers, entityIdCol: audioTrackPerformers.trackId, performerIdCol: audioTrackPerformers.performerId },
    studioIdCol: audioTracks.studioId,
  },
};

// ─── Name → ID resolution caches ─────────────────────────────────

async function resolveTagNameIds(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.name, names));
  return rows.map((r) => r.id);
}

async function resolvePerformerNameIds(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await db
    .select({ id: performers.id })
    .from(performers)
    .where(inArray(performers.name, names));
  return rows.map((r) => r.id);
}

async function resolveStudioNameIds(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await db
    .select({ id: studios.id })
    .from(studios)
    .where(inArray(studios.name, names));
  return rows.map((r) => r.id);
}

// ─── Condition → SQL translation ─────────────────────────────────

function conditionAppliesToEntity(
  condition: CollectionRuleCondition,
  entityType: CollectionEntityType,
): boolean {
  // Empty entityTypes array means applies to all types
  if (condition.entityTypes.length === 0) return true;
  return condition.entityTypes.includes(entityType);
}

async function translateCondition(
  condition: CollectionRuleCondition,
  entityType: CollectionEntityType,
  meta: EntityTableMeta,
): Promise<SQL | null> {
  if (!conditionAppliesToEntity(condition, entityType)) return null;

  const { field, operator, value } = condition;

  // Handle relation-based fields specially
  if (field === "tags") {
    return translateRelationCondition(
      operator,
      value,
      meta.tagJoin,
      resolveTagNameIds,
    );
  }

  if (field === "performers") {
    return translateRelationCondition(
      operator,
      value,
      meta.performerJoin,
      resolvePerformerNameIds,
    );
  }

  if (field === "studio") {
    if (operator === "is_null") return isNull(meta.studioIdCol!);
    if (operator === "is_not_null") return isNotNull(meta.studioIdCol!);
    const names = Array.isArray(value) ? value as string[] : [value as string];
    const ids = await resolveStudioNameIds(names);
    if (ids.length === 0) return sql`false`;
    if (operator === "in") return inArray(meta.studioIdCol!, ids);
    if (operator === "not_in") return not(inArray(meta.studioIdCol!, ids));
    return null;
  }

  if (field === "sceneFolderId") {
    const col = meta.columns.sceneFolderId;
    if (!col) return null;
    if (operator === "equals") return eq(col, value as string);
    if (operator === "in") return inArray(col, value as string[]);
    if (operator === "not_in") return not(inArray(col, value as string[]));
    return null;
  }

  // Handle resolution as special enum mapped to height ranges
  if (field === "resolution") {
    const heightCol = meta.columns.height;
    if (!heightCol) return null;
    const values = Array.isArray(value) ? value as string[] : [value as string];
    const resConditions = values
      .map((r) => RESOLUTION_MAP[r])
      .filter(Boolean)
      .map((range) => and(gte(heightCol, range[0]), lte(heightCol, range[1]))!);
    if (resConditions.length === 0) return sql`false`;
    if (operator === "in") return or(...resConditions)!;
    if (operator === "not_in") return not(or(...resConditions)!);
    return null;
  }

  // Standard column-based conditions
  const col = meta.columns[field];
  if (!col) return null;

  return translateScalarCondition(col, operator, value);
}

function translateScalarCondition(
  col: PgColumn,
  operator: CollectionOperator,
  value: CollectionConditionValue,
): SQL | null {
  switch (operator) {
    case "equals":
      return eq(col, value as string | number);
    case "not_equals":
      return ne(col, value as string | number);
    case "contains":
      return ilike(col, `%${value}%`);
    case "not_contains":
      return not(ilike(col, `%${value}%`));
    case "greater_than":
      return gt(col, value as number);
    case "less_than":
      return lt(col, value as number);
    case "greater_equal":
      return gte(col, value as number);
    case "less_equal":
      return lte(col, value as number);
    case "between": {
      const [min, max] = value as [number, number];
      return and(gte(col, min), lte(col, max))!;
    }
    case "in":
      return inArray(col, value as string[]);
    case "not_in":
      return not(inArray(col, value as string[]));
    case "is_null":
      return isNull(col);
    case "is_not_null":
      return isNotNull(col);
    case "is_true":
      return eq(col, true);
    case "is_false":
      return eq(col, false);
    default:
      return null;
  }
}

async function translateRelationCondition(
  operator: CollectionOperator,
  value: CollectionConditionValue,
  joinMeta: { table: any; entityIdCol: PgColumn; tagIdCol?: PgColumn; performerIdCol?: PgColumn },
  resolveNames: (names: string[]) => Promise<string[]>,
): Promise<SQL | null> {
  const names = Array.isArray(value) ? value as string[] : [value as string];
  const ids = await resolveNames(names);
  if (ids.length === 0) return sql`false`;

  const relIdCol = joinMeta.tagIdCol ?? joinMeta.performerIdCol!;

  // Subquery: select entity IDs that have any of the given relation IDs
  const matchingEntityIds = db
    .selectDistinct({ id: joinMeta.entityIdCol })
    .from(joinMeta.table)
    .where(inArray(relIdCol, ids));

  if (operator === "in") {
    return inArray(joinMeta.entityIdCol, matchingEntityIds);
  }
  if (operator === "not_in") {
    return not(inArray(joinMeta.entityIdCol, matchingEntityIds));
  }
  return null;
}

// ─── Rule tree → SQL ─────────────────────────────────────────────

async function translateNode(
  node: CollectionRuleNode,
  entityType: CollectionEntityType,
  meta: EntityTableMeta,
): Promise<SQL | null> {
  if (node.type === "condition") {
    return translateCondition(node, entityType, meta);
  }

  // Group node
  const group = node as CollectionRuleGroup;
  const childSqlPromises = group.children.map((child) =>
    translateNode(child, entityType, meta),
  );
  const childSqls = (await Promise.all(childSqlPromises)).filter(
    (s): s is SQL => s !== null,
  );

  if (childSqls.length === 0) return null;

  switch (group.operator) {
    case "and":
      return childSqls.length === 1 ? childSqls[0] : and(...childSqls)!;
    case "or":
      return childSqls.length === 1 ? childSqls[0] : or(...childSqls)!;
    case "not":
      // NOT applies to the conjunction of all children
      return childSqls.length === 1
        ? not(childSqls[0])
        : not(and(...childSqls)!);
    default:
      return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────

export interface ResolvedItem {
  entityType: CollectionEntityType;
  entityId: string;
}

/**
 * Evaluate a rule tree and return all matching entity references.
 */
export async function evaluateRuleTree(
  ruleTree: CollectionRuleGroup,
): Promise<ResolvedItem[]> {
  const allItems: ResolvedItem[] = [];
  const entityTypes: CollectionEntityType[] = [
    "scene",
    "gallery",
    "image",
    "audio-track",
  ];

  for (const entityType of entityTypes) {
    const meta = ENTITY_META[entityType];
    const whereSql = await translateNode(ruleTree, entityType, meta);

    // If no conditions apply to this entity type, skip it
    if (!whereSql) continue;

    const rows = await db
      .select({ id: meta.idCol })
      .from(meta.table)
      .where(whereSql);

    for (const row of rows) {
      allItems.push({ entityType, entityId: row.id });
    }
  }

  return allItems;
}

/**
 * Evaluate a rule tree and return a preview with counts and sample items.
 */
export async function previewRuleTree(
  ruleTree: CollectionRuleGroup,
  sampleLimit = 20,
): Promise<{
  total: number;
  byType: Record<CollectionEntityType, number>;
  items: ResolvedItem[];
}> {
  const byType: Record<CollectionEntityType, number> = {
    scene: 0,
    gallery: 0,
    image: 0,
    "audio-track": 0,
  };

  const entityTypes: CollectionEntityType[] = [
    "scene",
    "gallery",
    "image",
    "audio-track",
  ];

  const sampleItems: ResolvedItem[] = [];
  let total = 0;

  for (const entityType of entityTypes) {
    const meta = ENTITY_META[entityType];
    const whereSql = await translateNode(ruleTree, entityType, meta);

    if (!whereSql) continue;

    // Count
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(meta.table)
      .where(whereSql);

    const count = countRow?.count ?? 0;
    byType[entityType] = count;
    total += count;

    // Sample (take a proportional share of the sample limit)
    if (count > 0 && sampleItems.length < sampleLimit) {
      const remaining = sampleLimit - sampleItems.length;
      const rows = await db
        .select({ id: meta.idCol })
        .from(meta.table)
        .where(whereSql)
        .limit(remaining);

      for (const row of rows) {
        sampleItems.push({ entityType, entityId: row.id });
      }
    }
  }

  return { total, byType, items: sampleItems };
}
