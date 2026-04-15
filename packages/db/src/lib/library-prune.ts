import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { getGeneratedImageDir, getGeneratedSceneDir } from "@obscura/media-core";
import type { AppDb } from "../types";
import * as schema from "../schema";

const {
  libraryRoots,
  images,
  galleries,
  videoEpisodes,
  videoMovies,
  videoSeasons,
  videoSeries,
} = schema;

function getRootScopedPath(filePath: string) {
  return filePath.includes("::") ? (filePath.split("::")[0] ?? filePath) : filePath;
}

function isPathWithinRoot(filePath: string, rootPath: string) {
  const candidate = path.resolve(getRootScopedPath(filePath));
  const root = path.resolve(rootPath);
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function isPathWithinAnyRoot(filePath: string, rootPaths: string[]) {
  return rootPaths.some((rootPath) => isPathWithinRoot(filePath, rootPath));
}

/** Generated asset directories for video entities use the same naming
 * convention as the old scene asset dirs — keyed by the entity id.
 */
export async function removeGeneratedVideoDirs(entityIds: string[]) {
  for (const id of entityIds) {
    await rm(getGeneratedSceneDir(id), { recursive: true, force: true });
  }
}

export async function removeGeneratedImageDirs(imageIds: string[]) {
  for (const imageId of imageIds) {
    await rm(getGeneratedImageDir(imageId), { recursive: true, force: true });
  }
}

/**
 * Remove DB rows (and generated dirs) for media no longer under any
 * enabled library root, and videos whose files disappeared from disk.
 * Call once before enqueueing library scans so it also runs when there
 * are zero roots.
 */
export async function pruneUntrackedLibraryReferences(db: AppDb) {
  const allRoots = await db
    .select({
      path: libraryRoots.path,
      scanMovies: libraryRoots.scanMovies,
      scanSeries: libraryRoots.scanSeries,
      scanImages: libraryRoots.scanImages,
    })
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true));

  const videoRootPaths = allRoots
    .filter((r) => r.scanMovies || r.scanSeries)
    .map((r) => r.path);
  const imageRootPaths = allRoots.filter((r) => r.scanImages).map((r) => r.path);

  // ── Video episodes ──────────────────────────────────────────────
  const allEpisodes = await db
    .select({
      id: videoEpisodes.id,
      filePath: videoEpisodes.filePath,
    })
    .from(videoEpisodes);

  const missingEpisodeIds = allEpisodes
    .filter((ep) => ep.filePath && !existsSync(ep.filePath))
    .map((ep) => ep.id);

  if (missingEpisodeIds.length > 0) {
    await removeGeneratedVideoDirs(missingEpisodeIds);
    await db
      .delete(videoEpisodes)
      .where(inArray(videoEpisodes.id, missingEpisodeIds));
  }

  const orphanedEpisodeIds = allEpisodes
    .filter((ep) => {
      if (!ep.filePath) return false;
      if (missingEpisodeIds.includes(ep.id)) return false;
      return !isPathWithinAnyRoot(ep.filePath, videoRootPaths);
    })
    .map((ep) => ep.id);

  if (orphanedEpisodeIds.length > 0) {
    await removeGeneratedVideoDirs(orphanedEpisodeIds);
    await db
      .delete(videoEpisodes)
      .where(inArray(videoEpisodes.id, orphanedEpisodeIds));
  }

  // ── Video movies ────────────────────────────────────────────────
  const allMovies = await db
    .select({
      id: videoMovies.id,
      filePath: videoMovies.filePath,
    })
    .from(videoMovies);

  const missingMovieIds = allMovies
    .filter((mv) => mv.filePath && !existsSync(mv.filePath))
    .map((mv) => mv.id);

  if (missingMovieIds.length > 0) {
    await removeGeneratedVideoDirs(missingMovieIds);
    await db.delete(videoMovies).where(inArray(videoMovies.id, missingMovieIds));
  }

  const orphanedMovieIds = allMovies
    .filter((mv) => {
      if (!mv.filePath) return false;
      if (missingMovieIds.includes(mv.id)) return false;
      return !isPathWithinAnyRoot(mv.filePath, videoRootPaths);
    })
    .map((mv) => mv.id);

  if (orphanedMovieIds.length > 0) {
    await removeGeneratedVideoDirs(orphanedMovieIds);
    await db.delete(videoMovies).where(inArray(videoMovies.id, orphanedMovieIds));
  }

  // Seasons whose parent series vanished cascade via FK ON DELETE, but
  // seasons with no remaining episodes should be cleaned up too. Series
  // with no remaining seasons follow the same rule. This keeps the UI
  // from showing phantom empty series cards after a prune.
  await db.execute(`
    DELETE FROM video_seasons vs
    WHERE NOT EXISTS (
      SELECT 1 FROM video_episodes ve WHERE ve.season_id = vs.id
    )
  `);
  await db.execute(`
    DELETE FROM video_series vsrs
    WHERE NOT EXISTS (
      SELECT 1 FROM video_seasons vs WHERE vs.series_id = vsrs.id
    )
  `);
  // Suppress unused-import warnings for tables referenced only via raw
  // SQL above.
  void videoSeasons;
  void videoSeries;

  // ── Images ──────────────────────────────────────────────────────
  const allKnownImages = await db
    .select({
      id: images.id,
      filePath: images.filePath,
    })
    .from(images);

  const orphanedImageIds = allKnownImages
    .filter((image) => !isPathWithinAnyRoot(image.filePath, imageRootPaths))
    .map((image) => image.id);

  if (orphanedImageIds.length > 0) {
    await removeGeneratedImageDirs(orphanedImageIds);
    await db.delete(images).where(inArray(images.id, orphanedImageIds));
  }

  // ── Galleries ───────────────────────────────────────────────────
  const allKnownGalleries = await db
    .select({
      id: galleries.id,
      folderPath: galleries.folderPath,
      zipFilePath: galleries.zipFilePath,
    })
    .from(galleries);

  const orphanedGalleryIds = allKnownGalleries
    .filter((gallery) => {
      const backingPath = gallery.folderPath ?? gallery.zipFilePath;
      if (!backingPath) return false;
      return !isPathWithinAnyRoot(backingPath, imageRootPaths);
    })
    .map((gallery) => gallery.id);

  if (orphanedGalleryIds.length > 0) {
    await db
      .update(galleries)
      .set({ parentId: null, updatedAt: new Date() })
      .where(inArray(galleries.parentId, orphanedGalleryIds));

    await db.delete(galleries).where(inArray(galleries.id, orphanedGalleryIds));
  }
}
