/**
 * Video (episode + movie) business logic, backed by the new typed
 * `video_episodes` / `video_movies` / `video_series` tables.
 *
 * Produces SceneListItemDto / SceneDetailDto / SceneStatsDto-shaped
 * responses so the existing `/scenes`-style client can consume them
 * without modification. Episodes expose `sceneFolderId = seriesId`;
 * movies expose `sceneFolderId = null` and are reachable via the
 * `uncategorized` scope.
 */
import { existsSync } from "node:fs";
import {
  eq,
  ilike,
  or,
  desc,
  asc,
  sql,
  inArray,
  and,
  ne,
  isNotNull,
  isNull,
  gte,
  lte,
  lt,
  gt,
  type SQL,
} from "drizzle-orm";
import {
  formatDuration,
  formatFileSize,
  getResolutionLabel,
} from "@obscura/contracts";
import { db, schema } from "../db";
import { AppError } from "../plugins/error-handler";
import {
  MAX_ENTITY_LIST_LIMIT,
  parsePagination,
  toArray,
  buildResolutionConditions,
  type SortConfig,
} from "../lib/query-helpers";

const {
  videoEpisodes,
  videoMovies,
  videoSeries,
  videoEpisodePerformers,
  videoEpisodeTags,
  videoMoviePerformers,
  videoMovieTags,
  performers,
  tags,
  studios,
} = schema;

// ─── Query Types ───────────────────────────────────────────────

export interface ListVideosQuery {
  search?: string;
  sort?: string;
  order?: string;
  resolution?: string | string[];
  limit?: string;
  offset?: string;
  nsfw?: string;
  ratingMin?: string;
  ratingMax?: string;
  dateFrom?: string;
  dateTo?: string;
  durationMin?: string;
  durationMax?: string;
  organized?: string;
  hasFile?: string;
  played?: string;
  sceneFolderId?: string;
  folderScope?: "direct" | "subtree";
  uncategorized?: string;
}

export interface UpdateVideoBody {
  title?: string;
  details?: string | null;
  date?: string | null;
  rating?: number | null;
  organized?: boolean;
  isNsfw?: boolean;
  orgasmCount?: number;
}

// ─── Helpers ───────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Internal "video row" in a list projection, normalized across
 * episodes and movies so the rest of the code path is source-agnostic.
 */
interface VideoRow {
  kind: "episode" | "movie";
  id: string;
  title: string;
  details: string | null;
  date: string | null;
  rating: number | null;
  organized: boolean;
  isNsfw: boolean;
  duration: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  container: string | null;
  fileSize: number | null;
  filePath: string | null;
  thumbnailPath: string | null;
  cardThumbnailPath: string | null;
  spritePath: string | null;
  trickplayVttPath: string | null;
  playCount: number;
  orgasmCount: number;
  studioId: string | null;
  seriesId: string | null;
  seriesTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
  episodeNumber: number | null;
}

