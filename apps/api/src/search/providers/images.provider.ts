import { db, schema } from "../../db";
import { ilike, or, sql, and, gte, lte, count, eq, exists } from "drizzle-orm";
import type { SearchProvider, SearchProviderQuery, SearchProviderResult } from "../types";

const { images, galleries, imageTags, tags } = schema;

export const imagesSearchProvider: SearchProvider = {
  kind: "image",
  label: "Images",
  defaultPreviewLimit: 3,

  async query({ q, limit, offset, filters }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;

    const matchCondition = or(
      ilike(images.title, term),
      ilike(images.details, term),
      ilike(galleries.title, term),
      exists(
        db.select({ x: sql`1` }).from(imageTags)
          .innerJoin(tags, eq(tags.id, imageTags.tagId))
          .where(and(eq(imageTags.imageId, images.id), ilike(tags.name, term)))
      ),
    )!;

    const conditions = [matchCondition];
    if (filters.rating) conditions.push(gte(images.rating, filters.rating));
    if (filters.dateFrom) conditions.push(gte(images.date, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(images.date, filters.dateTo));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${images.title}) = lower(${q}) THEN 100
      WHEN lower(${images.title}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${images.title}) LIKE '%' || lower(${q}) || '%' THEN 60
      ELSE 40
    END`;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: images.id,
        title: images.title,
        thumbnailPath: images.thumbnailPath,
        galleryTitle: galleries.title,
        galleryId: images.galleryId,
        rating: images.rating,
        width: images.width,
        height: images.height,
        score: scoreExpr,
      })
        .from(images)
        .leftJoin(galleries, eq(images.galleryId, galleries.id))
        .where(where)
        .orderBy(sql`${scoreExpr} DESC`, sql`${images.createdAt} DESC`)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() })
        .from(images)
        .leftJoin(galleries, eq(images.galleryId, galleries.id))
        .where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        kind: "image" as const,
        title: r.title,
        subtitle: r.galleryTitle ?? null,
        imagePath: r.thumbnailPath ?? null,
        href: r.galleryId ? `/galleries/${r.galleryId}` : `/images/${r.id}`,
        rating: r.rating,
        score: r.score,
        meta: { width: r.width, height: r.height, galleryId: r.galleryId },
      })),
    };
  },
};
