/**
 * Shared query helpers that eliminate duplicated filtering, sorting,
 * and pagination logic across route handlers.
 */
import {
  asc,
  desc,
  eq,
  and,
  or,
  gte,
  lte,
  isNotNull,
  inArray,
  ilike,
  sql,
  type SQL,
  type Column,
} from "drizzle-orm";
import type { PgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";
import { db, schema } from "../db";

const { tags, performers } = schema;

// ─── Sorting ────────────────────────────────────────────────────

export interface SortConfig {
  /** Map of sort keys to Drizzle columns. Use `as SortConfig["columns"]` on the literal to avoid narrow PgColumn inference. */
  columns: Record<string, Column>;
  defaultDirs: Record<string, "asc" | "desc">;
  fallbackColumn: Column;
}

/**
 * Build a Drizzle orderBy clause from query params and a sort config.
 * Replaces the 3x duplicated sortColumnMap + defaultDir pattern.
 */
export function buildOrderBy(
  config: SortConfig,
  sortKey: string | undefined,
  orderParam: string | undefined,
) {
  const key = sortKey ?? "recent";
  const col = config.columns[key] ?? config.fallbackColumn;
  const dir =
    orderParam === "asc" || orderParam === "desc"
      ? orderParam
      : (config.defaultDirs[key] ?? "desc");
  return dir === "asc" ? asc(col) : desc(col);
}

// ─── Relation Filtering ─────────────────────────────────────────

/**
 * Normalize a query parameter that may be a string or string array
 * (Fastify repeats the same key for multi-value query params).
 */
export function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Resolve tag names to matching entity IDs via a join table.
 * Returns the list of entity IDs, or null if no matches (caller should
 * return empty results). Returns undefined when no tag filter is active.
 *
 * Usage: resolveTagIds(tagNames, sceneTags, sceneTags.sceneId, sceneTags.tagId)
 */
export async function resolveTagIds(
  tagNames: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  joinTable: PgTableWithColumns<any>,
  entityIdColumn: PgColumn,
  tagIdColumn: PgColumn,
): Promise<string[] | null | undefined> {
  if (tagNames.length === 0) return undefined;

  const tagRows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.name, tagNames));

  const tagIds = tagRows.map((t) => t.id);
  if (tagIds.length === 0) return null;

  const taggedRows = await db
    .selectDistinct({ entityId: entityIdColumn })
    .from(joinTable)
    .where(inArray(tagIdColumn, tagIds));

  const ids = taggedRows.map((r) => r.entityId as string);
  return ids.length > 0 ? ids : null;
}

/**
 * Resolve performer names to matching entity IDs via a join table.
 * Returns the list of entity IDs, or null if no matches.
 * Returns undefined when no performer filter is active.
 *
 * Usage: resolvePerformerIds(perfNames, scenePerformers, scenePerformers.sceneId, scenePerformers.performerId)
 */
export async function resolvePerformerIds(
  performerNames: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  joinTable: PgTableWithColumns<any>,
  entityIdColumn: PgColumn,
  performerIdColumn: PgColumn,
): Promise<string[] | null | undefined> {
  if (performerNames.length === 0) return undefined;

  const perfRows = await db
    .select({ id: performers.id })
    .from(performers)
    .where(inArray(performers.name, performerNames));

  const perfIds = perfRows.map((p) => p.id);
  if (perfIds.length === 0) return null;

  const joinedRows = await db
    .selectDistinct({ entityId: entityIdColumn })
    .from(joinTable)
    .where(inArray(performerIdColumn, perfIds));

  const ids = joinedRows.map((r) => r.entityId as string);
  return ids.length > 0 ? ids : null;
}

// ─── Common Filter Conditions ───────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Build rating filter conditions (min/max, 1-5 scale).
 */
export function buildRatingConditions(
  ratingCol: Column,
  ratingMin: string | undefined,
  ratingMax: string | undefined,
): SQL[] {
  const conditions: SQL[] = [];

  const min = ratingMin !== undefined ? Number(ratingMin) : NaN;
  if (Number.isInteger(min) && min >= 1 && min <= 5) {
    conditions.push(and(isNotNull(ratingCol), gte(ratingCol, min))!);
  }

  const max = ratingMax !== undefined ? Number(ratingMax) : NaN;
  if (Number.isInteger(max) && max >= 1 && max <= 5) {
    conditions.push(and(isNotNull(ratingCol), lte(ratingCol, max))!);
  }

  return conditions;
}

/**
 * Build date range filter conditions.
 */
export function buildDateConditions(
  dateCol: Column,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): SQL[] {
  const conditions: SQL[] = [];

  if (dateFrom && ISO_DATE_RE.test(dateFrom)) {
    conditions.push(and(isNotNull(dateCol), gte(dateCol, dateFrom))!);
  }
  if (dateTo && ISO_DATE_RE.test(dateTo)) {
    conditions.push(and(isNotNull(dateCol), lte(dateCol, dateTo))!);
  }

  return conditions;
}

/**
 * Build a boolean filter condition from a "true"/"false" string param.
 */
export function buildBooleanCondition(
  col: Column,
  value: string | undefined,
): SQL | undefined {
  if (value === "true") return eq(col, true);
  if (value === "false") return eq(col, false);
  return undefined;
}

/**
 * Build resolution filter conditions from height ranges.
 */
export const RESOLUTION_MAP: Record<string, [number, number]> = {
  "4K": [2160, 99999],
  "1080p": [1080, 2159],
  "720p": [720, 1079],
  "480p": [0, 719],
};

export function buildResolutionConditions(
  heightCol: Column,
  resolutions: string[],
): SQL | undefined {
  const resConditions = resolutions
    .map((r) => RESOLUTION_MAP[r])
    .filter(Boolean)
    .map((range) => and(gte(heightCol, range[0]), lte(heightCol, range[1]))!);

  if (resConditions.length === 0) return undefined;
  if (resConditions.length === 1) return resConditions[0];
  return or(...resConditions)!;
}

// ─── Pagination Helpers ─────────────────────────────────────────

/** Max rows per request for `/scenes` and `/performers` list (grid pages use small limits; bulk identify may page up to this). */
export const MAX_ENTITY_LIST_LIMIT = 50_000;

/**
 * Parse and clamp limit/offset from raw query strings.
 */
export function parsePagination(
  limitStr: string | undefined,
  offsetStr: string | undefined,
  defaultLimit = 50,
  maxLimit = 100,
): { limit: number; offset: number } {
  return {
    limit: Math.min(Number(limitStr) || defaultLimit, maxLimit),
    offset: Number(offsetStr) || 0,
  };
}