function toVideoListItem(row: VideoRow) {
  const hasVideo = !!(row.filePath && existsSync(row.filePath));
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    date: row.date,
    rating: row.rating,
    organized: row.organized,
    isNsfw: row.isNsfw,
    duration: row.duration,
    durationFormatted: formatDuration(row.duration),
    resolution: getResolutionLabel(row.height),
    width: row.width,
    height: row.height,
    codec: row.codec?.toUpperCase() ?? null,
    container: row.container,
    fileSize: row.fileSize,
    fileSizeFormatted: formatFileSize(row.fileSize),
    filePath: row.filePath,
    hasVideo,
    streamUrl: hasVideo ? `/video-stream/${row.id}/hls2/master.m3u8` : null,
    directStreamUrl: hasVideo ? `/video-stream/${row.id}/source` : null,
    thumbnailPath: row.thumbnailPath,
    cardThumbnailPath: row.cardThumbnailPath,
    spritePath: row.spritePath,
    trickplayVttPath: row.trickplayVttPath,
    playCount: row.playCount,
    orgasmCount: row.orgasmCount,
    studioId: row.studioId,
    sceneFolderId: row.seriesId,
    sceneFolderTitle: row.seriesTitle,
    hasSubtitles: false,
    performers: [] as {
      id: string;
      name: string;
      imagePath: string | null;
      isNsfw: boolean;
    }[],
    tags: [] as { id: string; name: string; isNsfw: boolean }[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseSort(query: ListVideosQuery, kind: "episode" | "movie") {
  const table = kind === "episode" ? videoEpisodes : videoMovies;
  const dateColumn =
    kind === "episode" ? videoEpisodes.airDate : videoMovies.releaseDate;
  const columns = {
    recent: table.createdAt,
    title: table.title,
    duration: table.duration,
    size: table.fileSize,
    rating: table.rating,
    date: dateColumn,
    plays: table.playCount,
  } as SortConfig["columns"];
  const defaultDir: Record<string, "asc" | "desc"> = {
    recent: "desc",
    title: "asc",
    duration: "desc",
    size: "desc",
    rating: "desc",
    date: "desc",
    plays: "desc",
  };
  const sortKey = query.sort ?? "recent";
  const col = columns[sortKey] ?? table.createdAt;
  const dir =
    query.order === "asc" || query.order === "desc"
      ? query.order
      : (defaultDir[sortKey] ?? "desc");
  return dir === "asc" ? asc(col) : desc(col);
}

function buildCommonDateFilters<T extends "episode" | "movie">(
  query: ListVideosQuery,
  kind: T,
): SQL[] {
  const conds: SQL[] = [];
  const dateCol =
    kind === "episode" ? videoEpisodes.airDate : videoMovies.releaseDate;
  if (query.dateFrom && ISO_DATE_RE.test(query.dateFrom)) {
    conds.push(and(isNotNull(dateCol), gte(dateCol, query.dateFrom))!);
  }
  if (query.dateTo && ISO_DATE_RE.test(query.dateTo)) {
    conds.push(and(isNotNull(dateCol), lte(dateCol, query.dateTo))!);
  }
  return conds;
}

/**
 * List videos, merging episodes and movies into a unified response.
 *
 * Scoping rules:
 *   - sceneFolderId set → only episodes from that series
 *   - uncategorized=true → only movies
 *   - neither → episodes + movies, ordered per sort
 */
export async function listVideoScenes(query: ListVideosQuery) {
  const { limit, offset } = parsePagination(
    query.limit,
    query.offset,
    50,
    MAX_ENTITY_LIST_LIMIT,
  );

  if (query.sceneFolderId && query.uncategorized === "true") {
    throw new AppError(
      400,
      "sceneFolderId and uncategorized cannot both be set",
    );
  }

  const wantEpisodes = query.uncategorized !== "true";
  const wantMovies = !query.sceneFolderId;

  // Shared text-search / rating / duration / played / hasFile
  // filters are built per table with the right column refs.

  // ─── Episodes ─────────────────────────────────────────────────
  let episodes: VideoRow[] = [];
  let episodeCount = 0;
  if (wantEpisodes) {
    const conds: SQL[] = [];
    if (query.nsfw === "off") conds.push(ne(videoEpisodes.isNsfw, true));
    if (query.search) {
      const term = `%${query.search}%`;
      conds.push(
        or(
          ilike(videoEpisodes.title, term),
          ilike(videoEpisodes.overview, term),
          ilike(videoEpisodes.filePath, term),
        )!,
      );
    }
    const resValues = toArray(query.resolution);
    if (resValues.length > 0) {
      const resCond = buildResolutionConditions(videoEpisodes.height, resValues);
      if (resCond) conds.push(resCond);
    }
    const ratingMin =
      query.ratingMin !== undefined ? Number(query.ratingMin) : NaN;
    if (Number.isInteger(ratingMin) && ratingMin >= 1 && ratingMin <= 5) {
      conds.push(
        and(isNotNull(videoEpisodes.rating), gte(videoEpisodes.rating, ratingMin))!,
      );
    }
    const ratingMax =
      query.ratingMax !== undefined ? Number(query.ratingMax) : NaN;
    if (Number.isInteger(ratingMax) && ratingMax >= 1 && ratingMax <= 5) {
      conds.push(
        and(isNotNull(videoEpisodes.rating), lte(videoEpisodes.rating, ratingMax))!,
      );
    }
    const durationMin =
      query.durationMin !== undefined ? Number(query.durationMin) : NaN;
    if (Number.isFinite(durationMin) && durationMin >= 0) {
      conds.push(
        and(
          isNotNull(videoEpisodes.duration),
          gte(videoEpisodes.duration, durationMin),
        )!,
      );
    }
    const durationMax =
      query.durationMax !== undefined ? Number(query.durationMax) : NaN;
    if (Number.isFinite(durationMax) && durationMax > 0) {
      conds.push(
        and(
          isNotNull(videoEpisodes.duration),
          lt(videoEpisodes.duration, durationMax),
        )!,
      );
    }
    if (query.organized === "true") conds.push(eq(videoEpisodes.organized, true));
    if (query.organized === "false") conds.push(eq(videoEpisodes.organized, false));
    if (query.hasFile === "true") conds.push(isNotNull(videoEpisodes.filePath));
    if (query.hasFile === "false") conds.push(isNull(videoEpisodes.filePath));
    if (query.played === "true") {
      conds.push(
        or(
          gt(videoEpisodes.playCount, 0),
          isNotNull(videoEpisodes.lastPlayedAt),
        )!,
      );
    }
    if (query.played === "false") {
      conds.push(
        and(
          eq(videoEpisodes.playCount, 0),
          isNull(videoEpisodes.lastPlayedAt),
        )!,
      );
    }
    conds.push(...buildCommonDateFilters(query, "episode"));

    if (query.sceneFolderId) {
      conds.push(eq(videoEpisodes.seriesId, query.sceneFolderId));
    }

    const where = conds.length > 0 ? and(...conds) : undefined;

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(videoEpisodes)
      .where(where);
    episodeCount = Number(countRow?.count ?? 0);

    const rows = await db
      .select({
        id: videoEpisodes.id,
        title: videoEpisodes.title,
        overview: videoEpisodes.overview,
        airDate: videoEpisodes.airDate,
        rating: videoEpisodes.rating,
        organized: videoEpisodes.organized,
        isNsfw: videoEpisodes.isNsfw,
        duration: videoEpisodes.duration,
        width: videoEpisodes.width,
        height: videoEpisodes.height,
        codec: videoEpisodes.codec,
        container: videoEpisodes.container,
        fileSize: videoEpisodes.fileSize,
        filePath: videoEpisodes.filePath,
        thumbnailPath: videoEpisodes.thumbnailPath,
        cardThumbnailPath: videoEpisodes.cardThumbnailPath,
        spritePath: videoEpisodes.spritePath,
        trickplayVttPath: videoEpisodes.trickplayVttPath,
        playCount: videoEpisodes.playCount,
        orgasmCount: videoEpisodes.orgasmCount,
        seriesId: videoEpisodes.seriesId,
        seriesTitle: videoSeries.title,
        seriesStudioId: videoSeries.studioId,
        createdAt: videoEpisodes.createdAt,
        updatedAt: videoEpisodes.updatedAt,
        episodeNumber: videoEpisodes.episodeNumber,
      })
      .from(videoEpisodes)
      .leftJoin(videoSeries, eq(videoEpisodes.seriesId, videoSeries.id))
      .where(where)
      .orderBy(parseSort(query, "episode"))
      .limit(limit)
      .offset(offset);

    episodes = rows.map((r) => ({
      kind: "episode",
      id: r.id,
      title: r.title ?? "Untitled Episode",
      details: r.overview,
      date: r.airDate,
      rating: r.rating,
      organized: r.organized,
      isNsfw: r.isNsfw,
      duration: r.duration,
      width: r.width,
      height: r.height,
      codec: r.codec,
      container: r.container,
      fileSize: r.fileSize,
      filePath: r.filePath,
      thumbnailPath: r.thumbnailPath,
      cardThumbnailPath: r.cardThumbnailPath,
      spritePath: r.spritePath,
      trickplayVttPath: r.trickplayVttPath,
      playCount: r.playCount,
      orgasmCount: r.orgasmCount,
      studioId: r.seriesStudioId,
      seriesId: r.seriesId,
      seriesTitle: r.seriesTitle,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      episodeNumber: r.episodeNumber,
    }));
  }

  // ─── Movies ──────────────────────────────────────────────────
  let movies: VideoRow[] = [];
  let movieCount = 0;
  if (wantMovies) {
    const conds: SQL[] = [];
    if (query.nsfw === "off") conds.push(ne(videoMovies.isNsfw, true));
    if (query.search) {
      const term = `%${query.search}%`;
      conds.push(
        or(
          ilike(videoMovies.title, term),
          ilike(videoMovies.overview, term),
          ilike(videoMovies.filePath, term),
        )!,
      );
    }
    const resValues = toArray(query.resolution);
    if (resValues.length > 0) {
      const resCond = buildResolutionConditions(videoMovies.height, resValues);
      if (resCond) conds.push(resCond);
    }
    const ratingMin =
      query.ratingMin !== undefined ? Number(query.ratingMin) : NaN;
    if (Number.isInteger(ratingMin) && ratingMin >= 1 && ratingMin <= 5) {
      conds.push(
        and(isNotNull(videoMovies.rating), gte(videoMovies.rating, ratingMin))!,
      );
    }
    const ratingMax =
      query.ratingMax !== undefined ? Number(query.ratingMax) : NaN;
    if (Number.isInteger(ratingMax) && ratingMax >= 1 && ratingMax <= 5) {
      conds.push(
        and(isNotNull(videoMovies.rating), lte(videoMovies.rating, ratingMax))!,
      );
    }
    const durationMin =
      query.durationMin !== undefined ? Number(query.durationMin) : NaN;
    if (Number.isFinite(durationMin) && durationMin >= 0) {
      conds.push(
        and(
          isNotNull(videoMovies.duration),
          gte(videoMovies.duration, durationMin),
        )!,
      );
    }
    const durationMax =
      query.durationMax !== undefined ? Number(query.durationMax) : NaN;
    if (Number.isFinite(durationMax) && durationMax > 0) {
      conds.push(
        and(
          isNotNull(videoMovies.duration),
          lt(videoMovies.duration, durationMax),
        )!,
      );
    }
    if (query.organized === "true") conds.push(eq(videoMovies.organized, true));
    if (query.organized === "false") conds.push(eq(videoMovies.organized, false));
    if (query.hasFile === "true") conds.push(isNotNull(videoMovies.filePath));
    if (query.hasFile === "false") conds.push(isNull(videoMovies.filePath));
    if (query.played === "true") {
      conds.push(
        or(
          gt(videoMovies.playCount, 0),
          isNotNull(videoMovies.lastPlayedAt),
        )!,
      );
    }
    if (query.played === "false") {
      conds.push(
        and(
          eq(videoMovies.playCount, 0),
          isNull(videoMovies.lastPlayedAt),
        )!,
      );
    }
    conds.push(...buildCommonDateFilters(query, "movie"));

    const where = conds.length > 0 ? and(...conds) : undefined;
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(videoMovies)
      .where(where);
    movieCount = Number(countRow?.count ?? 0);

    const rows = await db
      .select()
      .from(videoMovies)
      .where(where)
      .orderBy(parseSort(query, "movie"))
      .limit(limit)
      .offset(offset);

    movies = rows.map((r) => ({
      kind: "movie",
      id: r.id,
      title: r.title,
      details: r.overview,
      date: r.releaseDate,
      rating: r.rating,
      organized: r.organized,
      isNsfw: r.isNsfw,
      duration: r.duration,
      width: r.width,
      height: r.height,
      codec: r.codec,
      container: r.container,
      fileSize: r.fileSize,
      filePath: r.filePath,
      thumbnailPath: r.thumbnailPath,
      cardThumbnailPath: r.cardThumbnailPath,
      spritePath: r.spritePath,
      trickplayVttPath: r.trickplayVttPath,
      playCount: r.playCount,
      orgasmCount: r.orgasmCount,
      studioId: r.studioId,
      seriesId: null,
      seriesTitle: null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      episodeNumber: null,
    }));
  }

  // Merge — when both contribute, fall back to a client-stable
  // order (most-recent first) and clip to `limit`. This is a pragmatic
  // compromise given we can't do a cross-table ORDER BY cheaply.
  const merged = [...episodes, ...movies];
  merged.sort((a, b) => {
    const av = a.createdAt?.getTime?.() ?? 0;
    const bv = b.createdAt?.getTime?.() ?? 0;
    return bv - av;
  });
  const sliced = merged.slice(0, limit);

  return {
    scenes: sliced.map(toVideoListItem),
    total: episodeCount + movieCount,
    limit,
    offset,
  };
}

/**
 * Aggregate stats across episodes + movies.
 */
export async function getVideoSceneStats(sfwOnly: boolean) {
  const epWhere = sfwOnly ? ne(videoEpisodes.isNsfw, true) : undefined;
  const mvWhere = sfwOnly ? ne(videoMovies.isNsfw, true) : undefined;

  const [epStats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      duration: sql<number>`coalesce(sum(${videoEpisodes.duration}), 0)`,
      size: sql<number>`coalesce(sum(${videoEpisodes.fileSize}), 0)`,
      plays: sql<number>`coalesce(sum(${videoEpisodes.playCount}), 0)`,
    })
    .from(videoEpisodes)
    .where(epWhere);
  const [mvStats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      duration: sql<number>`coalesce(sum(${videoMovies.duration}), 0)`,
      size: sql<number>`coalesce(sum(${videoMovies.fileSize}), 0)`,
      plays: sql<number>`coalesce(sum(${videoMovies.playCount}), 0)`,
    })
    .from(videoMovies)
    .where(mvWhere);

  const epRecentWhere = epWhere
    ? and(epWhere, sql`${videoEpisodes.createdAt} > now() - interval '7 days'`)
    : sql`${videoEpisodes.createdAt} > now() - interval '7 days'`;
  const mvRecentWhere = mvWhere
    ? and(mvWhere, sql`${videoMovies.createdAt} > now() - interval '7 days'`)
    : sql`${videoMovies.createdAt} > now() - interval '7 days'`;
  const [epRecent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoEpisodes)
    .where(epRecentWhere);
  const [mvRecent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoMovies)
    .where(mvRecentWhere);

  const totalScenes = Number(epStats.count) + Number(mvStats.count);
  const totalDuration = Number(epStats.duration) + Number(mvStats.duration);
  const totalSize = Number(epStats.size) + Number(mvStats.size);
  const totalPlays = Number(epStats.plays) + Number(mvStats.plays);
  const recentCount = Number(epRecent.count) + Number(mvRecent.count);
  const hours = Math.floor(totalDuration / 3600);
  const mins = Math.floor((totalDuration % 3600) / 60);

  return {
    totalScenes,
    totalDuration,
    totalDurationFormatted: `${hours}h ${mins}m`,
    totalSize,
    totalSizeFormatted: formatFileSize(totalSize),
    totalPlays,
    recentCount,
  };
}

