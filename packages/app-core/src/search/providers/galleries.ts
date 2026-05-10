import { schema, type AppDb } from "@obscura/db";
import {
  ilike,
  or,
  sql,
  and,
  gte,
  lte,
  count,
  eq,
  exists,
  inArray,
  asc,
  ne,
} from "drizzle-orm";
import { galleryVisibleSql, imageVisibleSql } from "../../library-root-visibility";
import {
  isComicGalleryRow,
  isComicSeriesGalleryRow,
} from "../../gallery-comics";
import type {
  SearchProvider,
  SearchProviderFactory,
  SearchProviderQuery,
  SearchProviderResult,
} from "../types";

const { galleries, galleryTags, tags, images } = schema;

function largestImageAspectRatio(
  items: Array<{ width: number | null; height: number | null }>,
): number | null {
  const candidate = items
    .filter((item) => item.width != null && item.height != null && item.height > 0)
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
  return candidate?.width && candidate.height ? candidate.width / candidate.height : null;
}

export const createGalleriesSearchProvider: SearchProviderFactory = (
  db: AppDb,
): SearchProvider => ({
  kind: "gallery",
  label: "Galleries",
  defaultPreviewLimit: 3,

  async query({
    q,
    limit,
    offset,
    filters,
  }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;

    const matchCondition = or(
      ilike(galleries.title, term),
      ilike(galleries.details, term),
      exists(
        db
          .select({ x: sql`1` })
          .from(galleryTags)
          .innerJoin(tags, eq(tags.id, galleryTags.tagId))
          .where(
            and(
              eq(galleryTags.galleryId, galleries.id),
              ilike(tags.name, term),
            ),
          ),
      ),
    )!;

    const conditions = [matchCondition, galleryVisibleSql(galleries.folderPath, galleries.zipFilePath)];
    if (filters.rating) conditions.push(gte(galleries.rating, filters.rating));
    if (filters.dateFrom)
      conditions.push(gte(galleries.date, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(galleries.date, filters.dateTo));
    if (filters.nsfw === "off") conditions.push(ne(galleries.isNsfw, true));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${galleries.title}) = lower(${q}) THEN 100
      WHEN lower(${galleries.title}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${galleries.title}) LIKE '%' || lower(${q}) || '%' THEN 60
      ELSE 40
    END`;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: galleries.id,
          title: galleries.title,
          coverImageId: galleries.coverImageId,
          imageCount: galleries.imageCount,
          rating: galleries.rating,
          galleryType: galleries.galleryType,
          zipFilePath: galleries.zipFilePath,
          isNsfw: galleries.isNsfw,
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
    const galleryIds = rows.map((row) => row.id);
    const previewRows = galleryIds.length
      ? await db
          .select({
            galleryId: images.galleryId,
            imageId: images.id,
            width: images.width,
            height: images.height,
          })
          .from(images)
          .where(and(inArray(images.galleryId, galleryIds), imageVisibleSql(images.filePath)))
          .orderBy(asc(images.sortOrder))
      : [];

    const previewMap = new Map<string, string[]>();
    const previewAspectMap = new Map<string, Array<{ width: number | null; height: number | null }>>();
    for (const preview of previewRows) {
      if (!preview.galleryId) continue;
      const current = previewMap.get(preview.galleryId) ?? [];
      if (current.length >= 4) continue;
      current.push(`/assets/images/${preview.imageId}/thumb`);
      previewMap.set(preview.galleryId, current);

      const aspectCandidates = previewAspectMap.get(preview.galleryId) ?? [];
      aspectCandidates.push({ width: preview.width, height: preview.height });
      previewAspectMap.set(preview.galleryId, aspectCandidates);
    }

    const childRows = galleryIds.length
      ? await db
          .select({
            id: galleries.id,
            parentId: galleries.parentId,
            galleryType: galleries.galleryType,
            zipFilePath: galleries.zipFilePath,
            imageCount: galleries.imageCount,
          })
          .from(galleries)
          .where(inArray(galleries.parentId, galleryIds))
      : [];
    const childrenByParent = new Map<string, typeof childRows>();
    for (const child of childRows) {
      if (!child.parentId) continue;
      childrenByParent.set(child.parentId, [
        ...(childrenByParent.get(child.parentId) ?? []),
        child,
      ]);
    }

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
        meta: {
          imageCount: r.imageCount,
          galleryType: r.galleryType,
          isNsfw: r.isNsfw,
          isComic:
            isComicGalleryRow(r) ||
            isComicSeriesGalleryRow(r, childrenByParent.get(r.id) ?? []),
          coverAspectRatio: largestImageAspectRatio(previewAspectMap.get(r.id) ?? []),
          previewImagePaths: previewMap.get(r.id) ?? [],
        },
      })),
    };
  },
});
