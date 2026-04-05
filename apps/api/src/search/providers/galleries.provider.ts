import { db, schema } from "../../db";
import { ilike, or, sql, and, gte, lte, count, eq, exists } from "drizzle-orm";
import type { SearchProvider, SearchProviderQuery, SearchProviderResult } from "../types";

const { galleries, galleryTags, tags } = schema;

export const galleriesSearchProvider: SearchProvider = {
  kind: "gallery",
  label: "Galleries",
  defaultPreviewLimit: 3,

  async query({ q, limit, offset, filters }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;

    const matchCondition = or(
      ilike(galleries.title, term),
      ilike(galleries.details, term),
      exists(
        db.select({ x: sql`1` }).from(galleryTags)
          .innerJoin(tags, eq(tags.id, galleryTags.tagId))
          .where(and(eq(galleryTags.galleryId, galleries.id), ilike(tags.name, term)))
      ),
    )!;

    const conditions = [matchCondition];
    if (filters.rating) conditions.push(gte(galleries.rating, filters.rating));
    if (filters.dateFrom) conditions.push(gte(galleries.date, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(galleries.date, filters.dateTo));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${galleries.title}) = lower(${q}) THEN 100
      WHEN lower(${galleries.title}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${galleries.title}) LIKE '%' || lower(${q}) || '%' THEN 60
      ELSE 40
    END`;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: galleries.id,
        title: galleries.title,
        coverImageId: galleries.coverImageId,
        imageCount: galleries.imageCount,
        rating: galleries.rating,
        galleryType: galleries.galleryType,
        score: scoreExpr,
      })
        .from(galleries)
        .where(where)
        .orderBy(sql`${scoreExpr} DESC`, sql`${galleries.createdAt} DESC`)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(galleries).where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        kind: "gallery" as const,
        title: r.title,
        subtitle: `${r.imageCount} images`,
        imagePath: r.coverImageId ? `/assets/galleries/${r.id}/cover` : null,
        href: `/galleries/${r.id}`,
        rating: r.rating,
        score: r.score,
        meta: { imageCount: r.imageCount, galleryType: r.galleryType },
      })),
    };
  },
};