// ─── Detail lookup ────────────────────────────────────────────

interface VideoSourceRow extends VideoRow {
  interactive: boolean;
  frameRate: number | null;
  bitRate: number | null;
  previewPath: string | null;
  playDuration: number | null;
  resumeTime: number | null;
  lastPlayedAt: Date | null;
}

async function loadEpisodeRow(id: string): Promise<VideoSourceRow | null> {
  const [row] = await db
    .select()
    .from(videoEpisodes)
    .leftJoin(videoSeries, eq(videoEpisodes.seriesId, videoSeries.id))
    .where(eq(videoEpisodes.id, id))
    .limit(1);
  if (!row) return null;
  const ep = row.video_episodes;
  const ser = row.video_series;
  return {
    kind: "episode",
    id: ep.id,
    title: ep.title ?? "Untitled Episode",
    details: ep.overview,
    date: ep.airDate,
    rating: ep.rating,
    organized: ep.organized,
    isNsfw: ep.isNsfw,
    duration: ep.duration,
    width: ep.width,
    height: ep.height,
    codec: ep.codec,
    container: ep.container,
    fileSize: ep.fileSize,
    filePath: ep.filePath,
    thumbnailPath: ep.thumbnailPath,
    cardThumbnailPath: ep.cardThumbnailPath,
    spritePath: ep.spritePath,
    trickplayVttPath: ep.trickplayVttPath,
    playCount: ep.playCount,
    orgasmCount: ep.orgasmCount,
    studioId: ser?.studioId ?? null,
    seriesId: ep.seriesId,
    seriesTitle: ser?.title ?? null,
    createdAt: ep.createdAt,
    updatedAt: ep.updatedAt,
    episodeNumber: ep.episodeNumber,
    interactive: false,
    frameRate: ep.frameRate,
    bitRate: ep.bitRate,
    previewPath: ep.previewPath,
    playDuration: ep.playDuration,
    resumeTime: ep.resumeTime,
    lastPlayedAt: ep.lastPlayedAt,
  };
}

