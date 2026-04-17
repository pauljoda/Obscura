import { db, schema } from "../../db";
import { ilike, or, and, ne, desc, sql } from "drizzle-orm";
import type {
  SearchProvider,
  SearchProviderQuery,
  SearchProviderResult,
} from "../types";

const { videoSeries } = schema;

/**
 * Folders/series search provider backed by `video_series`. Returns results as
 * `kind: "video-series"` and links at `/videos?folder=:id` which the
 * /videos list already routes through the video-folder service.
 */
export const sceneFoldersSearchProvider: SearchProvider = {
  kind: "video-series",
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
      ilike(videoSeries.title, term),
      ilike(videoSeries.overview, term),
      ilike(videoSeries.sortTitle, term),
    )!;

    const conditions = [matchCondition];
    if (sfwOnly) conditions.push(ne(videoSeries.isNsfw, true));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${videoSeries.title}) = lower(${q}) THEN 100
      WHEN lower(${videoSeries.title}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${videoSeries.title}) LIKE '%' || lower(${q}) || '%' THEN 60
      WHEN ${videoSeries.overview} IS NOT NULL AND lower(${videoSeries.overview}) LIKE '%' || lower(${q}) || '%' THEN 40
      ELSE 30
    END`;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: videoSeries.id,
          title: videoSeries.title,
          posterPath: videoSeries.posterPath,
          backdropPath: videoSeries.backdropPath,
          rating: videoSeries.rating,
          totalEpisodeCount: sql<number>`(
            SELECT COUNT(*)::int FROM video_episodes ve
            WHERE ve.series_id = ${videoSeries.id}
          )`,
          score: scoreExpr,
        })
        .from(videoSeries)
        .where(where)
        .orderBy(desc(scoreExpr), desc(videoSeries.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(videoSeries)
        .where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => {
        const episodeCount = Number(r.totalEpisodeCount ?? 0);
        return {
          id: r.id,
          kind: "video-series" as const,
          title: r.title,
          subtitle:
            episodeCount > 0
              ? `${episodeCount} episode${episodeCount !== 1 ? "s" : ""}`
              : null,
          imagePath: r.posterPath ?? r.backdropPath ?? null,
          href: `/videos?folder=${r.id}`,
          rating: r.rating,
          score: Number(r.score ?? 0),
          meta: { sceneCount: episodeCount },
        };
      }),
    };
  },
};
