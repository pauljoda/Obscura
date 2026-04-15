import { like, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import {
  propagateEpisodeNsfw,
  propagateMovieNsfw,
} from "./nsfw-video-propagation";

type AppDb = PostgresJsDatabase<typeof schema>;

const {
  videoEpisodes,
  videoMovies,
  videoSeries,
  images,
  galleries,
  audioLibraries,
  audioTracks,
} = schema;

const VIDEO_PROPAGATE_BATCH = 64;

/**
 * Aligns `isNsfw` on all media rows scoped under a library root path with the
 * root's flag. Video episodes and movies use full propagation when clearing
 * NSFW so tag/performer/studio signals are preserved.
 */
export async function syncMediaNsfwWithLibraryRoot(
  db: AppDb,
  rootPath: string,
  isNsfw: boolean,
) {
  const pathPrefix = `${rootPath}%`;
  const now = new Date();

  if (isNsfw) {
    // Every playable file under the root flips to NSFW=true. Series rows
    // flip too so the series cards render with the NSFW badge. Episodes
    // are found via their parent series folder path, movies via their own
    // file_path, because episodes do not carry a library_root_id of their
    // own — they inherit it from the series.
    await db
      .update(videoSeries)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(videoSeries.folderPath, pathPrefix));
    await db
      .update(videoEpisodes)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(videoEpisodes.filePath, pathPrefix));
    await db
      .update(videoMovies)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(videoMovies.filePath, pathPrefix));
    await db
      .update(images)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(images.filePath, pathPrefix));
    await db
      .update(galleries)
      .set({ isNsfw: true, updatedAt: now })
      .where(
        or(
          like(galleries.folderPath, pathPrefix),
          like(galleries.zipFilePath, pathPrefix),
        )!,
      );
    await db
      .update(audioLibraries)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(audioLibraries.folderPath, pathPrefix));
    await db
      .update(audioTracks)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(audioTracks.filePath, pathPrefix));
    return;
  }

  // Clearing NSFW: non-video media flips unconditionally, then video rows
  // run through the propagator so tag/performer/studio signals can still
  // force the flag to stay true per-row.
  await db
    .update(videoSeries)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(videoSeries.folderPath, pathPrefix));
  await db
    .update(images)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(images.filePath, pathPrefix));
  await db
    .update(galleries)
    .set({ isNsfw: false, updatedAt: now })
    .where(
      or(
        like(galleries.folderPath, pathPrefix),
        like(galleries.zipFilePath, pathPrefix),
      )!,
    );
  await db
    .update(audioLibraries)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(audioLibraries.folderPath, pathPrefix));
  await db
    .update(audioTracks)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(audioTracks.filePath, pathPrefix));

  const episodeRows = await db
    .select({ id: videoEpisodes.id })
    .from(videoEpisodes)
    .where(like(videoEpisodes.filePath, pathPrefix));

  for (let i = 0; i < episodeRows.length; i += VIDEO_PROPAGATE_BATCH) {
    const chunk = episodeRows.slice(i, i + VIDEO_PROPAGATE_BATCH);
    await Promise.all(
      chunk.map((row) => propagateEpisodeNsfw(db, row.id, false)),
    );
  }

  const movieRows = await db
    .select({ id: videoMovies.id })
    .from(videoMovies)
    .where(like(videoMovies.filePath, pathPrefix));

  for (let i = 0; i < movieRows.length; i += VIDEO_PROPAGATE_BATCH) {
    const chunk = movieRows.slice(i, i + VIDEO_PROPAGATE_BATCH);
    await Promise.all(
      chunk.map((row) => propagateMovieNsfw(db, row.id, false)),
    );
  }
}

