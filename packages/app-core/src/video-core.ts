import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  allVideoGeneratedDiskPaths,
  fileNameToTitle,
  getGeneratedVideoDir,
  resolveExistingMediaPath,
  runProcess,
} from "@obscura/media-core";
import {
  formatDuration,
  formatFileSize,
  getResolutionLabel,
  type QueueName,
} from "@obscura/contracts";
import { schema, type AppDb } from "@obscura/db";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  InternalError,
  NotFoundError,
  UpstreamError,
  ValidationError,
} from "./errors";
import {
  MAX_ENTITY_LIST_LIMIT,
  buildResolutionConditions,
  parsePagination,
  toArray,
  type SortConfig,
} from "./media-query-helpers";
import {
  enqueueQueueJob,
  type QueueTarget,
  type QueueTrigger,
} from "./queue-writes";
import {
  videoEpisodeVisibleSql,
  videoMovieVisibleSql,
} from "./library-root-visibility";
import {
  assertDirExists,
  resolveCollisionSafePath,
  validateUploadMetadata,
  writeUploadBuffer,
  type UploadFileInput,
} from "./upload-utils";

const {
  libraryRoots,
  performers,
  studios,
  tags,
  videoEpisodePerformers,
  videoEpisodeTags,
  videoEpisodes,
  videoMarkers,
  videoMoviePerformers,
  videoMovieTags,
  videoMovies,
  videoSeasons,
  videoSeries,
  videoSeriesPerformers,
  videoSubtitles,
} = schema;

export interface ListVideosQuery {
  view?: "full" | "card";
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
  videoSeriesId?: string;
  seriesScope?: "direct" | "subtree";
  uncategorized?: string;
  seasonNumber?: string;
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
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  absoluteEpisodeNumber?: number | null;
}

import type { VideoEntityKind } from "./video-markers";

export interface StreamedVideoUploadInput {
  filename: string;
  mimetype?: string | null;
  persist: (dest: string) => Promise<{ bytesWritten: number }>;
}

export type VideoUploadInput = UploadFileInput | StreamedVideoUploadInput;

export interface VideoQueueJobInput {
  queueName: QueueName;
  jobName: string;
  data: Record<string, unknown>;
  target: QueueTarget;
  trigger?: QueueTrigger;
}

