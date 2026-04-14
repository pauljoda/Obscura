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
import { writeFile, mkdir, unlink, rm } from "node:fs/promises";
import path from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import {
  getGeneratedSceneDir,
  fileNameToTitle,
  runProcess,
  allSceneVideoGeneratedDiskPaths,
} from "@obscura/media-core";
import { enqueueQueueJob } from "../lib/job-enqueue";
import {
  assertDirExists,
  resolveCollisionSafePath,
  streamToFile,
  validateUpload,
} from "../lib/upload";
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
  tag?: string | string[];
  performer?: string | string[];
  studio?: string | string[];
  codec?: string | string[];
  interactive?: string;
  sceneFolderId?: string;
  folderScope?: "direct" | "subtree";
  uncategorized?: string;
}

export interface UpdateVideoBody {
  title?: string;
  details?: string | null;
  date?: string | null;
  rating?: number | null;
  url?: string | null;
  organized?: boolean;
  isNsfw?: boolean;
  orgasmCount?: number;
  studioName?: string | null;
  performerNames?: string[];
  tagNames?: string[];
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

    // Codec filter (case-insensitive substring against stored codec name).
    const codecValues = toArray(query.codec).map((c) => c.toLowerCase());
    if (codecValues.length > 0) {
      conds.push(
        or(
          ...codecValues.map((c) => ilike(videoEpisodes.codec, c)),
        )!,
      );
    }

