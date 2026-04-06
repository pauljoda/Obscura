import { db, schema } from "../../db";
import { ilike, or, sql, and, gte, lte, count, eq, exists } from "drizzle-orm";
import type { SearchProvider, SearchProviderQuery, SearchProviderResult } from "../types";

const { scenes, studios, scenePerformers, performers, sceneTags, tags } = schema;

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

function resolutionLabel(height: number | null): string | null {
  if (!height) return null;
  if (height >= 2160) return "4K";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return `${height}p`;
}

export const scenesSearchProvider: SearchProvider = {
  kind: "scene",
  label: "Scenes",
  defaultPreviewLimit: 3,

  async query({ q, limit, offset, filters }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;

    // Match on title, details, or associated performer/tag names
    const matchCondition = or(
      ilike(scenes.title, term),
      ilike(scenes.details, term),
      exists(
        db.select({ x: sql`1` }).from(scenePerformers)
          .innerJoin(performers, eq(performers.id, scenePerformers.performerId))
          .where(and(eq(scenePerformers.sceneId, scenes.id), ilike(performers.name, term)))
      ),
      exists(
        db.select({ x: sql`1` }).from(sceneTags)
          .innerJoin(tags, eq(tags.id, sceneTags.tagId))
          .where(and(eq(sceneTags.sceneId, scenes.id), ilike(tags.name, term)))
      ),
    )!;

    const conditions = [matchCondition];
    if (filters.rating) conditions.push(gte(scenes.rating, filters.rating));
    if (filters.dateFrom) conditions.push(gte(scenes.date, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(scenes.date, filters.dateTo));

    const where = and(...conditions);

    // Rank: exact title > prefix title > contains title > performer/tag/details match
    const scoreExpr = sql<number>`CASE
      WHEN lower(${scenes.title}) = lower(${q}) THEN 100
      WHEN lower(${scenes.title}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${scenes.title}) LIKE '%' || lower(${q}) || '%' THEN 60
      ELSE 40
    END`;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: scenes.id,
        title: scenes.title,
        thumbnailPath: scenes.thumbnailPath,
        cardThumbnailPath: scenes.cardThumbnailPath,
        studioName: studios.name,
        rating: scenes.rating,
        duration: scenes.duration,
        height: scenes.height,
        codec: scenes.codec,
        fileSize: scenes.fileSize,
        spritePath: scenes.spritePath,
        trickplayVttPath: scenes.trickplayVttPath,
        playCount: scenes.playCount,
        score: scoreExpr,
      })
        .from(scenes)
        .leftJoin(studios, eq(scenes.studioId, studios.id))
        .where(where)
        .orderBy(sql`${scoreExpr} DESC`, sql`${scenes.createdAt} DESC`)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(scenes).where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        kind: "scene" as const,
        title: r.title,
        subtitle: r.studioName ?? null,
        imagePath: r.thumbnailPath ?? null,
        href: `/scenes/${r.id}`,
        rating: r.rating,
        score: r.score,
        meta: {
          durationSeconds: r.duration,
          durationFormatted: formatDuration(r.duration),
          resolution: resolutionLabel(r.height),
          codec: r.codec,
          cardThumbnailPath: r.cardThumbnailPath,
          fileSizeFormatted:
            r.fileSize && r.fileSize >= 1024 * 1024 * 1024
              ? `${(r.fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB`
              : r.fileSize
                ? `${(r.fileSize / (1024 * 1024)).toFixed(0)} MB`
                : null,
          spritePath: r.spritePath,
          trickplayVttPath: r.trickplayVttPath,
          studio: r.studioName,
          views: r.playCount,
        },
      })),
    };
  },
};
