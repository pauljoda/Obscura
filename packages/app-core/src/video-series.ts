import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getGeneratedSeriesDir } from "@obscura/media-core";
import { schema, type AppDb } from "@obscura/db";
import {
  NotFoundError,
  UpstreamError,
  ValidationError,
} from "./errors";

const {
  videoSeries,
  videoSeasons,
  videoEpisodes,
  videoSeriesPerformers,
  videoSeriesTags,
  libraryRoots,
  studios,
  performers,
  tags,
} = schema;

function clampPagination(
  limitStr: string | undefined,
  offsetStr: string | undefined,
  defaultLimit: number,
  maxLimit: number,
) {
  return {
    limit: Math.min(Number(limitStr) || defaultLimit, maxLimit),
    offset: Number(offsetStr) || 0,
  };
}

export interface VideoSeriesSeasonSummary {
  id: string;
  seasonNumber: number;
  title: string | null;
  posterPath: string | null;
  episodeCount: number;
  previewThumbnailPath: string | null;
}

async function fetchSeriesSeasons(
  db: AppDb,
  seriesId: string,
  nsfwMode?: string,
): Promise<VideoSeriesSeasonSummary[]> {
  const seasons = await db
    .select({
      id: videoSeasons.id,
      seasonNumber: videoSeasons.seasonNumber,
      title: videoSeasons.title,
      posterPath: videoSeasons.posterPath,
    })
    .from(videoSeasons)
    .where(eq(videoSeasons.seriesId, seriesId))
    .orderBy(asc(videoSeasons.seasonNumber));

  if (seasons.length === 0) return [];

  const countWhere =
    nsfwMode === "off"
      ? and(
          eq(videoEpisodes.seriesId, seriesId),
          ne(videoEpisodes.isNsfw, true),
        )
      : eq(videoEpisodes.seriesId, seriesId);
  const countRows = await db
    .select({
      seasonId: videoEpisodes.seasonId,
      count: sql<number>`count(*)::int`,
    })
    .from(videoEpisodes)
    .where(countWhere)
    .groupBy(videoEpisodes.seasonId);
  const countBySeason = new Map(
    countRows.map((r) => [r.seasonId, Number(r.count ?? 0)]),
  );

  const previewRows = await db
    .select({
      seasonId: videoEpisodes.seasonId,
      cardThumbnailPath: videoEpisodes.cardThumbnailPath,
      thumbnailPath: videoEpisodes.thumbnailPath,
    })
    .from(videoEpisodes)
    .where(countWhere)
    .orderBy(
      asc(videoEpisodes.seasonNumber),
      asc(videoEpisodes.episodeNumber),
    );
  const previewBySeason = new Map<string, string | null>();
  for (const row of previewRows) {
    if (!previewBySeason.has(row.seasonId)) {
      previewBySeason.set(
        row.seasonId,
        row.cardThumbnailPath ?? row.thumbnailPath ?? null,
      );
    }
  }

  return seasons
    .map((s) => ({
      id: s.id,
      seasonNumber: s.seasonNumber,
      title: s.title,
      posterPath: s.posterPath,
      episodeCount: countBySeason.get(s.id) ?? 0,
      previewThumbnailPath: previewBySeason.get(s.id) ?? null,
    }))
    .filter((s) => s.episodeCount > 0);
}

async function fetchLibraryRootLabels(
  db: AppDb,
  ids: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return new Map();
  const rows = await db
    .select({ id: libraryRoots.id, label: libraryRoots.label })
    .from(libraryRoots)
    .where(inArray(libraryRoots.id, uniq));
  return new Map(rows.map((r) => [r.id, r.label]));
}

async function fetchStudioNames(
  db: AppDb,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  if (uniq.length === 0) return new Map();
  const rows = await db
    .select({ id: studios.id, name: studios.name })
    .from(studios)
    .where(inArray(studios.id, uniq));
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function fetchSeriesEpisodeCounts(
  db: AppDb,
  seriesIds: string[],
  nsfwMode?: string,
): Promise<Map<string, number>> {
  if (seriesIds.length === 0) return new Map();
  const where =
    nsfwMode === "off"
      ? and(
          inArray(videoEpisodes.seriesId, seriesIds),
          ne(videoEpisodes.isNsfw, true),
        )
      : inArray(videoEpisodes.seriesId, seriesIds);
  const rows = await db
    .select({
      seriesId: videoEpisodes.seriesId,
      count: sql<number>`count(*)::int`,
    })
    .from(videoEpisodes)
    .where(where)
    .groupBy(videoEpisodes.seriesId);
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.seriesId, Number(row.count));
  for (const id of seriesIds) if (!map.has(id)) map.set(id, 0);
  return map;
}