    // Tag filter — join through video_episode_tags → tags.
    const tagValues = toArray(query.tag);
    if (tagValues.length > 0) {
      const tagRows = await db
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.name, tagValues));
      const tagIds = tagRows.map((t) => t.id);
      if (tagIds.length === 0) {
        conds.push(sql`false`);
      } else {
        const taggedEpisodeIds = await db
          .selectDistinct({ id: videoEpisodeTags.episodeId })
          .from(videoEpisodeTags)
          .where(inArray(videoEpisodeTags.tagId, tagIds));
        const ids = taggedEpisodeIds.map((r) => r.id);
        if (ids.length === 0) conds.push(sql`false`);
        else conds.push(inArray(videoEpisodes.id, ids));
      }
    }

    // Performer filter — join through video_episode_performers → performers.
    const performerValues = toArray(query.performer);
    if (performerValues.length > 0) {
      const perfRows = await db
        .select({ id: performers.id })
        .from(performers)
        .where(inArray(performers.name, performerValues));
      const perfIds = perfRows.map((p) => p.id);
      if (perfIds.length === 0) {
        conds.push(sql`false`);
      } else {
        const perfEpisodeIds = await db
          .selectDistinct({ id: videoEpisodePerformers.episodeId })
          .from(videoEpisodePerformers)
          .where(inArray(videoEpisodePerformers.performerId, perfIds));
        const ids = perfEpisodeIds.map((r) => r.id);
        if (ids.length === 0) conds.push(sql`false`);
        else conds.push(inArray(videoEpisodes.id, ids));
      }
    }

    // Studio filter — episodes inherit from series. Names are looked up
    // against studios.name; ids are also accepted for API parity.
    const studioValues = toArray(query.studio);
    if (studioValues.length > 0) {
      const studioRows = await db
        .select({ id: studios.id })
        .from(studios)
        .where(
          or(
            inArray(studios.id, studioValues),
            inArray(studios.name, studioValues),
          )!,
        );
      const studioIds = studioRows.map((s) => s.id);
      if (studioIds.length === 0) {
        conds.push(sql`false`);
      } else {
        const seriesRows = await db
          .select({ id: videoSeries.id })
          .from(videoSeries)
          .where(inArray(videoSeries.studioId, studioIds));
        const seriesIds = seriesRows.map((r) => r.id);
        if (seriesIds.length === 0) conds.push(sql`false`);
        else conds.push(inArray(videoEpisodes.seriesId, seriesIds));
      }
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

    // Codec filter
    const codecValues = toArray(query.codec).map((c) => c.toLowerCase());
    if (codecValues.length > 0) {
      conds.push(
        or(
          ...codecValues.map((c) => ilike(videoMovies.codec, c)),
        )!,
      );
    }

    // Tag filter
    const tagValues = toArray(query.tag);
    if (tagValues.length > 0) {
      const tagRows = await db
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.name, tagValues));
      const tagIds = tagRows.map((t) => t.id);
      if (tagIds.length === 0) {
        conds.push(sql`false`);
      } else {
        const taggedMovieIds = await db
          .selectDistinct({ id: videoMovieTags.movieId })
          .from(videoMovieTags)
          .where(inArray(videoMovieTags.tagId, tagIds));
        const ids = taggedMovieIds.map((r) => r.id);
        if (ids.length === 0) conds.push(sql`false`);
        else conds.push(inArray(videoMovies.id, ids));
      }
    }

    // Performer filter
    const performerValues = toArray(query.performer);
    if (performerValues.length > 0) {
      const perfRows = await db
        .select({ id: performers.id })
        .from(performers)
        .where(inArray(performers.name, performerValues));
      const perfIds = perfRows.map((p) => p.id);
      if (perfIds.length === 0) {
        conds.push(sql`false`);
      } else {
        const perfMovieIds = await db
          .selectDistinct({ id: videoMoviePerformers.movieId })
          .from(videoMoviePerformers)
          .where(inArray(videoMoviePerformers.performerId, perfIds));
        const ids = perfMovieIds.map((r) => r.id);
        if (ids.length === 0) conds.push(sql`false`);
        else conds.push(inArray(videoMovies.id, ids));
      }
    }

    // Studio filter — movies have studioId directly.
    const studioValues = toArray(query.studio);
    if (studioValues.length > 0) {
      const studioRows = await db
        .select({ id: studios.id })
        .from(studios)
        .where(
          or(
            inArray(studios.id, studioValues),
            inArray(studios.name, studioValues),
          )!,
        );
      const studioIds = studioRows.map((s) => s.id);
      if (studioIds.length === 0) {
        conds.push(sql`false`);
      } else {
        conds.push(inArray(videoMovies.studioId, studioIds));
      }
    }

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

  await db.transaction(async (tx) => {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) patch.title = body.title;
    if (body.details !== undefined) patch.overview = body.details;
    if (body.date !== undefined) {
      patch[kind === "episode" ? "airDate" : "releaseDate"] = body.date;
    }
    if (body.rating !== undefined) patch.rating = body.rating;
    if (body.organized !== undefined) patch.organized = body.organized;
    if (body.isNsfw !== undefined) patch.isNsfw = body.isNsfw;
    if (body.orgasmCount !== undefined) patch.orgasmCount = body.orgasmCount;

    // Studio: movies carry studioId directly; episodes inherit it from their
    // series, so a studio write on an episode updates the series row.
    if (body.studioName !== undefined) {
      let resolvedStudioId: string | null = null;
      if (body.studioName && body.studioName.trim()) {
        const [existingStudio] = await tx
          .select({ id: studios.id })
          .from(studios)
          .where(ilike(studios.name, body.studioName.trim()))
          .limit(1);
        resolvedStudioId =
          existingStudio?.id ??
          (
            await tx
              .insert(studios)
              .values({ name: body.studioName.trim() })
              .returning({ id: studios.id })
          )[0].id;
      }
      if (kind === "movie") {
        patch.studioId = resolvedStudioId;
      } else {
        // Update series row instead.
        const [epRow] = await tx
          .select({ seriesId: videoEpisodes.seriesId })
          .from(videoEpisodes)
          .where(eq(videoEpisodes.id, id))
          .limit(1);
        if (epRow?.seriesId) {
          await tx
            .update(videoSeries)
            .set({ studioId: resolvedStudioId, updatedAt: new Date() })
            .where(eq(videoSeries.id, epRow.seriesId));
        }
      }
    }

    await tx.update(table).set(patch).where(eq(table.id, id));

    // Performers / tags — join tables depend on kind
    const perfJoin =
      kind === "episode" ? videoEpisodePerformers : videoMoviePerformers;
    const perfIdCol =
      kind === "episode"
        ? videoEpisodePerformers.episodeId
        : videoMoviePerformers.movieId;
    const tagJoin =
      kind === "episode" ? videoEpisodeTags : videoMovieTags;
    const tagIdCol =
      kind === "episode"
        ? videoEpisodeTags.episodeId
        : videoMovieTags.movieId;

    if (body.performerNames !== undefined) {
      await tx.delete(perfJoin).where(eq(perfIdCol, id));
      for (const name of body.performerNames) {
        if (!name.trim()) continue;
        const [existingPerf] = await tx
          .select({ id: performers.id })
          .from(performers)
          .where(ilike(performers.name, name.trim()))
          .limit(1);
        const performerId =
          existingPerf?.id ??
          (
            await tx
              .insert(performers)
              .values({ name: name.trim() })
              .returning({ id: performers.id })
          )[0].id;
        if (kind === "episode") {
          await tx
            .insert(videoEpisodePerformers)
            .values({ episodeId: id, performerId })
            .onConflictDoNothing();
        } else {
          await tx
            .insert(videoMoviePerformers)
            .values({ movieId: id, performerId })
            .onConflictDoNothing();
        }
      }
    }

    if (body.tagNames !== undefined) {
      await tx.delete(tagJoin).where(eq(tagIdCol, id));
      for (const name of body.tagNames) {
        if (!name.trim()) continue;
        const [existingTag] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(ilike(tags.name, name.trim()))
          .limit(1);
        const tagId =
          existingTag?.id ??
          (
            await tx
              .insert(tags)
              .values({ name: name.trim() })
              .returning({ id: tags.id })
          )[0].id;
        if (kind === "episode") {
          await tx
            .insert(videoEpisodeTags)
            .values({ episodeId: id, tagId })
            .onConflictDoNothing();
        } else {
          await tx
            .insert(videoMovieTags)
            .values({ movieId: id, tagId })
            .onConflictDoNothing();
        }
      }
    }
  });

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