async function loadMovieRow(id: string): Promise<VideoSourceRow | null> {
  const [mv] = await db
    .select()
    .from(videoMovies)
    .where(eq(videoMovies.id, id))
    .limit(1);
  if (!mv) return null;
  return {
    kind: "movie",
    id: mv.id,
    title: mv.title,
    details: mv.overview,
    date: mv.releaseDate,
    rating: mv.rating,
    organized: mv.organized,
    isNsfw: mv.isNsfw,
    duration: mv.duration,
    width: mv.width,
    height: mv.height,
    codec: mv.codec,
    container: mv.container,
    fileSize: mv.fileSize,
    filePath: mv.filePath,
    thumbnailPath: mv.thumbnailPath,
    cardThumbnailPath: mv.cardThumbnailPath,
    spritePath: mv.spritePath,
    trickplayVttPath: mv.trickplayVttPath,
    playCount: mv.playCount,
    orgasmCount: mv.orgasmCount,
    studioId: mv.studioId,
    seriesId: null,
    seriesTitle: null,
    createdAt: mv.createdAt,
    updatedAt: mv.updatedAt,
    episodeNumber: null,
    interactive: false,
    frameRate: mv.frameRate,
    bitRate: mv.bitRate,
    previewPath: mv.previewPath,
    playDuration: mv.playDuration,
    resumeTime: mv.resumeTime,
    lastPlayedAt: mv.lastPlayedAt,
  };
}