async function fetchSeriesPreviewThumbnails(
  db: AppDb,
  seriesId: string,
  nsfwMode?: string,
): Promise<string[]> {
  const where =
    nsfwMode === "off"
      ? and(
          eq(videoEpisodes.seriesId, seriesId),
          ne(videoEpisodes.isNsfw, true),
          isNotNull(videoEpisodes.thumbnailPath),
        )
      : and(
          eq(videoEpisodes.seriesId, seriesId),
          isNotNull(videoEpisodes.thumbnailPath),
        );
  const rows = await db
    .select({
      cardThumbnailPath: videoEpisodes.cardThumbnailPath,
      thumbnailPath: videoEpisodes.thumbnailPath,
    })
    .from(videoEpisodes)
    .where(where)
    .orderBy(asc(videoEpisodes.seasonNumber), asc(videoEpisodes.episodeNumber))
    .limit(3);
  return rows
    .map((r) => r.cardThumbnailPath ?? r.thumbnailPath)
    .filter((p): p is string => Boolean(p));
}

function toSeriesListItem(
  series: typeof videoSeries.$inferSelect,
  libraryRootLabel: string,
  studioName: string | null,
  episodeCount: number,
  previewThumbnailPaths: string[],
) {
  return {
    id: series.id,
    title: series.title,
    customName: series.customName,
    displayTitle: series.customName ?? series.title,
    folderPath: series.folderPath,
    relativePath: series.relativePath,
    parentId: null,
    depth: 0,
    isNsfw: series.isNsfw,
    coverImagePath: series.posterPath,
    backdropImagePath: series.backdropPath,
    studioId: series.studioId,
    studioName,
    rating: series.rating,
    date: series.firstAirDate,
    directVideoCount: episodeCount,
    totalVideoCount: episodeCount,
    visibleSfwVideoCount: episodeCount,
    containsNsfwDescendants: series.isNsfw,
    childSeasonCount: 0,
    previewThumbnailPaths,
    libraryRootId: series.libraryRootId,
    libraryRootLabel,
    createdAt: series.createdAt.toISOString(),
    updatedAt: series.updatedAt.toISOString(),
  };
}

export interface ListVideoSeriesQuery {
  parent?: string;
  root?: string;
  search?: string;
  limit?: string;
  offset?: string;
  nsfw?: string;
  studio?: string;
  tag?: string;
  performer?: string;
}

export async function listVideoSeriesRead(
  db: AppDb,
  query: ListVideoSeriesQuery,
) {
  const { limit, offset } = clampPagination(query.limit, query.offset, 60, 200);

  if (query.parent && query.parent !== "root" && query.parent !== "all") {
    return { items: [], total: 0, limit, offset };
  }

  const conds = [];
  if (query.search) {
    const term = `%${query.search}%`;
    conds.push(
      or(
        ilike(videoSeries.title, term),
        ilike(videoSeries.folderPath, term),
        ilike(videoSeries.relativePath, term),
      )!,
    );
  }
  if (query.nsfw === "off") {
    conds.push(eq(videoSeries.isNsfw, false));
  }
  if (query.studio) {
    conds.push(eq(videoSeries.studioId, query.studio));
  }
  if (query.root && query.root !== "all") {
    conds.push(eq(videoSeries.libraryRootId, query.root));
  }

  let tagFilterIds: string[] | undefined;
  if (query.tag) {
    const tagRows = await db
      .select({ seriesId: videoSeriesTags.seriesId })
      .from(videoSeriesTags)
      .innerJoin(tags, eq(videoSeriesTags.tagId, tags.id))
      .where(ilike(tags.name, query.tag));
    tagFilterIds = tagRows.map((r) => r.seriesId);
    if (tagFilterIds.length === 0) {
      return { items: [], total: 0, limit, offset };
    }
    conds.push(inArray(videoSeries.id, tagFilterIds));
  }

  if (query.performer) {
    const performerRows = await db
      .select({ seriesId: videoSeriesPerformers.seriesId })
      .from(videoSeriesPerformers)
      .innerJoin(performers, eq(videoSeriesPerformers.performerId, performers.id))
      .where(ilike(performers.name, query.performer));
    const performerFilterIds = performerRows.map((r) => r.seriesId);
    if (performerFilterIds.length === 0) {
      return { items: [], total: 0, limit, offset };
    }
    conds.push(inArray(videoSeries.id, performerFilterIds));
  }

  const where = conds.length > 0 ? and(...conds) : undefined;
  const all = await db
    .select()
    .from(videoSeries)
    .where(where)
    .orderBy(asc(videoSeries.title));

  const episodeCounts = await fetchSeriesEpisodeCounts(
    db,
    all.map((s) => s.id),
    query.nsfw,
  );

  const visible =
    query.studio || query.tag
      ? all
      : all.filter((s) => (episodeCounts.get(s.id) ?? 0) > 0);

  const total = visible.length;
  const paged = visible.slice(offset, offset + limit);

  const [rootLabels, studioNames] = await Promise.all([
    fetchLibraryRootLabels(db, paged.map((s) => s.libraryRootId)),
    fetchStudioNames(db, paged.map((s) => s.studioId)),
  ]);

  const items = await Promise.all(
    paged.map(async (series) => {
      const previews = await fetchSeriesPreviewThumbnails(db, series.id, query.nsfw);
      return toSeriesListItem(
        series,
        rootLabels.get(series.libraryRootId) ?? "",
        series.studioId ? (studioNames.get(series.studioId) ?? null) : null,
        episodeCounts.get(series.id) ?? 0,
        previews,
      );
    }),
  );

  return { items, total, limit, offset };
}

