import { formatDuration, formatFileSize, getResolutionLabel } from "@obscura/contracts";
import { db, schema } from "../../db";
import { ilike, or, sql, and, gte, lte, eq, exists, ne } from "drizzle-orm";
import type { SearchProvider, SearchProviderQuery, SearchProviderResult } from "../types";

const {
  studios,
  performers,
  tags,
  videoEpisodes,
  videoSeries,
  videoMovies,
  videoEpisodePerformers,
  videoEpisodeTags,
  videoMoviePerformers,
  videoMovieTags,
} = schema;

/**
 * Videos search provider backed by the typed video_episodes + video_movies
 * tables. Returns a merged, score-sorted result set so the UI never needs to
 * distinguish between an episode row and a movie row — both render as
 * "video"-kind cards.
 */
export const scenesSearchProvider: SearchProvider = {
  kind: "video",
  label: "Videos",
  defaultPreviewLimit: 3,

  async query({
    q,
    limit,
    offset,
    filters,
  }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;

    const episodeMatchCondition = or(
      ilike(videoEpisodes.title, term),
      ilike(videoEpisodes.overview, term),
      exists(
        db
          .select({ x: sql`1` })
          .from(videoEpisodePerformers)
          .innerJoin(
            performers,
            eq(performers.id, videoEpisodePerformers.performerId),
          )
          .where(
            and(
              eq(videoEpisodePerformers.episodeId, videoEpisodes.id),
              ilike(performers.name, term),
            ),
          ),
      ),
      exists(
        db
          .select({ x: sql`1` })
          .from(videoEpisodeTags)
          .innerJoin(tags, eq(tags.id, videoEpisodeTags.tagId))
          .where(
            and(
              eq(videoEpisodeTags.episodeId, videoEpisodes.id),
              ilike(tags.name, term),
            ),
          ),
      ),
    )!;

    const movieMatchCondition = or(
      ilike(videoMovies.title, term),
      ilike(videoMovies.overview, term),
      exists(
        db
          .select({ x: sql`1` })
          .from(videoMoviePerformers)
          .innerJoin(
            performers,
            eq(performers.id, videoMoviePerformers.performerId),
          )
          .where(
            and(
              eq(videoMoviePerformers.movieId, videoMovies.id),
              ilike(performers.name, term),
            ),
          ),
      ),
      exists(
        db
          .select({ x: sql`1` })
          .from(videoMovieTags)
          .innerJoin(tags, eq(tags.id, videoMovieTags.tagId))
          .where(
            and(
              eq(videoMovieTags.movieId, videoMovies.id),
              ilike(tags.name, term),
            ),
          ),
      ),
    )!;

    const episodeConditions = [episodeMatchCondition];
    const movieConditions = [movieMatchCondition];

    if (filters.rating) {
      episodeConditions.push(gte(videoEpisodes.rating, filters.rating));
      movieConditions.push(gte(videoMovies.rating, filters.rating));
    }
    if (filters.dateFrom) {
      // episodes use air_date, movies use release_date; both are text-typed
      episodeConditions.push(gte(videoEpisodes.airDate, filters.dateFrom));
      movieConditions.push(gte(videoMovies.releaseDate, filters.dateFrom));
    }
    if (filters.dateTo) {
      episodeConditions.push(lte(videoEpisodes.airDate, filters.dateTo));
      movieConditions.push(lte(videoMovies.releaseDate, filters.dateTo));
    }
    if (filters.nsfw === "off") {
      episodeConditions.push(ne(videoEpisodes.isNsfw, true));
      movieConditions.push(ne(videoMovies.isNsfw, true));
    }

    const episodeWhere = and(...episodeConditions);
    const movieWhere = and(...movieConditions);

    // Rank: exact title > prefix title > contains title > other match
    const episodeScoreExpr = sql<number>`CASE
      WHEN lower(${videoEpisodes.title}) = lower(${q}) THEN 100
      WHEN lower(${videoEpisodes.title}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${videoEpisodes.title}) LIKE '%' || lower(${q}) || '%' THEN 60
      ELSE 40
    END`;
    const movieScoreExpr = sql<number>`CASE
      WHEN lower(${videoMovies.title}) = lower(${q}) THEN 100
      WHEN lower(${videoMovies.title}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${videoMovies.title}) LIKE '%' || lower(${q}) || '%' THEN 60
      ELSE 40
    END`;

    // Fetch both lists wide (limit+offset worth of rows from each), then
    // merge. For typical search result limits (50 or so) this is fine.
    const fetchCap = limit + offset;

    const [episodeRows, movieRows, episodeCountResult, movieCountResult] =
      await Promise.all([
        db
          .select({
            id: videoEpisodes.id,
            title: videoEpisodes.title,
            thumbnailPath: videoEpisodes.thumbnailPath,
            cardThumbnailPath: videoEpisodes.cardThumbnailPath,
            studioName: studios.name,
            rating: videoEpisodes.rating,
            duration: videoEpisodes.duration,
            height: videoEpisodes.height,
            codec: videoEpisodes.codec,
            fileSize: videoEpisodes.fileSize,
            spritePath: videoEpisodes.spritePath,
            trickplayVttPath: videoEpisodes.trickplayVttPath,
            playCount: videoEpisodes.playCount,
            createdAt: videoEpisodes.createdAt,
            score: episodeScoreExpr,
          })
          .from(videoEpisodes)
          .leftJoin(videoSeries, eq(videoEpisodes.seriesId, videoSeries.id))
          .leftJoin(studios, eq(videoSeries.studioId, studios.id))
          .where(episodeWhere)
          .orderBy(sql`${episodeScoreExpr} DESC`, sql`${videoEpisodes.createdAt} DESC`)
          .limit(fetchCap),
        db
          .select({
            id: videoMovies.id,
            title: videoMovies.title,
            thumbnailPath: videoMovies.thumbnailPath,
            cardThumbnailPath: videoMovies.cardThumbnailPath,
            studioName: studios.name,
            rating: videoMovies.rating,
            duration: videoMovies.duration,
            height: videoMovies.height,
            codec: videoMovies.codec,
            fileSize: videoMovies.fileSize,
            spritePath: videoMovies.spritePath,
            trickplayVttPath: videoMovies.trickplayVttPath,
            playCount: videoMovies.playCount,
            createdAt: videoMovies.createdAt,
            score: movieScoreExpr,
          })
          .from(videoMovies)
          .leftJoin(studios, eq(videoMovies.studioId, studios.id))
          .where(movieWhere)
          .orderBy(sql`${movieScoreExpr} DESC`, sql`${videoMovies.createdAt} DESC`)
          .limit(fetchCap),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(videoEpisodes)
          .where(episodeWhere),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(videoMovies)
          .where(movieWhere),
      ]);

    const total =
      (episodeCountResult[0]?.total ?? 0) + (movieCountResult[0]?.total ?? 0);

    const merged = [
      ...episodeRows.map((r) => ({ ...r, kind: "episode" as const })),
      ...movieRows.map((r) => ({ ...r, kind: "movie" as const })),
    ].sort((a, b) => {
      const scoreDiff = Number(b.score ?? 0) - Number(a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const paged = merged.slice(offset, offset + limit);

    return {
      total,
      items: paged.map((r) => ({
        id: r.id,
        kind: "video" as const,
        title: r.title ?? "Untitled",
        subtitle: r.studioName ?? null,
        imagePath: r.thumbnailPath ?? null,
        href: `/videos/${r.id}`,
        rating: r.rating,
        score: Number(r.score ?? 0),
        meta: {
          durationSeconds: r.duration ? Number(r.duration) : null,
          durationFormatted: r.duration
            ? formatDuration(Number(r.duration))
            : null,
          resolution: getResolutionLabel(r.height),
          codec: r.codec,
          cardThumbnailPath: r.cardThumbnailPath,
          fileSizeFormatted: r.fileSize
            ? formatFileSize(Number(r.fileSize))
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
