import { eq, sql, type SQL, type Column } from "drizzle-orm";
import type { HierarchyScopeQuery } from "./types";

export function buildHierarchyScopeConditions(
  parentColumn: Column,
  query: HierarchyScopeQuery,
): SQL[] {
  if (query.parent) {
    return [eq(parentColumn, query.parent)];
  }

  if (query.root !== "all" && !query.search) {
    return [sql`${parentColumn} IS NULL`];
  }

  return [];
}