export async function getVideoSeriesDetailRead(
  db: AppDb,
  id: string,
  nsfwMode?: string,
) {
  const [series] = await db
    .select()
    .from(videoSeries)
    .where(eq(videoSeries.id, id))
    .limit(1);

  if (!series) throw new NotFoundError("Series not found");
  if (nsfwMode === "off" && series.isNsfw)
    throw new NotFoundError("Series not found");

  const [rootLabels, studioNames, episodeCounts, previews, seasons] =
    await Promise.all([
      fetchLibraryRootLabels(db, [series.libraryRootId]),
      fetchStudioNames(db, [series.studioId]),
      fetchSeriesEpisodeCounts(db, [series.id], nsfwMode),
      fetchSeriesPreviewThumbnails(db, series.id, nsfwMode),
      fetchSeriesSeasons(db, series.id, nsfwMode),
    ]);

  const studioEmbed = series.studioId
    ? { id: series.studioId, name: studioNames.get(series.studioId) ?? "" }
    : null;

  const folderPerformers = await db
    .select({
      id: performers.id,
      name: performers.name,
      gender: performers.gender,
      imagePath: performers.imagePath,
      isNsfw: performers.isNsfw,
      character: videoSeriesPerformers.character,
    })
    .from(videoSeriesPerformers)
    .innerJoin(performers, eq(videoSeriesPerformers.performerId, performers.id))
    .where(eq(videoSeriesPerformers.seriesId, id))
    .orderBy(asc(videoSeriesPerformers.order), asc(performers.name));

  const folderTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      isNsfw: tags.isNsfw,
    })
    .from(videoSeriesTags)
    .innerJoin(tags, eq(videoSeriesTags.tagId, tags.id))
    .where(eq(videoSeriesTags.seriesId, id))
    .orderBy(asc(tags.name));

  const filteredPerformers =
    nsfwMode === "off" ? folderPerformers.filter((p) => !p.isNsfw) : folderPerformers;
  const filteredTags =
    nsfwMode === "off" ? folderTags.filter((t) => !t.isNsfw) : folderTags;

  const base = toSeriesListItem(
    series,
    rootLabels.get(series.libraryRootId) ?? "",
    studioEmbed?.name ?? null,
    episodeCounts.get(series.id) ?? 0,
    previews,
  );

  const hasNumberedSeason = seasons.some((s) => s.seasonNumber > 0);
  const renderingMode: "flat" | "seasons" = hasNumberedSeason
    ? "seasons"
    : "flat";

  return {
    ...base,
    details: series.overview,
    urls: [] as string[],
    externalSeriesId: series.externalIds?.tmdb ?? null,
    studio: studioEmbed,
    performers: filteredPerformers,
    tags: filteredTags,
    breadcrumbs: [],
    children: [] as (typeof base)[],
    seasons,
    renderingMode,
  };
}

export interface UpdateVideoSeriesBody {
  isNsfw?: boolean;
  customName?: string | null;
  details?: string | null;
  studioName?: string | null;
  performerNames?: string[];
  tagNames?: string[];
  rating?: number | null;
  date?: string | null;
}

