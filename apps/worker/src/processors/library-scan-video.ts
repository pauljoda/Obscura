import path from "node:path";
import { stat } from "node:fs/promises";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  discoverVideoFiles,
  fileNameToTitle,
  readSidecarMetadata,
  classifyVideoFile,
  parseEpisodeFilename,
  parseMovieFilename,
  type VideoClassification,
  type VideoClassificationEpisode,
  type VideoClassificationMovie,
} from "@obscura/media-core";
import { db, schema } from "../lib/db.js";
import { libraryRoots, performers, tags } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import {
  enqueueGalleryRootJob,
  enqueueAudioRootJob,
  enqueueCollectionRefreshAll,
  enqueuePendingVideoJob,
} from "../lib/enqueue.js";
import { ensureLibrarySettingsRow } from "../lib/scheduler.js";

const {
  videoSeries,
  videoSeasons,
  videoEpisodes,
  videoMovies,
  videoEpisodePerformers,
  videoEpisodeTags,
  videoMoviePerformers,
  videoMovieTags,
} = schema;

// ---------------------------------------------------------------------------
// Inlined buildSeriesTree — the migration module's `series-tree.ts` lives in
// `apps/api` and is not reachable from the worker's tsconfig. This is a pure
// ~30-line function, so we inline it rather than introducing a cross-app
// import. If the logic ever needs to change, keep this and the copy in
// `apps/api/src/db/data-migrations/videos_to_series_model_v1/series-tree.ts`
// in sync.
// ---------------------------------------------------------------------------

interface SeriesTreeNode {
  libraryRootPath: string;
  folderPath: string;
  folderName: string;
  relativePath: string;
  seasons: Map<number, SeasonTreeNode>;
}

interface SeasonTreeNode {
  seasonNumber: number;
  folderPath: string | null;
  folderName: string | null;
  episodes: VideoClassificationEpisode[];
}