export interface VideoWriteDeps {
  enqueueJob?: (input: VideoQueueJobInput) => Promise<{ id: string } | null>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface VideoRow {
  kind: "episode" | "movie";
  id: string;
  title: string;
  details: string | null;
  date: string | null;
  rating: number | null;
  url: string | null;
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
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteEpisodeNumber: number | null;
}

type MixedVideoSortRow = Pick<
  VideoRow,
  | "id"
  | "kind"
  | "title"
  | "createdAt"
  | "rating"
  | "duration"
  | "fileSize"
  | "playCount"
  | "date"
  | "seasonNumber"
  | "episodeNumber"
  | "absoluteEpisodeNumber"
>;

interface VideoSourceRow extends VideoRow {
  interactive: boolean;
  frameRate: number | null;
  bitRate: number | null;
  previewPath: string | null;
  playDuration: number | null;
  resumeTime: number | null;
  lastPlayedAt: Date | null;
}

function normalizeRole(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toVideoListItem(row: VideoRow) {
  const resolvedFilePath = resolveExistingMediaPath(row.filePath);
  const hasVideo = resolvedFilePath !== null;
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
    filePath: resolvedFilePath ?? row.filePath,
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
    videoSeriesId: row.seriesId,
    videoSeriesTitle: row.seriesTitle,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
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

function toVideoCardListItem(row: VideoRow) {
  return {
    id: row.id,
    title: row.title,
    rating: row.rating,
    organized: row.organized,
    isNsfw: row.isNsfw,
    duration: row.duration,
    durationFormatted: formatDuration(row.duration),
    resolution: getResolutionLabel(row.height),
    codec: row.codec?.toUpperCase() ?? null,
    fileSizeFormatted: formatFileSize(row.fileSize),
    thumbnailPath: row.thumbnailPath,
    cardThumbnailPath: row.cardThumbnailPath,
    spritePath: row.spritePath,
    trickplayVttPath: row.trickplayVttPath,
    playCount: row.playCount,
    videoSeriesId: row.seriesId,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    hasSubtitles: false,
    performers: [] as {
      id: string;
      name: string;
      imagePath?: string | null;
      isNsfw?: boolean;
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
    episode: "asc",
  };
  const sortKey = query.sort ?? "recent";

  if (sortKey === "episode") {
    const dir =
      query.order === "asc" || query.order === "desc" ? query.order : "asc";
    if (kind === "episode") {
      const dirFn = dir === "asc" ? asc : desc;
      return [
        dirFn(videoEpisodes.seasonNumber),
        dirFn(videoEpisodes.episodeNumber),
        dirFn(videoEpisodes.absoluteEpisodeNumber),
        asc(videoEpisodes.createdAt),
      ];
    }
    return [dir === "asc" ? asc(table.createdAt) : desc(table.createdAt)];
  }

  const col = columns[sortKey] ?? table.createdAt;
  const dir =
    query.order === "asc" || query.order === "desc"
      ? query.order
      : (defaultDir[sortKey] ?? "desc");
  return [dir === "asc" ? asc(col) : desc(col)];
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  dir: "asc" | "desc",
) {
  const leftValue = left ?? Number.NEGATIVE_INFINITY;
  const rightValue = right ?? Number.NEGATIVE_INFINITY;
  return dir === "asc" ? leftValue - rightValue : rightValue - leftValue;
}

function compareNullableStrings(
  left: string | null,
  right: string | null,
  dir: "asc" | "desc",
) {
  const leftValue = left ?? "";
  const rightValue = right ?? "";
  return dir === "asc"
    ? leftValue.localeCompare(rightValue)
    : rightValue.localeCompare(leftValue);
}

function compareCreatedAt(
  left: MixedVideoSortRow,
  right: MixedVideoSortRow,
  dir: "asc" | "desc",
) {
  const leftValue = left.createdAt?.getTime?.() ?? 0;
  const rightValue = right.createdAt?.getTime?.() ?? 0;
  return dir === "asc" ? leftValue - rightValue : rightValue - leftValue;
}

export function sortMergedVideos<T extends MixedVideoSortRow>(
  rows: T[],
  query: Pick<ListVideosQuery, "sort" | "order">,
): T[] {
  const sortKey = query.sort ?? "recent";
  const dir: "asc" | "desc" =
    query.order === "asc" || query.order === "desc"
      ? query.order
      : sortKey === "title" || sortKey === "episode"
        ? "asc"
        : "desc";

  return [...rows].sort((left, right) => {
    let cmp = 0;

    switch (sortKey) {
      case "title":
        cmp = compareNullableStrings(left.title, right.title, dir);
        break;
      case "duration":
        cmp = compareNullableNumbers(left.duration, right.duration, dir);
        break;
      case "size":
        cmp = compareNullableNumbers(left.fileSize, right.fileSize, dir);
        break;
      case "rating":
        cmp = compareNullableNumbers(left.rating, right.rating, dir);
        break;
      case "date":
        cmp = compareNullableStrings(left.date, right.date, dir);
        break;
      case "plays":
        cmp = compareNullableNumbers(left.playCount, right.playCount, dir);
        break;
      case "episode":
        cmp = compareNullableNumbers(left.seasonNumber, right.seasonNumber, dir);
        if (cmp === 0) {
          cmp = compareNullableNumbers(left.episodeNumber, right.episodeNumber, dir);
        }
        if (cmp === 0) {
          cmp = compareNullableNumbers(
            left.absoluteEpisodeNumber,
            right.absoluteEpisodeNumber,
            dir,
          );
        }
        break;
      case "recent":
      default:
        cmp = compareCreatedAt(left, right, dir);
        break;
    }

    if (cmp !== 0) return cmp;
    return compareCreatedAt(left, right, "desc");
  });
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

export function defaultEnqueueJob(db: AppDb) {
  return ({ queueName, data, target, trigger }: VideoQueueJobInput) =>
    enqueueQueueJob(db, { queueName, data, target, trigger });
}

function isBufferedUpload(file: VideoUploadInput): file is UploadFileInput {
  return "buffer" in file;
}

async function persistUploadedVideo(dest: string, file: VideoUploadInput) {
  if (isBufferedUpload(file)) {
    return writeUploadBuffer(dest, file.buffer);
  }
  return file.persist(dest);
}

async function loadEpisodeRow(
  db: AppDb,
  id: string,
): Promise<VideoSourceRow | null> {
  const [row] = await db
    .select()
    .from(videoEpisodes)
    .leftJoin(videoSeries, eq(videoEpisodes.seriesId, videoSeries.id))
    .where(and(eq(videoEpisodes.id, id), videoEpisodeVisibleSql(videoEpisodes.seriesId)))
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
    url: ep.url,
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
    seasonNumber: ep.seasonNumber,
    episodeNumber: ep.episodeNumber,
    absoluteEpisodeNumber: ep.absoluteEpisodeNumber,
    interactive: false,
    frameRate: ep.frameRate,
    bitRate: ep.bitRate,
    previewPath: ep.previewPath,
    playDuration: ep.playDuration,
    resumeTime: ep.resumeTime,
    lastPlayedAt: ep.lastPlayedAt,
  };
}

async function loadMovieRow(
  db: AppDb,
  id: string,
): Promise<VideoSourceRow | null> {
  const [mv] = await db
    .select()
    .from(videoMovies)
    .where(and(eq(videoMovies.id, id), videoMovieVisibleSql(videoMovies.libraryRootId)))
    .limit(1);
  if (!mv) return null;
  return {
    kind: "movie",
    id: mv.id,
    title: mv.title,
    details: mv.overview,
    date: mv.releaseDate,
    rating: mv.rating,
    url: mv.url,
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
    seasonNumber: null,
    episodeNumber: null,
    absoluteEpisodeNumber: null,
    interactive: false,
    frameRate: mv.frameRate,
    bitRate: mv.bitRate,
    previewPath: mv.previewPath,
    playDuration: mv.playDuration,
    resumeTime: mv.resumeTime,
    lastPlayedAt: mv.lastPlayedAt,
  };
}

async function loadVideoRow(db: AppDb, id: string): Promise<VideoSourceRow | null> {
  return (await loadEpisodeRow(db, id)) ?? (await loadMovieRow(db, id));
}

export async function findVideoEntity(
  db: AppDb,
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

export function videoEntityTable(kind: VideoEntityKind) {
  return kind === "video_episode" ? videoEpisodes : videoMovies;
}

export async function listVideosRead(db: AppDb, query: ListVideosQuery) {
  const cardView = query.view === "card";
  const { limit, offset } = parsePagination(
    query.limit,
    query.offset,
    50,
    MAX_ENTITY_LIST_LIMIT,
  );
  const mixedWindowSize = limit + offset;

  if (query.videoSeriesId && query.uncategorized === "true") {
    throw new ValidationError(
      "videoSeriesId and uncategorized cannot both be set",
    );
  }

  const wantEpisodes = query.uncategorized !== "true";
  const wantMovies = !query.videoSeriesId;

  let episodes: VideoRow[] = [];
  let episodeCount = 0;
  if (wantEpisodes) {
    const conds: SQL[] = [];
    conds.push(videoEpisodeVisibleSql(videoEpisodes.seriesId));
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
    if (query.organized === "false")
      conds.push(eq(videoEpisodes.organized, false));
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

    if (query.videoSeriesId) {
      conds.push(eq(videoEpisodes.seriesId, query.videoSeriesId));
      if (query.seasonNumber != null && query.seasonNumber !== "") {
        const n = Number(query.seasonNumber);
        if (Number.isInteger(n) && n >= 0) {
          conds.push(eq(videoEpisodes.seasonNumber, n));
        }
      }
    }

    const codecValues = toArray(query.codec).map((c) => c.toLowerCase());
    if (codecValues.length > 0) {
      conds.push(
        or(...codecValues.map((c) => ilike(videoEpisodes.codec, c)))!,
      );
    }

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
        const seriesIds = await db
          .selectDistinct({ id: videoSeriesPerformers.seriesId })
          .from(videoSeriesPerformers)
          .where(inArray(videoSeriesPerformers.performerId, perfIds));
        let seriesEpisodeIds: { id: string }[] = [];
        if (seriesIds.length > 0) {
          seriesEpisodeIds = await db
            .selectDistinct({ id: videoEpisodes.id })
            .from(videoEpisodes)
            .where(
              inArray(
                videoEpisodes.seriesId,
                seriesIds.map((s) => s.id),
              ),
            );
        }
        const allIds = new Set([
          ...perfEpisodeIds.map((r) => r.id),
          ...seriesEpisodeIds.map((r) => r.id),
        ]);
        if (allIds.size === 0) conds.push(sql`false`);
        else conds.push(inArray(videoEpisodes.id, [...allIds]));
      }
    }

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
        url: videoEpisodes.url,
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
        seasonNumber: videoEpisodes.seasonNumber,
        episodeNumber: videoEpisodes.episodeNumber,
        absoluteEpisodeNumber: videoEpisodes.absoluteEpisodeNumber,
      })
      .from(videoEpisodes)
      .leftJoin(videoSeries, eq(videoEpisodes.seriesId, videoSeries.id))
      .where(where)
      .orderBy(...parseSort(query, "episode"))
      .limit(wantMovies ? mixedWindowSize : limit)
      .offset(wantMovies ? 0 : offset);

    episodes = rows.map((r) => ({
      kind: "episode",
      id: r.id,
      title: r.title ?? "Untitled Episode",
      details: r.overview,
      date: r.airDate,
      rating: r.rating,
      url: r.url,
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
      seasonNumber: r.seasonNumber,
      episodeNumber: r.episodeNumber,
      absoluteEpisodeNumber: r.absoluteEpisodeNumber,
    }));
  }

  let movies: VideoRow[] = [];
  let movieCount = 0;
  if (wantMovies) {
    const conds: SQL[] = [];
    conds.push(videoMovieVisibleSql(videoMovies.libraryRootId));
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
        and(eq(videoMovies.playCount, 0), isNull(videoMovies.lastPlayedAt))!,
      );
    }
    conds.push(...buildCommonDateFilters(query, "movie"));

