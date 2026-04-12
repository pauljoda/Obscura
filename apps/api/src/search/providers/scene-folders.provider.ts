import { db, schema } from "../../db";
import { ilike, or, and, count, ne, desc, sql } from "drizzle-orm";
import type {
  SearchProvider,
  SearchProviderQuery,
  SearchProviderResult,
} from "../types";

const { sceneFolders } = schema;

export const sceneFoldersSearchProvider: SearchProvider = {
  kind: "scene-folder",
  label: "Folders",
  defaultPreviewLimit: 2,

  async query({
    q,
    limit,
    offset,
    filters,
  }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;
    const sfwOnly = filters.nsfw === "off";

    const matchCondition = or(
      ilike(sceneFolders.title, term),
      ilike(sceneFolders.customName, term),
      ilike(sceneFolders.details, term),
    )!;

    const conditions = [matchCondition];
    if (sfwOnly) conditions.push(ne(sceneFolders.isNsfw, true));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${sceneFolders.title}) = lower(${q}) THEN 100
      WHEN lower(${sceneFolders.customName}) = lower(${q}) THEN 100
      WHEN lower(${sceneFolders.title}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${sceneFolders.customName}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${sceneFolders.title}) LIKE '%' || lower(${q}) || '%' THEN 60
      WHEN lower(${sceneFolders.customName}) LIKE '%' || lower(${q}) || '%' THEN 60
      WHEN ${sceneFolders.details} IS NOT NULL AND lower(${sceneFolders.details}) LIKE '%' || lower(${q}) || '%' THEN 40
      ELSE 30
    END`;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: sceneFolders.id,
          title: sceneFolders.title,
          customName: sceneFolders.customName,
          coverImagePath: sceneFolders.coverImagePath,
          rating: sceneFolders.rating,
          totalSceneCount: sceneFolders.totalSceneCount,
          score: scoreExpr,
        })
        .from(sceneFolders)
        .where(where)
        .orderBy(desc(scoreExpr), desc(sceneFolders.totalSceneCount))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(sceneFolders).where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        kind: "scene-folder" as const,
        title: r.customName ?? r.title,
        subtitle:
          r.totalSceneCount > 0
            ? `${r.totalSceneCount} scene${r.totalSceneCount !== 1 ? "s" : ""}`
            : null,
        imagePath: r.coverImagePath ?? null,
        href: `/scenes?folder=${r.id}`,
        rating: r.rating,
        score: r.score,
        meta: { sceneCount: r.totalSceneCount },
      })),
    };
  },
};