function buildSeriesTree(
  episodes: VideoClassificationEpisode[],
): Map<string, SeriesTreeNode> {
  const tree = new Map<string, SeriesTreeNode>();

  for (const episode of episodes) {
    let series = tree.get(episode.seriesFolderPath);
    if (!series) {
      series = {
        libraryRootPath: episode.libraryRootPath,
        folderPath: episode.seriesFolderPath,
        folderName: episode.seriesFolderName,
        relativePath: path
          .relative(episode.libraryRootPath, episode.seriesFolderPath)
          .split(path.sep)
          .join("/"),
        seasons: new Map(),
      };
      tree.set(episode.seriesFolderPath, series);
    }

    let season = series.seasons.get(episode.placementSeasonNumber);
    if (!season) {
      season = {
        seasonNumber: episode.placementSeasonNumber,
        folderPath: episode.seasonFolderPath,
        folderName: episode.seasonFolderName,
        episodes: [],
      };
      series.seasons.set(episode.placementSeasonNumber, season);
    } else if (!season.folderPath && episode.seasonFolderPath) {
      season.folderPath = episode.seasonFolderPath;
      season.folderName = episode.seasonFolderName;
    }

    season.episodes.push(episode);
  }

  return tree;
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processLibraryScan(job: Job): Promise<void> {
  const libraryRootId = String(job.data.libraryRootId);
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, libraryRootId))
    .limit(1);

  if (!root) {
    throw new Error("Library root not found");
  }

  await markJobActive(job, "library-scan", {
    type: "library-root",
    id: root.id,
    label: root.label,
  });

  const settings = await ensureLibrarySettingsRow();

  // Classify files. Classification is pure and fast.
  const scanMovies = root.scanMovies ?? true;
  const scanSeries = root.scanSeries ?? true;
  const scanVideos = scanMovies || scanSeries;
  const files = scanVideos
    ? await discoverVideoFiles(root.path, root.recursive)
    : [];

  const gallerySfwOpts = Boolean(job.data.sfwOnly)
    ? { sfwOnly: true as const }
    : undefined;

  const movies: VideoClassificationMovie[] = [];
  const episodes: VideoClassificationEpisode[] = [];

  for (const filePath of files) {
    const classified: VideoClassification = classifyVideoFile(filePath, {
      libraryRootPath: root.path,
      scanMovies,
      scanSeries,
    });

    if (classified.kind === "movie") {
      movies.push(classified);
    } else if (classified.kind === "episode") {
      episodes.push(classified);
    } else if (classified.kind === "rejected") {
      console.warn(
        `[library-scan-video] rejected ${filePath}: ${classified.reason}`,
      );
    }
    // skipped → silent
  }

  // -------------------------------------------------------------------------
  // Series/Season upserts — build tree first so every episode finds a parent.
  // -------------------------------------------------------------------------
  const seriesIdByFolder = new Map<string, string>();
  const seasonIdByKey = new Map<string, string>(); // `${seriesId}:${seasonNumber}`

  const tree = buildSeriesTree(episodes);

  for (const [seriesFolderPath, seriesNode] of tree) {
    // Title derivation: sidecar on a series-level NFO is rare; use folder
    // basename parser. (Classifier already gives us seriesFolderName.)
    const parsedSeries = {
      title: seriesNode.folderName,
      relativePath:
        seriesNode.relativePath === "" ? seriesNode.folderName : seriesNode.relativePath,
    };

    const [upsertedSeries] = await db
      .insert(videoSeries)
      .values({
        libraryRootId: root.id,
        folderPath: seriesFolderPath,
        relativePath: parsedSeries.relativePath,
        title: parsedSeries.title,
        isNsfw: root.isNsfw ?? false,
      })
      .onConflictDoUpdate({
        target: videoSeries.folderPath,
        // Only refresh updatedAt; preserve user fields.
        set: { updatedAt: new Date() },
      })
      .returning({ id: videoSeries.id });

    seriesIdByFolder.set(seriesFolderPath, upsertedSeries.id);

    for (const [seasonNumber, seasonNode] of seriesNode.seasons) {
      const [upsertedSeason] = await db
        .insert(videoSeasons)
        .values({
          seriesId: upsertedSeries.id,
          seasonNumber,
          folderPath: seasonNode.folderPath,
          title: seasonNode.folderName,
        })
        .onConflictDoUpdate({
          target: [videoSeasons.seriesId, videoSeasons.seasonNumber],
          set: { updatedAt: new Date() },
        })
        .returning({ id: videoSeasons.id });

      seasonIdByKey.set(
        `${upsertedSeries.id}:${seasonNumber}`,
        upsertedSeason.id,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Episode upserts
  // -------------------------------------------------------------------------
  const upsertedEpisodeIds = new Set<string>();

  for (const [index, episode] of episodes.entries()) {
    const seriesId = seriesIdByFolder.get(episode.seriesFolderPath);
    const seasonId = seasonIdByKey.get(
      `${seriesId}:${episode.placementSeasonNumber}`,
    );
    if (!seriesId || !seasonId) {
      console.warn(
        `[library-scan-video] missing series/season for ${episode.filePath}`,
      );
      continue;
    }

    const sidecar = await readSidecarMetadata(episode.filePath).catch(
      () => null,
    );
    const parsed = parseEpisodeFilename(episode.filePath);
    let fileSize: number | null = null;
    try {
      const st = await stat(episode.filePath);
      fileSize = st.size;
    } catch {
      // ignore
    }

    const title =
      sidecar?.title ??
      parsed.title ??
      fileNameToTitle(episode.filePath);
    const overview = sidecar?.details ?? null;
    const airDate = sidecar?.date ?? null;
    const rating = sidecar?.rating ?? null;

    // Find existing row by file_path.
    const [existing] = await db
      .select({
        id: videoEpisodes.id,
        title: videoEpisodes.title,
        overview: videoEpisodes.overview,
        airDate: videoEpisodes.airDate,
        rating: videoEpisodes.rating,
      })
      .from(videoEpisodes)
      .where(eq(videoEpisodes.filePath, episode.filePath))
      .limit(1);

    let episodeId: string;

    if (!existing) {
      const [inserted] = await db
        .insert(videoEpisodes)
        .values({
          seasonId,
          seriesId,
          seasonNumber: episode.placementSeasonNumber,
          episodeNumber: parsed.episodeNumber ?? null,
          absoluteEpisodeNumber: parsed.absoluteEpisodeNumber ?? null,
          title,
          overview,
          airDate,
          rating,
          filePath: episode.filePath,
          fileSize,
          isNsfw: root.isNsfw ?? false,
          organized: false,
        })
        .returning({ id: videoEpisodes.id });
      episodeId = inserted.id;
    } else {
      episodeId = existing.id;
      // Refresh limited set: season/series linkage (file may have moved)
      // and file_size. Preserve user-edited fields; backfill sidecar-derived
      // fields only when the DB row currently has null.
      const patch: Record<string, unknown> = {
        seasonId,
        seriesId,
        seasonNumber: episode.placementSeasonNumber,
        updatedAt: new Date(),
      };
      if (fileSize != null) patch.fileSize = fileSize;
      if (!existing.title && title) patch.title = title;
      if (!existing.overview && overview) patch.overview = overview;
      if (!existing.airDate && airDate) patch.airDate = airDate;
      if (existing.rating == null && rating != null) patch.rating = rating;

      await db
        .update(videoEpisodes)
        .set(patch)
        .where(eq(videoEpisodes.id, episodeId));
    }

    upsertedEpisodeIds.add(episodeId);

    if (sidecar?.tags?.length || sidecar?.performers?.length) {
      await linkVideoSidecarMetadata(
        episodeId,
        "episode",
        sidecar?.tags ?? [],
        sidecar?.performers ?? [],
      );
    }

    // Enqueue downstream processors for the episode (media-probe,
    // fingerprint, preview). Each processor dispatches on entityKind.
    const epTrigger = {
      by: "library-scan" as const,
      label: `Queued during ${root.label} scan`,
    };
    try {
      await enqueuePendingVideoJob("media-probe", "video_episode", episodeId, epTrigger);
      await enqueuePendingVideoJob("fingerprint", "video_episode", episodeId, epTrigger);
      await enqueuePendingVideoJob("preview", "video_episode", episodeId, epTrigger);
    } catch (err) {
      console.warn(
        `[library-scan-video] failed to enqueue downstream jobs for episode ${episodeId}: ${(err as Error).message}`,
      );
    }

    await markJobProgress(
      job,
      "library-scan",
      Math.max(
        1,
        Math.round(
          ((index + 1) / Math.max(episodes.length + movies.length, 1)) * 100,
        ),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Movie upserts
  // -------------------------------------------------------------------------
  const upsertedMovieIds = new Set<string>();

  for (const [index, movie] of movies.entries()) {
    const sidecar = await readSidecarMetadata(movie.filePath).catch(() => null);
    const parsed = parseMovieFilename(movie.filePath);
    let fileSize: number | null = null;
    try {
      const st = await stat(movie.filePath);
      fileSize = st.size;
    } catch {
      // ignore
    }

    const title =
      sidecar?.title ?? parsed.title ?? fileNameToTitle(movie.filePath);
    const overview = sidecar?.details ?? null;
    const releaseDate = sidecar?.date ?? null;
    const rating = sidecar?.rating ?? null;

    const [existing] = await db
      .select({
        id: videoMovies.id,
        title: videoMovies.title,
        overview: videoMovies.overview,
        releaseDate: videoMovies.releaseDate,
        rating: videoMovies.rating,
      })
      .from(videoMovies)
      .where(eq(videoMovies.filePath, movie.filePath))
      .limit(1);

    let movieId: string;

    if (!existing) {
      const [inserted] = await db
        .insert(videoMovies)
        .values({
          libraryRootId: root.id,
          title,
          overview,
          releaseDate,
          rating,
          filePath: movie.filePath,
          fileSize,
          isNsfw: root.isNsfw ?? false,
          organized: false,
        })
        .returning({ id: videoMovies.id });
      movieId = inserted.id;
    } else {
      movieId = existing.id;
      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (fileSize != null) patch.fileSize = fileSize;
      if (!existing.title && title) patch.title = title;
      if (!existing.overview && overview) patch.overview = overview;
      if (!existing.releaseDate && releaseDate) patch.releaseDate = releaseDate;
      if (existing.rating == null && rating != null) patch.rating = rating;

      await db
        .update(videoMovies)
        .set(patch)
        .where(eq(videoMovies.id, movieId));
    }

    upsertedMovieIds.add(movieId);

    if (sidecar?.tags?.length || sidecar?.performers?.length) {
      await linkVideoSidecarMetadata(
        movieId,
        "movie",
        sidecar?.tags ?? [],
        sidecar?.performers ?? [],
      );
    }

    // Enqueue downstream processors for the movie.
    const mvTrigger = {
      by: "library-scan" as const,
      label: `Queued during ${root.label} scan`,
    };
    try {
      await enqueuePendingVideoJob("media-probe", "video_movie", movieId, mvTrigger);
      await enqueuePendingVideoJob("fingerprint", "video_movie", movieId, mvTrigger);
      await enqueuePendingVideoJob("preview", "video_movie", movieId, mvTrigger);
    } catch (err) {
      console.warn(
        `[library-scan-video] failed to enqueue downstream jobs for movie ${movieId}: ${(err as Error).message}`,
      );
    }

    await markJobProgress(
      job,
      "library-scan",
      Math.max(
        1,
        Math.round(
          ((episodes.length + index + 1) /
            Math.max(episodes.length + movies.length, 1)) *
            100,
        ),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Stale row cleanup — delete episodes/movies whose file_path no longer
  // exists under this library root.
  // -------------------------------------------------------------------------
  const knownEpisodesInRoot = await db
    .select({ id: videoEpisodes.id, filePath: videoEpisodes.filePath })
    .from(videoEpisodes)
    .innerJoin(videoSeries, eq(videoSeries.id, videoEpisodes.seriesId))
    .where(eq(videoSeries.libraryRootId, root.id));
  const staleEpisodeIds = knownEpisodesInRoot
    .filter((e) => !upsertedEpisodeIds.has(e.id))
    .map((e) => e.id);
  if (staleEpisodeIds.length > 0) {
    await db.delete(videoEpisodes).where(inArray(videoEpisodes.id, staleEpisodeIds));
  }

  const knownMoviesInRoot = await db
    .select({ id: videoMovies.id })
    .from(videoMovies)
    .where(eq(videoMovies.libraryRootId, root.id));
  const staleMovieIds = knownMoviesInRoot
    .filter((m) => !upsertedMovieIds.has(m.id))
    .map((m) => m.id);
  if (staleMovieIds.length > 0) {
    await db.delete(videoMovies).where(inArray(videoMovies.id, staleMovieIds));
  }

  // Delete empty seasons and series left behind.
  await db.execute(sql`
    DELETE FROM ${videoSeasons}
    WHERE ${videoSeasons.seriesId} IN (
      SELECT id FROM ${videoSeries} WHERE ${videoSeries.libraryRootId} = ${root.id}
    )
    AND NOT EXISTS (
      SELECT 1 FROM ${videoEpisodes} WHERE ${videoEpisodes.seasonId} = ${videoSeasons.id}
    )
  `);
  await db.execute(sql`
    DELETE FROM ${videoSeries}
    WHERE ${videoSeries.libraryRootId} = ${root.id}
    AND NOT EXISTS (
      SELECT 1 FROM ${videoSeasons} WHERE ${videoSeasons.seriesId} = ${videoSeries.id}
    )
  `);

  // -------------------------------------------------------------------------
  // Mark scan complete and fan out downstream scans (unchanged from old).
  // -------------------------------------------------------------------------
  await db
    .update(libraryRoots)
    .set({ lastScannedAt: new Date(), updatedAt: new Date() })
    .where(eq(libraryRoots.id, root.id));

  const scanImages = root.scanImages ?? true;
  if (scanImages) {
    await enqueueGalleryRootJob(
      root,
      { by: "library-scan", label: `Queued during ${root.label} scan` },
      gallerySfwOpts,
    );
  }

  const scanAudio = root.scanAudio ?? true;
  if (scanAudio) {
    await enqueueAudioRootJob(
      root,
      { by: "library-scan", label: `Queued during ${root.label} scan` },
      gallerySfwOpts,
    );
  }

  await enqueueCollectionRefreshAll({
    by: "library-scan",
    label: `Queued during ${root.label} scan`,
  });

  // Silence unused import warning (settings is not currently read; retained
  // for parity with the old pipeline so future probe/preview gating has a
  // single place to plug in).
  void settings;
}

/**
 * Find-or-create tags and performers from sidecar metadata and link them
 * to a typed video entity (episode or movie).
 */
async function linkVideoSidecarMetadata(
  entityId: string,
  entityKind: "episode" | "movie",
  tagNames: string[],
  performerNames: string[],
): Promise<void> {
  for (const name of tagNames) {
    try {
      const [existing] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.name, name))
        .limit(1);
      const tagId =
        existing?.id ??
        (await db.insert(tags).values({ name }).returning({ id: tags.id }))[0]
          .id;
      if (entityKind === "episode") {
        await db
          .insert(videoEpisodeTags)
          .values({ episodeId: entityId, tagId })
          .onConflictDoNothing();
      } else {
        await db
          .insert(videoMovieTags)
          .values({ movieId: entityId, tagId })
          .onConflictDoNothing();
      }
    } catch {
      // ignore — don't fail the scan for metadata linking
    }
  }

  for (const name of performerNames) {
    try {
      const [existing] = await db
        .select({ id: performers.id })
        .from(performers)
        .where(eq(performers.name, name))
        .limit(1);
      const performerId =
        existing?.id ??
        (
          await db
            .insert(performers)
            .values({ name })
            .returning({ id: performers.id })
        )[0].id;
      if (entityKind === "episode") {
        await db
          .insert(videoEpisodePerformers)
          .values({ episodeId: entityId, performerId })
          .onConflictDoNothing();
      } else {
        await db
          .insert(videoMoviePerformers)
          .values({ movieId: entityId, performerId })
          .onConflictDoNothing();
      }
    } catch {
      // ignore
    }
  }
}