export async function loadVideoRow(
  id: string,
): Promise<VideoSourceRow | null> {
  return (await loadEpisodeRow(id)) ?? (await loadMovieRow(id));
}

export async function getVideoSceneDetail(id: string) {
  const row = await loadVideoRow(id);
  if (!row) {
    throw new AppError(404, "Video not found");
  }

  // Studio embed
  let studioEmbed: { id: string; name: string; url: string | null } | null =
    null;
  if (row.studioId) {
    const [studio] = await db
      .select({
        id: studios.id,
        name: studios.name,
        url: studios.url,
      })
      .from(studios)
      .where(eq(studios.id, row.studioId))
      .limit(1);
    if (studio) studioEmbed = studio;
  }

  // Performers / tags
  const perfJoinTable =
    row.kind === "episode" ? videoEpisodePerformers : videoMoviePerformers;
  const tagJoinTable =
    row.kind === "episode" ? videoEpisodeTags : videoMovieTags;
  const joinIdCol =
    row.kind === "episode"
      ? videoEpisodePerformers.episodeId
      : videoMoviePerformers.movieId;
  const tagIdCol =
    row.kind === "episode"
      ? videoEpisodeTags.episodeId
      : videoMovieTags.movieId;

  const perfRows = await db
    .select({
      id: performers.id,
      name: performers.name,
      gender: performers.gender,
      imageUrl: performers.imageUrl,
      imagePath: performers.imagePath,
      favorite: performers.favorite,
      isNsfw: performers.isNsfw,
    })
    .from(perfJoinTable)
    .innerJoin(
      performers,
      eq(
        row.kind === "episode"
          ? videoEpisodePerformers.performerId
          : videoMoviePerformers.performerId,
        performers.id,
      ),
    )
    .where(eq(joinIdCol, row.id));

  const tagRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      isNsfw: tags.isNsfw,
    })
    .from(tagJoinTable)
    .innerJoin(
      tags,
      eq(
        row.kind === "episode"
          ? videoEpisodeTags.tagId
          : videoMovieTags.tagId,
        tags.id,
      ),
    )
    .where(eq(tagIdCol, row.id));

  const hasVideo = !!(row.filePath && existsSync(row.filePath));

  return {
    id: row.id,
    title: row.title,
    details: row.details,
    date: row.date,
    rating: row.rating,
    url: null,
    urls: [],
    organized: row.organized,
    isNsfw: row.isNsfw,
    interactive: row.interactive,
    duration: row.duration,
    durationFormatted: formatDuration(row.duration),
    resolution: getResolutionLabel(row.height),
    width: row.width,
    height: row.height,
    frameRate: row.frameRate,
    bitRate: row.bitRate,
    codec: row.codec?.toUpperCase() ?? null,
    container: row.container,
    fileSize: row.fileSize,
    fileSizeFormatted: formatFileSize(row.fileSize),
    filePath: row.filePath,
    hasVideo,
    streamUrl: hasVideo ? `/video-stream/${row.id}/hls2/master.m3u8` : null,
    directStreamUrl: hasVideo ? `/video-stream/${row.id}/source` : null,
    thumbnailPath: row.thumbnailPath,
    cardThumbnailPath: row.cardThumbnailPath,
    previewPath: row.previewPath,
    spritePath: row.spritePath,
    trickplayVttPath: row.trickplayVttPath,
    playCount: row.playCount,
    orgasmCount: row.orgasmCount,
    hasSubtitles: false,
    sceneFolderId: row.seriesId,
    sceneFolderTitle: row.seriesTitle,
    episodeNumber: row.episodeNumber,
    playDuration: row.playDuration,
    resumeTime: row.resumeTime,
    lastPlayedAt: row.lastPlayedAt,
    studio: studioEmbed,
    performers: perfRows,
    tags: tagRows,
    markers: [],
    subtitleTracks: [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Mutations ────────────────────────────────────────────────

export async function updateVideoScene(id: string, body: UpdateVideoBody) {
  // Figure out which table owns the row
  const [ep] = await db
    .select({ id: videoEpisodes.id })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, id))
    .limit(1);
  const kind: "episode" | "movie" = ep ? "episode" : "movie";

  if (kind === "movie") {
    const [mv] = await db
      .select({ id: videoMovies.id })
      .from(videoMovies)
      .where(eq(videoMovies.id, id))
      .limit(1);
    if (!mv) throw new AppError(404, "Video not found");
  }

  const table = kind === "episode" ? videoEpisodes : videoMovies;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.details !== undefined) {
    // overview in video schema
    patch.overview = body.details;
  }
  if (body.date !== undefined) {
    patch[kind === "episode" ? "airDate" : "releaseDate"] = body.date;
  }
  if (body.rating !== undefined) patch.rating = body.rating;
  if (body.organized !== undefined) patch.organized = body.organized;
  if (body.isNsfw !== undefined) patch.isNsfw = body.isNsfw;
  if (body.orgasmCount !== undefined) patch.orgasmCount = body.orgasmCount;

  await db.update(table).set(patch).where(eq(table.id, id));
  return { ok: true as const, id };
}