// ─── Shared video-entity helpers ──────────────────────────────

export type VideoEntityKind = "video_episode" | "video_movie";

/**
 * Resolve a video id to its owning table ("episode" or "movie").
 * Returns null when neither table has a matching row.
 */
export async function findVideoEntity(
  id: string,
): Promise<{ kind: VideoEntityKind; title: string; filePath: string | null } | null> {
  const [ep] = await db
    .select({
      id: videoEpisodes.id,
      title: videoEpisodes.title,
      filePath: videoEpisodes.filePath,
    })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, id))
    .limit(1);
  if (ep) {
    return {
      kind: "video_episode",
      title: ep.title ?? "Untitled Episode",
      filePath: ep.filePath,
    };
  }
  const [mv] = await db
    .select({
      id: videoMovies.id,
      title: videoMovies.title,
      filePath: videoMovies.filePath,
    })
    .from(videoMovies)
    .where(eq(videoMovies.id, id))
    .limit(1);
  if (mv) {
    return {
      kind: "video_movie",
      title: mv.title,
      filePath: mv.filePath,
    };
  }
  return null;
}

function videoEntityTable(kind: VideoEntityKind) {
  return kind === "video_episode" ? videoEpisodes : videoMovies;
}

// ─── Thumbnails ───────────────────────────────────────────────

async function saveCustomVideoThumbnail(
  id: string,
  buffer: Buffer,
): Promise<{ thumbnailPath: string }> {
  const genDir = getGeneratedSceneDir(id);
  await mkdir(genDir, { recursive: true });
  const thumbPath = path.join(genDir, "thumbnail-custom.jpg");
  await writeFile(thumbPath, buffer);

  const entity = await findVideoEntity(id);
  if (!entity) throw new AppError(404, "Video not found");
  const assetUrl = `/assets/scenes/${id}/thumb-custom`;
  const table = videoEntityTable(entity.kind);
  await db
    .update(table)
    .set({
      thumbnailPath: assetUrl,
      cardThumbnailPath: null,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id));
  return { thumbnailPath: assetUrl };
}