    const codecValues = toArray(query.codec).map((c) => c.toLowerCase());
    if (codecValues.length > 0) {
      conds.push(or(...codecValues.map((c) => ilike(videoMovies.codec, c)))!);
    }

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
      .orderBy(...parseSort(query, "movie"))
      .limit(wantEpisodes ? mixedWindowSize : limit)
      .offset(wantEpisodes ? 0 : offset);

    movies = rows.map((r) => ({
      kind: "movie",
      id: r.id,
      title: r.title,
      details: r.overview,
      date: r.releaseDate,
      rating: r.rating,
      url: r.url,
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
      seasonNumber: null,
      episodeNumber: null,
      absoluteEpisodeNumber: null,
    }));
  }

  const mixedResults = episodes.length > 0 && movies.length > 0;
  const merged = mixedResults
    ? sortMergedVideos([...episodes, ...movies], query)
    : [...episodes, ...movies];
  const sliced = mixedResults ? merged.slice(offset, offset + limit) : merged.slice(0, limit);
  if (cardView) {
    return {
      videos: sliced.map(toVideoCardListItem),
      total: episodeCount + movieCount,
      limit,
      offset,
    };
  }
  const items = sliced.map(toVideoListItem);

  const visibleEpisodeIds = sliced
    .filter((r) => r.kind === "episode")
    .map((r) => r.id);
  const visibleMovieIds = sliced
    .filter((r) => r.kind === "movie")
    .map((r) => r.id);

  if (visibleEpisodeIds.length > 0 || visibleMovieIds.length > 0) {
    const [epPerfRows, mvPerfRows, epTagRows, mvTagRows, subtitleRows] =
      await Promise.all([
        visibleEpisodeIds.length > 0
          ? db
              .select({
                episodeId: videoEpisodePerformers.episodeId,
                id: performers.id,
                name: performers.name,
                imagePath: performers.imagePath,
                isNsfw: performers.isNsfw,
              })
              .from(videoEpisodePerformers)
              .innerJoin(
                performers,
                eq(performers.id, videoEpisodePerformers.performerId),
              )
              .where(inArray(videoEpisodePerformers.episodeId, visibleEpisodeIds))
          : Promise.resolve([]),
        visibleMovieIds.length > 0
          ? db
              .select({
                movieId: videoMoviePerformers.movieId,
                id: performers.id,
                name: performers.name,
                imagePath: performers.imagePath,
                isNsfw: performers.isNsfw,
              })
              .from(videoMoviePerformers)
              .innerJoin(
                performers,
                eq(performers.id, videoMoviePerformers.performerId),
              )
              .where(inArray(videoMoviePerformers.movieId, visibleMovieIds))
          : Promise.resolve([]),
        visibleEpisodeIds.length > 0
          ? db
              .select({
                episodeId: videoEpisodeTags.episodeId,
                id: tags.id,
                name: tags.name,
                isNsfw: tags.isNsfw,
              })
              .from(videoEpisodeTags)
              .innerJoin(tags, eq(tags.id, videoEpisodeTags.tagId))
              .where(inArray(videoEpisodeTags.episodeId, visibleEpisodeIds))
          : Promise.resolve([]),
        visibleMovieIds.length > 0
          ? db
              .select({
                movieId: videoMovieTags.movieId,
                id: tags.id,
                name: tags.name,
                isNsfw: tags.isNsfw,
              })
              .from(videoMovieTags)
              .innerJoin(tags, eq(tags.id, videoMovieTags.tagId))
              .where(inArray(videoMovieTags.movieId, visibleMovieIds))
          : Promise.resolve([]),
        [...visibleEpisodeIds, ...visibleMovieIds].length > 0
          ? db
              .select({ entityId: videoSubtitles.entityId })
              .from(videoSubtitles)
              .where(
                inArray(videoSubtitles.entityId, [
                  ...visibleEpisodeIds,
                  ...visibleMovieIds,
                ]),
              )
          : Promise.resolve([]),
      ]);

    const byId = new Map(items.map((item) => [item.id, item]));
    for (const r of epPerfRows) {
      const item = byId.get(r.episodeId);
      if (!item) continue;
      item.performers.push({
        id: r.id,
        name: r.name,
        imagePath: r.imagePath,
        isNsfw: r.isNsfw,
      });
    }
    for (const r of mvPerfRows) {
      const item = byId.get(r.movieId);
      if (!item) continue;
      item.performers.push({
        id: r.id,
        name: r.name,
        imagePath: r.imagePath,
        isNsfw: r.isNsfw,
      });
    }
    for (const r of epTagRows) {
      const item = byId.get(r.episodeId);
      if (!item) continue;
      item.tags.push({ id: r.id, name: r.name, isNsfw: r.isNsfw });
    }
    for (const r of mvTagRows) {
      const item = byId.get(r.movieId);
      if (!item) continue;
      item.tags.push({ id: r.id, name: r.name, isNsfw: r.isNsfw });
    }
    const hasSubtitlesById = new Set<string>();
    for (const r of subtitleRows) hasSubtitlesById.add(r.entityId);
    for (const item of items) {
      if (hasSubtitlesById.has(item.id)) item.hasSubtitles = true;
    }
  }

  return {
    videos: items,
    total: episodeCount + movieCount,
    limit,
    offset,
  };
}

