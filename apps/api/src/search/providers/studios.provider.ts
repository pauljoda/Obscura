import { db, schema } from "../../db";
import { ilike, or, sql, and, gte, count, ne } from "drizzle-orm";
import type { SearchProvider, SearchProviderQuery, SearchProviderResult } from "../types";

const { studios } = schema;

export const studiosSearchProvider: SearchProvider = {
  kind: "studio",
  label: "Studios",
  defaultPreviewLimit: 3,

  async query({ q, limit, offset, filters }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;

    const matchCondition = or(
      ilike(studios.name, term),
      ilike(studios.aliases, term),
      ilike(studios.description, term),
    )!;

    const conditions = [matchCondition];
    if (filters.rating) conditions.push(gte(studios.rating, filters.rating));
    if (filters.nsfw === "off") conditions.push(ne(studios.isNsfw, true));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${studios.name}) = lower(${q}) THEN 100
      WHEN lower(${studios.name}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${studios.name}) LIKE '%' || lower(${q}) || '%' THEN 60
      WHEN ${studios.aliases} IS NOT NULL AND lower(${studios.aliases}) LIKE '%' || lower(${q}) || '%' THEN 50
      ELSE 30
    END`;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: studios.id,
        name: studios.name,
        imagePath: studios.imagePath,
        rating: studios.rating,
        sceneCount: studios.sceneCount,
        score: scoreExpr,
      })
        .from(studios)
        .where(where)
        .orderBy(sql`${scoreExpr} DESC`, sql`${studios.sceneCount} DESC`)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(studios).where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        kind: "studio" as const,
        title: r.name,
        subtitle: r.sceneCount > 0 ? `${r.sceneCount} scenes` : null,
        imagePath: r.imagePath ?? null,
        href: `/studios/${r.id}`,
        rating: r.rating,
        score: r.score,
        meta: { sceneCount: r.sceneCount },
      })),
    };
  },
};