export async function deleteVideoScene(id: string, _deleteFile?: boolean) {
  const [ep] = await db
    .select({ id: videoEpisodes.id })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, id))
    .limit(1);
  if (ep) {
    await db.delete(videoEpisodes).where(eq(videoEpisodes.id, id));
    return { ok: true as const };
  }
  const [mv] = await db
    .select({ id: videoMovies.id })
    .from(videoMovies)
    .where(eq(videoMovies.id, id))
    .limit(1);
  if (!mv) throw new AppError(404, "Video not found");
  await db.delete(videoMovies).where(eq(videoMovies.id, id));
  return { ok: true as const };
  // TODO: the legacy scene.service.ts also unlinks on-disk generated
  // assets and optionally the source file here. For the v1 /videos
  // route we only remove the database row; file deletion will land
  // alongside the unified-delete worker.
}

export async function resetVideoSceneMetadata(id: string) {
  const row = await loadVideoRow(id);
  if (!row) throw new AppError(404, "Video not found");
  const table = row.kind === "episode" ? videoEpisodes : videoMovies;
  await db
    .update(table)
    .set({
      title: row.title,
      overview: null,
      rating: null,
      organized: false,
      updatedAt: new Date(),
      ...(row.kind === "episode"
        ? { airDate: null }
        : { releaseDate: null }),
    })
    .where(eq(table.id, id));
  return { ok: true as const, id, title: row.title };
}
