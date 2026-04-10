import { like, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { propagateSceneNsfw } from "./nsfw-scene-propagation";

type AppDb = PostgresJsDatabase<typeof schema>;

const { scenes, images, galleries, audioLibraries, audioTracks } = schema;

const SCENE_PROPAGATE_BATCH = 64;

/**
 * Aligns `isNsfw` on all media rows scoped under a library root path with the
 * root's flag. Scenes use full propagation when clearing NSFW so tag/performer/studio
 * signals are preserved.
 */
export async function syncMediaNsfwWithLibraryRoot(db: AppDb, rootPath: string, isNsfw: boolean) {
  const pathPrefix = `${rootPath}%`;
  const now = new Date();

  if (isNsfw) {
    await db
      .update(scenes)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(scenes.filePath, pathPrefix));
    await db
      .update(images)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(images.filePath, pathPrefix));
    await db
      .update(galleries)
      .set({ isNsfw: true, updatedAt: now })
      .where(
        or(like(galleries.folderPath, pathPrefix), like(galleries.zipFilePath, pathPrefix))!,
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

  await db
    .update(images)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(images.filePath, pathPrefix));
  await db
    .update(galleries)
    .set({ isNsfw: false, updatedAt: now })
    .where(
      or(like(galleries.folderPath, pathPrefix), like(galleries.zipFilePath, pathPrefix))!,
    );
  await db
    .update(audioLibraries)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(audioLibraries.folderPath, pathPrefix));
  await db
    .update(audioTracks)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(audioTracks.filePath, pathPrefix));

  const sceneRows = await db.select({ id: scenes.id }).from(scenes).where(like(scenes.filePath, pathPrefix));

  for (let i = 0; i < sceneRows.length; i += SCENE_PROPAGATE_BATCH) {
    const chunk = sceneRows.slice(i, i + SCENE_PROPAGATE_BATCH);
    await Promise.all(chunk.map((row) => propagateSceneNsfw(db, row.id, false)));
  }
}
