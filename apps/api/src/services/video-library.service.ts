import { eq, desc, asc, sql } from "drizzle-orm";
import { db, schema } from "../db";

const { videoSeries, videoSeasons, videoEpisodes, videoMovies } = schema;

export interface ListVideoMovieRow {
  id: string;
  title: string;
  releaseDate: string | null;
  runtime: number | null;
  rating: number | null;
  posterPath: string | null;
  isNsfw: boolean;
  organized: boolean;
  duration: number | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export async function listLibraryVideoMovies(
  options: {
    limit?: number;
    offset?: number;
    includeNsfw?: boolean;
  } = {},
): Promise<{ items: ListVideoMovieRow[]; total: number }> {
  const limit = Math.min(options.limit ?? 60, 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const rows = await db
    .select({
      id: videoMovies.id,
      title: videoMovies.title,
      releaseDate: videoMovies.releaseDate,
      runtime: videoMovies.runtime,
      rating: videoMovies.rating,
      posterPath: videoMovies.posterPath,
      isNsfw: videoMovies.isNsfw,
      organized: videoMovies.organized,
      duration: videoMovies.duration,
      width: videoMovies.width,
      height: videoMovies.height,
      createdAt: videoMovies.createdAt,
    })
    .from(videoMovies)
    .orderBy(desc(videoMovies.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoMovies);

  return {
    items: rows as ListVideoMovieRow[],
    total: Number(countRow?.count ?? 0),
  };
}

export interface ListVideoSeriesRow {
  id: string;
  title: string;
  overview: string | null;
  firstAirDate: string | null;
  endAirDate: string | null;
  status: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  isNsfw: boolean;
  organized: boolean;
  createdAt: Date;
  seasonCount: number;
  episodeCount: number;
}

export async function listLibraryVideoSeries(
  options: {
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ items: ListVideoSeriesRow[]; total: number }> {
  const limit = Math.min(options.limit ?? 60, 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const result = await db.execute<{
    id: string;
    title: string;
    overview: string | null;
    firstAirDate: string | null;
    endAirDate: string | null;
    status: string | null;
    posterPath: string | null;
    backdropPath: string | null;
    isNsfw: boolean;
    organized: boolean;
    createdAt: Date;
    seasonCount: number;
    episodeCount: number;
  }>(sql`
    SELECT
      s.id,
      s.title,
      s.overview,
      s.first_air_date        AS "firstAirDate",
      s.end_air_date          AS "endAirDate",
      s.status,
      s.poster_path           AS "posterPath",
      s.backdrop_path         AS "backdropPath",
      s.is_nsfw               AS "isNsfw",
      s.organized,
      s.created_at            AS "createdAt",
      (SELECT count(*)::int FROM video_seasons WHERE series_id = s.id) AS "seasonCount",
      (SELECT count(*)::int FROM video_episodes WHERE series_id = s.id) AS "episodeCount"
    FROM video_series s
    ORDER BY s.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const rows = (Array.isArray(result) ? result : (result as any).rows ?? []) as ListVideoSeriesRow[];

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoSeries);

  return { items: rows, total: Number(countRow?.count ?? 0) };
}

export interface SeriesDetailResponse {
  id: string;
  title: string;
  overview: string | null;
  firstAirDate: string | null;
  endAirDate: string | null;
  status: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  isNsfw: boolean;
  organized: boolean;
  seasons: Array<{
    id: string;
    seasonNumber: number;
    title: string | null;
    overview: string | null;
    episodes: Array<{
      id: string;
      seasonNumber: number;
      episodeNumber: number | null;
      title: string | null;
      overview: string | null;
      runtime: number | null;
      duration: number | null;
      isNsfw: boolean;
      organized: boolean;
      /** On-disk path — included for identify / plugin cascade matching. */
      filePath: string;
    }>;
  }>;
}

export async function getLibraryVideoSeriesDetail(
  id: string,
): Promise<SeriesDetailResponse | null> {
  const [series] = await db
    .select()
    .from(videoSeries)
    .where(eq(videoSeries.id, id))
    .limit(1);
  if (!series) return null;

  const seasons = await db
    .select()
    .from(videoSeasons)
    .where(eq(videoSeasons.seriesId, id))
    .orderBy(asc(videoSeasons.seasonNumber));

  const episodes = seasons.length
    ? await db
        .select()
        .from(videoEpisodes)
        .where(eq(videoEpisodes.seriesId, id))
        .orderBy(
          asc(videoEpisodes.seasonNumber),
          asc(videoEpisodes.episodeNumber),
        )
    : [];

  return {
    id: series.id,
    title: series.title,
    overview: series.overview,
    firstAirDate: series.firstAirDate,
    endAirDate: series.endAirDate,
    status: series.status,
    posterPath: series.posterPath,
    backdropPath: series.backdropPath,
    rating: series.rating,
    isNsfw: series.isNsfw,
    organized: series.organized,
    seasons: seasons.map((season) => ({
      id: season.id,
      seasonNumber: season.seasonNumber,
      title: season.title,
      overview: season.overview,
      episodes: episodes
        .filter((e) => e.seasonId === season.id)
        .map((e) => ({
          id: e.id,
          seasonNumber: e.seasonNumber,
          episodeNumber: e.episodeNumber,
          title: e.title,
          overview: e.overview,
          runtime: e.runtime,
          duration: e.duration,
          isNsfw: e.isNsfw,
          organized: e.organized,
          filePath: e.filePath,
        })),
    })),
  };
}

export async function getLibraryVideoMovieDetail(id: string) {
  const [movie] = await db
    .select()
    .from(videoMovies)
    .where(eq(videoMovies.id, id))
    .limit(1);
  return movie ?? null;
}

export async function getLibraryVideoEpisodeDetail(id: string) {
  const [episode] = await db
    .select()
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, id))
    .limit(1);
  return episode ?? null;
}

export async function getLibraryVideoCounts() {
  const [movieCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoMovies);
  const [seriesCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoSeries);
  const [episodeCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoEpisodes);
  return {
    movies: Number(movieCount?.count ?? 0),
    series: Number(seriesCount?.count ?? 0),
    episodes: Number(episodeCount?.count ?? 0),
  };
}