export async function updateVideoSeriesWrite(
  db: AppDb,
  id: string,
  patch: UpdateVideoSeriesBody,
) {
  const [series] = await db
    .select({ id: videoSeries.id })
    .from(videoSeries)
    .where(eq(videoSeries.id, id))
    .limit(1);
  if (!series) throw new NotFoundError("Series not found");

  await db.transaction(async (tx) => {
    const updatePatch: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.isNsfw !== undefined) updatePatch.isNsfw = patch.isNsfw;
    if (patch.details !== undefined) updatePatch.overview = patch.details;
    if (patch.rating !== undefined) updatePatch.rating = patch.rating;
    if (patch.date !== undefined) updatePatch.firstAirDate = patch.date;
    if (patch.customName !== undefined) {
      const trimmed =
        typeof patch.customName === "string" ? patch.customName.trim() : "";
      updatePatch.customName = trimmed.length > 0 ? trimmed : null;
    }

    if (patch.studioName !== undefined) {
      if (!patch.studioName) {
        updatePatch.studioId = null;
      } else {
        const [existing] = await tx
          .select({ id: studios.id })
          .from(studios)
          .where(ilike(studios.name, patch.studioName))
          .limit(1);
        if (existing) {
          updatePatch.studioId = existing.id;
        } else {
          const [created] = await tx
            .insert(studios)
            .values({ name: patch.studioName })
            .returning({ id: studios.id });
          updatePatch.studioId = created.id;
        }
      }
    }

    await tx.update(videoSeries).set(updatePatch).where(eq(videoSeries.id, id));

    if (patch.performerNames !== undefined) {
      await tx
        .delete(videoSeriesPerformers)
        .where(eq(videoSeriesPerformers.seriesId, id));
      for (const name of patch.performerNames) {
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
        await tx
          .insert(videoSeriesPerformers)
          .values({ seriesId: id, performerId })
          .onConflictDoNothing();
      }
    }

    if (patch.tagNames !== undefined) {
      await tx
        .delete(videoSeriesTags)
        .where(eq(videoSeriesTags.seriesId, id));
      for (const name of patch.tagNames) {
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
        await tx
          .insert(videoSeriesTags)
          .values({ seriesId: id, tagId })
          .onConflictDoNothing();
      }
    }
  });

  return { ok: true as const, id };
}

export type CoverKind = "cover" | "backdrop";

function coverFilename(kind: CoverKind) {
  return kind === "cover" ? "cover-custom.jpg" : "backdrop-custom.jpg";
}

function coverAssetUrl(seriesId: string, kind: CoverKind) {
  return `/assets/video-series/${seriesId}/${kind}`;
}

async function writeSeriesImage(
  db: AppDb,
  id: string,
  kind: CoverKind,
  buffer: Buffer,
): Promise<string> {
  const [series] = await db
    .select({ id: videoSeries.id })
    .from(videoSeries)
    .where(eq(videoSeries.id, id))
    .limit(1);
  if (!series) throw new NotFoundError("Series not found");

  const dir = getGeneratedSeriesDir(id);
  await mkdir(dir, { recursive: true });
  const outPath = path.join(dir, coverFilename(kind));
  await writeFile(outPath, buffer);

  const assetUrl = coverAssetUrl(id, kind);
  await db
    .update(videoSeries)
    .set(
      kind === "cover"
        ? { posterPath: assetUrl, updatedAt: new Date() }
        : { backdropPath: assetUrl, updatedAt: new Date() },
    )
    .where(eq(videoSeries.id, id));
  return assetUrl;
}

export async function uploadVideoSeriesCoverWrite(
  db: AppDb,
  id: string,
  kind: CoverKind,
  buffer: Buffer,
) {
  if (buffer.length === 0) throw new ValidationError("Empty file upload");
  const url = await writeSeriesImage(db, id, kind, buffer);
  return { ok: true as const, url };
}

export async function setVideoSeriesCoverFromUrlWrite(
  db: AppDb,
  id: string,
  kind: CoverKind,
  imageUrl: string,
) {
  let buffer: Buffer;
  if (imageUrl.startsWith("data:image/")) {
    const b64 = imageUrl.split(",")[1];
    if (!b64) throw new ValidationError("Bad data URL");
    buffer = Buffer.from(b64, "base64");
  } else {
    const res = await fetch(imageUrl);
    if (!res.ok)
      throw new UpstreamError(`Image download failed: HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  }
  const url = await writeSeriesImage(db, id, kind, buffer);
  return { ok: true as const, url };
}

export async function deleteVideoSeriesCoverWrite(
  db: AppDb,
  id: string,
  kind: CoverKind,
) {
  const [series] = await db
    .select({
      id: videoSeries.id,
      posterPath: videoSeries.posterPath,
      backdropPath: videoSeries.backdropPath,
    })
    .from(videoSeries)
    .where(eq(videoSeries.id, id))
    .limit(1);
  if (!series) throw new NotFoundError("Series not found");

  const dir = getGeneratedSeriesDir(id);
  const onDisk = path.join(dir, coverFilename(kind));
  if (existsSync(onDisk)) {
    await unlink(onDisk).catch(() => undefined);
  }

  const currentUrl =
    kind === "cover" ? series.posterPath : series.backdropPath;
  if (currentUrl?.startsWith(coverAssetUrl(id, kind))) {
    await db
      .update(videoSeries)
      .set(
        kind === "cover"
          ? { posterPath: null, updatedAt: new Date() }
          : { backdropPath: null, updatedAt: new Date() },
      )
      .where(eq(videoSeries.id, id));
  }

  return { ok: true as const };
}
