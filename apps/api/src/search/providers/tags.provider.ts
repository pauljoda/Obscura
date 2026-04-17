import { db, schema } from "../../db";
import { ilike, or, sql, and, gte, count, ne } from "drizzle-orm";
import type { SearchProvider, SearchProviderQuery, SearchProviderResult } from "../types";
import {
  tagSfwSceneCountExpr,
  tagTotalSceneCountExpr,
} from "../../lib/appearance-count-expressions";

const { tags } = schema;

export const tagsSearchProvider: SearchProvider = {
  kind: "tag",
  label: "Tags",
  defaultPreviewLimit: 8,

  async query({ q, limit, offset, filters }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;

    const matchCondition = or(
      ilike(tags.name, term),
      ilike(tags.aliases, term),
      ilike(tags.description, term),
    )!;

    const conditions = [matchCondition];
    if (filters.rating) conditions.push(gte(tags.rating, filters.rating));
    if (filters.nsfw === "off") conditions.push(ne(tags.isNsfw, true));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${tags.name}) = lower(${q}) THEN 100
      WHEN lower(${tags.name}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${tags.name}) LIKE '%' || lower(${q}) || '%' THEN 60
      WHEN ${tags.aliases} IS NOT NULL AND lower(${tags.aliases}) LIKE '%' || lower(${q}) || '%' THEN 50
      ELSE 30
    END`;

    const sfwOnly = filters.nsfw === "off";
    const sceneCountExpr = sfwOnly
      ? tagSfwSceneCountExpr()
      : tagTotalSceneCountExpr();

    const [rows, countResult] = await Promise.all([
      db.select({
        id: tags.id,
        name: tags.name,
        imagePath: tags.imagePath,
        rating: tags.rating,
        videoCount: sceneCountExpr,
        score: scoreExpr,
      })
        .from(tags)
        .where(where)
        .orderBy(sql`${scoreExpr} DESC`, sql`${sceneCountExpr} DESC`)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(tags).where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        kind: "tag" as const,
        title: r.name,
        subtitle: Number(r.videoCount ?? 0) > 0 ? `${Number(r.videoCount)} videos` : null,
        imagePath: r.imagePath ?? null,
        href: `/tags/${encodeURIComponent(r.name)}`,
        rating: r.rating,
        score: r.score,
        meta: { videoCount: Number(r.videoCount ?? 0) },
      })),
    };
  },
};