export async function setCustomVideoThumbnail(id: string, buffer: Buffer) {
  const entity = await findVideoEntity(id);
  if (!entity) throw new AppError(404, "Video not found");
  return saveCustomVideoThumbnail(id, buffer);
}

export async function setCustomVideoThumbnailFromUrl(
  id: string,
  imageUrl: string,
) {
  if (!imageUrl || !imageUrl.startsWith("http")) {
    throw new AppError(400, "Invalid image URL");
  }
  const entity = await findVideoEntity(id);
  if (!entity) throw new AppError(404, "Video not found");
  let buffer: Buffer;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new AppError(502, `Failed to fetch image: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, "Failed to download image");
  }
  return saveCustomVideoThumbnail(id, buffer);
}

export async function setCustomVideoThumbnailFromFrame(
  id: string,
  requestedSeconds: number,
) {
  if (!Number.isFinite(requestedSeconds)) {
    throw new AppError(400, "Invalid frame time");
  }
  const entity = await findVideoEntity(id);
  if (!entity) throw new AppError(404, "Video not found");
  if (!entity.filePath || !existsSync(entity.filePath)) {
    throw new AppError(404, "Video file not found");
  }

  // Load duration for clamping.
  const table = videoEntityTable(entity.kind);
  const [row] = await db
    .select({ duration: table.duration })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  const duration = row?.duration ?? null;
  const maxSeconds =
    duration && duration > 0 ? Math.max(0, duration - 0.05) : null;
  const seconds =
    maxSeconds != null
      ? Math.min(Math.max(0, requestedSeconds), maxSeconds)
      : Math.max(0, requestedSeconds);

  const genDir = getGeneratedSceneDir(id);
  await mkdir(genDir, { recursive: true });
  const thumbPath = path.join(genDir, "thumbnail-custom.jpg");

  try {
    await runProcess("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      entity.filePath,
      "-ss",
      seconds.toFixed(3),
      "-frames:v",
      "1",
      "-q:v",
      "2",
      thumbPath,
    ]);
  } catch {
    throw new AppError(500, "Failed to generate thumbnail from frame");
  }

  const assetUrl = `/assets/scenes/${id}/thumb-custom`;
  await db
    .update(table)
    .set({
      thumbnailPath: assetUrl,
      cardThumbnailPath: null,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id));

  return { ok: true as const, thumbnailPath: assetUrl, seconds };
}

export async function resetVideoThumbnail(id: string) {
  const entity = await findVideoEntity(id);
  if (!entity) throw new AppError(404, "Video not found");

  const customPath = path.join(
    getGeneratedSceneDir(id),
    "thumbnail-custom.jpg",
  );
  try {
    if (existsSync(customPath)) await unlink(customPath);
  } catch {
    // non-fatal
  }

  const defaultUrl = `/assets/scenes/${id}/thumb`;
  const defaultCardUrl = `/assets/scenes/${id}/card`;
  const table = videoEntityTable(entity.kind);
  await db
    .update(table)
    .set({
      thumbnailPath: defaultUrl,
      cardThumbnailPath: defaultCardUrl,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id));

  return { ok: true as const, thumbnailPath: defaultUrl };
}

// ─── Play / orgasm tracking ───────────────────────────────────

export async function recordVideoPlay(id: string) {
  const entity = await findVideoEntity(id);
  if (!entity) throw new AppError(404, "Video not found");
  const table = videoEntityTable(entity.kind);
  await db
    .update(table)
    .set({
      playCount: sql`${table.playCount} + 1`,
      lastPlayedAt: new Date(),
    })
    .where(eq(table.id, id));
  return { ok: true as const };
}

export async function recordVideoOrgasm(id: string) {
  const entity = await findVideoEntity(id);
  if (!entity) throw new AppError(404, "Video not found");
  const table = videoEntityTable(entity.kind);
  const [updated] = await db
    .update(table)
    .set({
      orgasmCount: sql`${table.orgasmCount} + 1`,
    })
    .where(eq(table.id, id))
    .returning({ orgasmCount: table.orgasmCount });
  return { ok: true as const, orgasmCount: updated.orgasmCount };
}

// ─── Preview rebuild ──────────────────────────────────────────

export async function rebuildVideoPreview(id: string) {
  const entity = await findVideoEntity(id);
  if (!entity) throw new AppError(404, "Video not found");
  if (!entity.filePath) {
    throw new AppError(400, "Video has no file on disk");
  }

  // Best-effort: remove existing derivative files so the rebuild
  // actually replaces rather than reuses.
  for (const p of allSceneVideoGeneratedDiskPaths(id, entity.filePath)) {
    try {
      if (existsSync(p)) await unlink(p);
    } catch {
      // ignore
    }
  }

  const table = videoEntityTable(entity.kind);
  await db
    .update(table)
    .set({
      thumbnailPath: null,
      cardThumbnailPath: null,
      previewPath: null,
      spritePath: null,
      trickplayVttPath: null,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id));

  const result = await enqueueQueueJob({
    queueName: "preview",
    jobName: `${entity.kind}-preview`,
    data: {
      entityKind: entity.kind,
      entityId: id,
    },
    target: {
      type: entity.kind,
      id,
      label: entity.title,
    },
    trigger: {
      by: "manual",
      kind: "force-rebuild",
      label: "Force rebuild preview",
    },
  });

  return { ok: true as const, jobId: result?.id ?? null };
}

// ─── Upload ───────────────────────────────────────────────────

export async function uploadVideoMovie(
  libraryRootId: string,
  file: MultipartFile,
) {
  const [root] = await db
    .select()
    .from(schema.libraryRoots)
    .where(eq(schema.libraryRoots.id, libraryRootId))
    .limit(1);
  if (!root) {
    throw new AppError(404, "Library root not found");
  }
  if (!root.scanVideos) {
    throw new AppError(
      400,
      "Selected library root is not configured to receive video uploads",
    );
  }
  if (!root.enabled) {
    throw new AppError(400, "Selected library root is disabled");
  }
  if (!root.path) {
    throw new AppError(500, "Library root is missing a filesystem path");
  }

  await assertDirExists(root.path);
  const { safeName } = validateUpload(file, { category: "video" });
  const dest = await resolveCollisionSafePath(root.path, safeName);
  const { bytesWritten } = await streamToFile(file, dest);

  const [created] = await db
    .insert(videoMovies)
    .values({
      libraryRootId: root.id,
      title: fileNameToTitle(dest),
      filePath: dest,
      fileSize: bytesWritten,
      organized: false,
      isNsfw: root.isNsfw ?? false,
    })
    .returning({
      id: videoMovies.id,
      title: videoMovies.title,
      filePath: videoMovies.filePath,
    });
  if (!created) {
    throw new AppError(500, "Failed to create video movie row after upload");
  }

  const target = {
    type: "video_movie",
    id: created.id,
    label: created.title,
  };
  const trigger = {
    by: "manual" as const,
    label: `Queued after upload to ${root.label}`,
  };
  await enqueueQueueJob({
    queueName: "media-probe",
    jobName: "video_movie-media-probe",
    data: { entityKind: "video_movie", entityId: created.id },
    target,
    trigger,
  });
  await enqueueQueueJob({
    queueName: "fingerprint",
    jobName: "video_movie-fingerprint",
    data: { entityKind: "video_movie", entityId: created.id },
    target,
    trigger,
  });
  await enqueueQueueJob({
    queueName: "preview",
    jobName: "video_movie-preview",
    data: { entityKind: "video_movie", entityId: created.id },
    target,
    trigger,
  });

  return {
    id: created.id,
    title: created.title,
    filePath: created.filePath,
    libraryRootId: root.id,
  };
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
