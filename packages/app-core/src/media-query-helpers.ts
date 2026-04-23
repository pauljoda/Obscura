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
  type SQL,
  type Column,
} from "drizzle-orm";
import type { PgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";
import { schema, type AppDb } from "@obscura/db";

const { tags, performers } = schema;

export interface SortConfig {
  columns: Record<string, Column>;
  defaultDirs: Record<string, "asc" | "desc">;
  fallbackColumn: Column;
}

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

export function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function resolveTagIds(
  db: AppDb,
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

export async function resolvePerformerIds(
  db: AppDb,
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

export function buildBooleanCondition(
  col: Column,
  value: string | undefined,
): SQL | undefined {
  if (value === "true") return eq(col, true);
  if (value === "false") return eq(col, false);
  return undefined;
}

export const RESOLUTION_MAP: Record<string, [number, number]> = {
  "4K": [2160, 99_999],
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

export function parsePagination(
  limitStr: string | undefined,
  offsetStr: string | undefined,
  defaultLimit = 50,
  maxLimit = 100,
) {
  return {
    limit: Math.min(Number(limitStr) || defaultLimit, maxLimit),
    offset: Number(offsetStr) || 0,
  };
}

export const MAX_ENTITY_LIST_LIMIT = 50_000;
