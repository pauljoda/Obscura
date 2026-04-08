import { db, schema } from "../../db";
import { ilike, or, sql, and, gte, count, ne } from "drizzle-orm";
import type { SearchProvider, SearchProviderQuery, SearchProviderResult } from "../types";

const { performers } = schema;

export const performersSearchProvider: SearchProvider = {
  kind: "performer",
  label: "Performers",
  defaultPreviewLimit: 3,

  async query({ q, limit, offset, filters }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;

    const matchCondition = or(
      ilike(performers.name, term),
      ilike(performers.aliases, term),
      ilike(performers.disambiguation, term),
    )!;

    const conditions = [matchCondition];
    if (filters.rating) conditions.push(gte(performers.rating, filters.rating));
    if (filters.nsfw === "off") conditions.push(ne(performers.isNsfw, true));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${performers.name}) = lower(${q}) THEN 100
      WHEN lower(${performers.name}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${performers.name}) LIKE '%' || lower(${q}) || '%' THEN 60
      WHEN ${performers.aliases} IS NOT NULL AND lower(${performers.aliases}) LIKE '%' || lower(${q}) || '%' THEN 50
      ELSE 30
    END`;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: performers.id,
        name: performers.name,
        disambiguation: performers.disambiguation,
        gender: performers.gender,
        imagePath: performers.imagePath,
        rating: performers.rating,
        sceneCount: performers.sceneCount,
        score: scoreExpr,
      })
        .from(performers)
        .where(where)
        .orderBy(sql`${scoreExpr} DESC`, sql`${performers.sceneCount} DESC`)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(performers).where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        kind: "performer" as const,
        title: r.name,
        subtitle: [r.gender, r.sceneCount > 0 ? `${r.sceneCount} scenes` : null]
          .filter(Boolean)
          .join(" · ") || null,
        imagePath: r.imagePath ?? null,
        href: `/performers/${r.id}`,
        rating: r.rating,
        score: r.score,
        meta: { gender: r.gender, sceneCount: r.sceneCount, disambiguation: r.disambiguation },
      })),
    };
  },
};
