/**
 * Video folders service — projects `video_series` rows as
 * `SceneFolderListItemDto` / `SceneFolderDetailDto`-shaped objects
 * so the existing folder-aware client can consume them.
 *
 * V1 uses a flat folder model: every series is a depth-0 "folder"
 * with no parent and no children. Seasons exist as metadata on the
 * underlying episodes but are not exposed as subfolders.
 */
import { and, asc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { AppError } from "../plugins/error-handler";
import { parsePagination } from "../lib/query-helpers";

const {
  videoSeries,
  videoEpisodes,
  videoSeriesPerformers,
  videoSeriesTags,
  libraryRoots,
  studios,
  performers,
  tags,
} = schema;

interface LibraryRootLabelRow {
  id: string;
  label: string;
}

async function fetchLibraryRootLabels(
  ids: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return new Map();
  const rows: LibraryRootLabelRow[] = await db
    .select({ id: libraryRoots.id, label: libraryRoots.label })
    .from(libraryRoots)
    .where(inArray(libraryRoots.id, uniq));
  return new Map(rows.map((r) => [r.id, r.label]));
}

async function fetchStudioNames(
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
  seriesIds: string[],
  nsfwMode?: string,
): Promise<Map<string, number>> {
  if (seriesIds.length === 0) return new Map();
  const where = nsfwMode === "off"
    ? and(
        inArray(videoEpisodes.seriesId, seriesIds),
        eq(videoEpisodes.isNsfw, false),
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
  for (const row of rows) {
    map.set(row.seriesId, Number(row.count));
  }
  for (const id of seriesIds) {
    if (!map.has(id)) map.set(id, 0);
  }
  return map;
}

async function fetchSeriesPreviewThumbnails(
  seriesId: string,
  nsfwMode?: string,
): Promise<string[]> {
  const where = nsfwMode === "off"
    ? and(
        eq(videoEpisodes.seriesId, seriesId),
        eq(videoEpisodes.isNsfw, false),
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
    customName: null,
    displayTitle: series.title,
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
    directSceneCount: episodeCount,
    totalSceneCount: episodeCount,
    visibleSfwSceneCount: episodeCount,
    containsNsfwDescendants: series.isNsfw,
    childFolderCount: 0,
    previewThumbnailPaths,
    libraryRootId: series.libraryRootId,
    libraryRootLabel,
    createdAt: series.createdAt.toISOString(),
    updatedAt: series.updatedAt.toISOString(),
  };
}

export async function listVideoFolders(query: {
  parent?: string;
  root?: string;
  search?: string;
  limit?: string;
  offset?: string;
  nsfw?: string;
  studio?: string;
  tag?: string;
}) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 60, 200);

  // Flat model: any non-null parent filter returns empty.
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

  const where = conds.length > 0 ? and(...conds) : undefined;
  const all = await db
    .select()
    .from(videoSeries)
    .where(where)
    .orderBy(asc(videoSeries.title));

  const episodeCounts = await fetchSeriesEpisodeCounts(
    all.map((s) => s.id),
    query.nsfw,
  );

  // Hide empty series unless the user explicitly filtered by studio/tag.
  const visible = (query.studio || query.tag)
    ? all
    : all.filter((s) => (episodeCounts.get(s.id) ?? 0) > 0);

  const total = visible.length;
  const paged = visible.slice(offset, offset + limit);

  const [rootLabels, studioNames] = await Promise.all([
    fetchLibraryRootLabels(paged.map((s) => s.libraryRootId)),
    fetchStudioNames(paged.map((s) => s.studioId)),
  ]);

  const items = await Promise.all(
    paged.map(async (series) => {
      const previews = await fetchSeriesPreviewThumbnails(series.id, query.nsfw);
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

export async function getVideoFolderDetail(id: string, nsfwMode?: string) {
  const [series] = await db
    .select()
    .from(videoSeries)
    .where(eq(videoSeries.id, id))
    .limit(1);

  if (!series) {
    throw new AppError(404, "Video folder not found");
  }
  if (nsfwMode === "off" && series.isNsfw) {
    throw new AppError(404, "Video folder not found");
  }

  const [rootLabels, studioNames, episodeCounts, previews] = await Promise.all([
    fetchLibraryRootLabels([series.libraryRootId]),
    fetchStudioNames([series.studioId]),
    fetchSeriesEpisodeCounts([series.id], nsfwMode),
    fetchSeriesPreviewThumbnails(series.id, nsfwMode),
  ]);

  const studioEmbed = series.studioId
    ? {
        id: series.studioId,
        name: studioNames.get(series.studioId) ?? "",
      }
    : null;

  const folderPerformers = await db
    .select({
      id: performers.id,
      name: performers.name,
      gender: performers.gender,
      imagePath: performers.imagePath,
      isNsfw: performers.isNsfw,
    })
    .from(videoSeriesPerformers)
    .innerJoin(performers, eq(videoSeriesPerformers.performerId, performers.id))
    .where(eq(videoSeriesPerformers.seriesId, id))
    .orderBy(asc(performers.name));

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

  return {
    ...base,
    details: series.overview,
    urls: [] as string[],
    externalSeriesId: series.externalIds?.tmdb ?? null,
    studio: studioEmbed,
    performers: filteredPerformers,
    tags: filteredTags,
    breadcrumbs: [],
    children: [] as typeof base[],
  };
}

export async function updateVideoFolder(
  id: string,
  patch: {
    isNsfw?: boolean;
    customName?: string | null;
    details?: string | null;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
    rating?: number | null;
    date?: string | null;
  },
) {
  const [series] = await db
    .select({ id: videoSeries.id })
    .from(videoSeries)
    .where(eq(videoSeries.id, id))
    .limit(1);
  if (!series) throw new AppError(404, "Video folder not found");

  await db.transaction(async (tx) => {
    const updatePatch: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.isNsfw !== undefined) updatePatch.isNsfw = patch.isNsfw;
    if (patch.details !== undefined) updatePatch.overview = patch.details;
    if (patch.rating !== undefined) updatePatch.rating = patch.rating;
    if (patch.date !== undefined) updatePatch.firstAirDate = patch.date;
    // customName is not yet modelled on video_series — ignored on purpose.
    // TODO(videos): add `customName` column to video_series so the folder
    // rename flow matches the scene-folder UX.

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