export async function getVideoStatsRead(db: AppDb, sfwOnly: boolean) {
  const epWhere = sfwOnly
    ? and(videoEpisodeVisibleSql(videoEpisodes.seriesId), ne(videoEpisodes.isNsfw, true))
    : videoEpisodeVisibleSql(videoEpisodes.seriesId);
  const mvWhere = sfwOnly
    ? and(videoMovieVisibleSql(videoMovies.libraryRootId), ne(videoMovies.isNsfw, true))
    : videoMovieVisibleSql(videoMovies.libraryRootId);

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

export async function getVideoDetailRead(db: AppDb, id: string) {
  const row = await loadVideoRow(db, id);
  if (!row) throw new NotFoundError("Video not found");

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

  const perfJoinTable =
    row.kind === "episode" ? videoEpisodePerformers : videoMoviePerformers;
  const tagJoinTable =
    row.kind === "episode" ? videoEpisodeTags : videoMovieTags;
  const joinIdCol =
    row.kind === "episode"
      ? videoEpisodePerformers.episodeId
      : videoMoviePerformers.movieId;
  const tagIdCol =
    row.kind === "episode" ? videoEpisodeTags.episodeId : videoMovieTags.movieId;
  const characterCol =
    row.kind === "episode"
      ? videoEpisodePerformers.character
      : videoMoviePerformers.character;

  const perfRows = await db
    .select({
      id: performers.id,
      name: performers.name,
      gender: performers.gender,
      imageUrl: performers.imageUrl,
      imagePath: performers.imagePath,
      favorite: performers.favorite,
      isNsfw: performers.isNsfw,
      character: characterCol,
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
    .where(eq(joinIdCol, row.id))
    .orderBy(
      asc(
        row.kind === "episode"
          ? videoEpisodePerformers.order
          : videoMoviePerformers.order,
      ),
      asc(performers.name),
    );

  type VideoPerformerDetail = (typeof perfRows)[number] & {
    roleSource?: "episode" | "series" | "movie" | null;
  };
  let performerDetails: VideoPerformerDetail[] = perfRows.map((perfRow) => ({
    ...perfRow,
    character: normalizeRole(perfRow.character),
    roleSource: row.kind === "movie" ? ("movie" as const) : null,
  }));

  if (row.kind === "episode" && row.seriesId) {
    const seriesPerfRows = await db
      .select({
        id: performers.id,
        name: performers.name,
        gender: performers.gender,
        imageUrl: performers.imageUrl,
        imagePath: performers.imagePath,
        favorite: performers.favorite,
        isNsfw: performers.isNsfw,
        character: videoSeriesPerformers.character,
      })
      .from(videoSeriesPerformers)
      .innerJoin(
        performers,
        eq(videoSeriesPerformers.performerId, performers.id),
      )
      .where(eq(videoSeriesPerformers.seriesId, row.seriesId))
      .orderBy(asc(videoSeriesPerformers.order), asc(performers.name));

    const episodeById = new Map(perfRows.map((p) => [p.id, p]));
    performerDetails = seriesPerfRows.map((seriesPerf) => {
      const episodePerf = episodeById.get(seriesPerf.id);
      if (!episodePerf) {
        return {
          ...seriesPerf,
          character: normalizeRole(seriesPerf.character),
          roleSource: "series" as const,
        };
      }

      episodeById.delete(seriesPerf.id);
      const episodeCharacter = normalizeRole(episodePerf.character);
      const seriesCharacter = normalizeRole(seriesPerf.character);

      return {
        ...episodePerf,
        character: episodeCharacter ?? seriesCharacter,
        roleSource:
          episodeCharacter !== null ? ("episode" as const) : ("series" as const),
      };
    });

    for (const episodePerf of episodeById.values()) {
      performerDetails.push({
        ...episodePerf,
        character: normalizeRole(episodePerf.character),
        roleSource: "episode" as const,
      });
    }
  }

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
        row.kind === "episode" ? videoEpisodeTags.tagId : videoMovieTags.tagId,
        tags.id,
      ),
    )
    .where(eq(tagIdCol, row.id));

  const resolvedFilePath = resolveExistingMediaPath(row.filePath);
  const hasVideo = resolvedFilePath !== null;

  const markerRows = await db
    .select()
    .from(videoMarkers)
    .where(eq(videoMarkers.entityId, row.id))
    .orderBy(asc(videoMarkers.seconds));
  const markers = markerRows.map((m) => ({
    id: m.id,
    title: m.title,
    seconds: Number(m.seconds),
    endSeconds: m.endSeconds != null ? Number(m.endSeconds) : null,
  }));

  const subtitleRows = await db
    .select()
    .from(videoSubtitles)
    .where(eq(videoSubtitles.entityId, row.id))
    .orderBy(asc(videoSubtitles.createdAt));
  const subtitleTracks = subtitleRows.map((r) => {
    const sourceFormat = (r.sourceFormat ?? "vtt") as
      | "vtt"
      | "srt"
      | "ass"
      | "ssa";
    const hasRawSource =
      (sourceFormat === "ass" || sourceFormat === "ssa") && !!r.sourcePath;
    return {
      id: r.id,
      videoId: r.entityId,
      language: r.language,
      label: r.label,
      format: "vtt" as const,
      source: r.source as "upload" | "embedded" | "sidecar",
      sourceFormat,
      isDefault: r.isDefault,
      url: `/videos/${r.entityId}/subtitles/${r.id}`,
      sourceUrl: hasRawSource
        ? `/videos/${r.entityId}/subtitles/${r.id}/source`
        : null,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
    };
  });
  const hasSubtitles = subtitleTracks.length > 0;

  return {
    id: row.id,
    entityKind:
      row.kind === "episode"
        ? ("video_episode" as const)
        : ("video_movie" as const),
    title: row.title,
    details: row.details,
    date: row.date,
    rating: row.rating,
    url: row.url,
    urls: row.url ? [row.url] : [],
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
    filePath: resolvedFilePath ?? row.filePath,
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
    hasSubtitles,
    videoSeriesId: row.seriesId,
    videoSeriesTitle: row.seriesTitle,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    absoluteEpisodeNumber: row.absoluteEpisodeNumber,
    playDuration: row.playDuration,
    resumeTime: row.resumeTime,
    lastPlayedAt: row.lastPlayedAt,
    studio: studioEmbed,
    performers: performerDetails,
    tags: tagRows,
    markers,
    subtitleTracks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function updateVideoWrite(
  db: AppDb,
  id: string,
  body: UpdateVideoBody,
) {
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
    if (!mv) throw new NotFoundError("Video not found");
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
    if (body.url !== undefined) patch.url = body.url;
    if (body.organized !== undefined) patch.organized = body.organized;
    if (body.isNsfw !== undefined) patch.isNsfw = body.isNsfw;
    if (body.orgasmCount !== undefined) patch.orgasmCount = body.orgasmCount;

    if (kind === "episode") {
      if (body.seasonNumber !== undefined) {
        patch.seasonNumber =
          body.seasonNumber === null ? null : Math.max(0, body.seasonNumber);
      }
      if (body.episodeNumber !== undefined) {
        patch.episodeNumber =
          body.episodeNumber === null ? null : Math.max(0, body.episodeNumber);
      }
      if (body.absoluteEpisodeNumber !== undefined) {
        patch.absoluteEpisodeNumber =
          body.absoluteEpisodeNumber === null
            ? null
            : Math.max(0, body.absoluteEpisodeNumber);
      }
    }

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

    const perfJoin =
      kind === "episode" ? videoEpisodePerformers : videoMoviePerformers;
    const perfIdCol =
      kind === "episode"
        ? videoEpisodePerformers.episodeId
        : videoMoviePerformers.movieId;
    const tagJoin = kind === "episode" ? videoEpisodeTags : videoMovieTags;
    const tagIdCol =
      kind === "episode" ? videoEpisodeTags.episodeId : videoMovieTags.movieId;

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

export async function deleteVideoWrite(
  db: AppDb,
  id: string,
  deleteFile?: boolean,
) {
  const [ep] = await db
    .select({
      id: videoEpisodes.id,
      filePath: videoEpisodes.filePath,
    })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, id))
    .limit(1);

  let filePath: string | null = null;
  if (ep) {
    filePath = ep.filePath;
    await db.delete(videoEpisodes).where(eq(videoEpisodes.id, id));
  } else {
    const [mv] = await db
      .select({
        id: videoMovies.id,
        filePath: videoMovies.filePath,
      })
      .from(videoMovies)
      .where(eq(videoMovies.id, id))
      .limit(1);
    if (!mv) throw new NotFoundError("Video not found");
    filePath = mv.filePath;
    await db.delete(videoMovies).where(eq(videoMovies.id, id));
  }

  if (filePath) {
    for (const derivative of allVideoGeneratedDiskPaths(id, filePath)) {
      try {
        if (existsSync(derivative)) await unlink(derivative);
      } catch {}
    }

    if (deleteFile) {
      try {
        if (existsSync(filePath)) await unlink(filePath);
      } catch {}
    }
  }

  return { ok: true as const };
}

export async function resetVideoMetadataWrite(db: AppDb, id: string) {
  const row = await loadVideoRow(db, id);
  if (!row) throw new NotFoundError("Video not found");
  const table = row.kind === "episode" ? videoEpisodes : videoMovies;
  await db
    .update(table)
    .set({
      title: row.title,
      overview: null,
      rating: null,
      organized: false,
      updatedAt: new Date(),
      ...(row.kind === "episode" ? { airDate: null } : { releaseDate: null }),
    })
    .where(eq(table.id, id));
  return { ok: true as const, id, title: row.title };
}


export async function uploadVideoMovieWrite(
  db: AppDb,
  libraryRootId: string,
  file: VideoUploadInput,
  deps: VideoWriteDeps = {},
) {
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, libraryRootId))
    .limit(1);
  if (!root) throw new NotFoundError("Library root not found");
  if (!root.scanVideos) {
    throw new ValidationError(
      "Selected library root is not configured to receive video uploads",
    );
  }
  if (!root.enabled) {
    throw new ValidationError("Selected library root is disabled");
  }
  if (!root.path) {
    throw new InternalError("Library root is missing a filesystem path");
  }

  await assertDirExists(root.path);
  const { safeName } = validateUploadMetadata(file, "video");
  const dest = await resolveCollisionSafePath(root.path, safeName);
  const { bytesWritten } = await persistUploadedVideo(dest, file);

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
    throw new InternalError("Failed to create video movie row after upload");
  }

  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const target = {
    type: "video_movie",
    id: created.id,
    label: created.title,
  };
  const trigger = {
    by: "manual" as const,
    label: `Queued after upload to ${root.label}`,
  };

  await enqueue({
    queueName: "media-probe",
    jobName: "video_movie-media-probe",
    data: { entityKind: "video_movie", entityId: created.id },
    target,
    trigger,
  });
  await enqueue({
    queueName: "fingerprint",
    jobName: "video_movie-fingerprint",
    data: { entityKind: "video_movie", entityId: created.id },
    target,
    trigger,
  });
  await enqueue({
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

export async function uploadVideoEpisodeWrite(
  db: AppDb,
  seriesId: string,
  file: VideoUploadInput,
  deps: VideoWriteDeps = {},
) {
  const [series] = await db
    .select({
      id: videoSeries.id,
      folderPath: videoSeries.folderPath,
      libraryRootId: videoSeries.libraryRootId,
      isNsfw: videoSeries.isNsfw,
      title: videoSeries.title,
    })
    .from(videoSeries)
    .where(eq(videoSeries.id, seriesId))
    .limit(1);
  if (!series) throw new NotFoundError("Video folder not found");

  await assertDirExists(series.folderPath);
  const { safeName } = validateUploadMetadata(file, "video");
  const dest = await resolveCollisionSafePath(series.folderPath, safeName);
  const { bytesWritten } = await persistUploadedVideo(dest, file);

  let [season] = await db
    .select({ id: videoSeasons.id })
    .from(videoSeasons)
    .where(
      and(eq(videoSeasons.seriesId, seriesId), eq(videoSeasons.seasonNumber, 0)),
    )
    .limit(1);
  if (!season) {
    const [createdSeason] = await db
      .insert(videoSeasons)
      .values({
        seriesId,
        seasonNumber: 0,
        title: series.title,
      })
      .returning({ id: videoSeasons.id });
    season = createdSeason;
  }

  const [created] = await db
    .insert(videoEpisodes)
    .values({
      seriesId,
      seasonId: season!.id,
      seasonNumber: 0,
      title: fileNameToTitle(dest),
      filePath: dest,
      fileSize: bytesWritten,
      organized: false,
      isNsfw: series.isNsfw,
    })
    .returning({
      id: videoEpisodes.id,
      title: videoEpisodes.title,
      filePath: videoEpisodes.filePath,
    });
  if (!created) {
    throw new InternalError("Failed to create video episode row after upload");
  }

  const enqueue = deps.enqueueJob ?? defaultEnqueueJob(db);
  const target = {
    type: "video_episode",
    id: created.id,
    label: created.title,
  };
  const trigger = {
    by: "manual" as const,
    label: `Queued after upload to ${series.title}`,
  };

  await enqueue({
    queueName: "media-probe",
    jobName: "video_episode-media-probe",
    data: { entityKind: "video_episode", entityId: created.id },
    target,
    trigger,
  });
  await enqueue({
    queueName: "fingerprint",
    jobName: "video_episode-fingerprint",
    data: { entityKind: "video_episode", entityId: created.id },
    target,
    trigger,
  });
  await enqueue({
    queueName: "preview",
    jobName: "video_episode-preview",
    data: { entityKind: "video_episode", entityId: created.id },
    target,
    trigger,
  });

  return {
    id: created.id,
    title: created.title,
    filePath: created.filePath,
    seriesId,
    libraryRootId: series.libraryRootId,
  };
}
