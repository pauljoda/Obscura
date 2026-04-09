import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, like } from "drizzle-orm";
import {
  getGeneratedSceneDir,
  getGeneratedImageDir,
} from "@obscura/media-core";
import { db, scenes, images, galleries, libraryRoots } from "./db.js";

export function sceneAssetUrl(sceneId: string, fileName: string) {
  return `/assets/scenes/${sceneId}/${fileName}`;
}

export function getRootScopedPath(filePath: string) {
  return filePath.includes("::") ? (filePath.split("::")[0] ?? filePath) : filePath;
}

export function isPathWithinRoot(filePath: string, rootPath: string) {
  const candidate = path.resolve(getRootScopedPath(filePath));
  const root = path.resolve(rootPath);
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

export function isPathWithinAnyRoot(filePath: string, rootPaths: string[]) {
  return rootPaths.some((rootPath) => isPathWithinRoot(filePath, rootPath));
}

export async function removeGeneratedSceneDirs(sceneIds: string[]) {
  for (const sceneId of sceneIds) {
    await rm(getGeneratedSceneDir(sceneId), { recursive: true, force: true });
  }
}

export async function removeGeneratedImageDirs(imageIds: string[]) {
  for (const imageId of imageIds) {
    await rm(getGeneratedImageDir(imageId), { recursive: true, force: true });
  }
}

export async function pruneUntrackedLibraryReferences() {
  const allRoots = await db
    .select({
      path: libraryRoots.path,
      scanVideos: libraryRoots.scanVideos,
      scanImages: libraryRoots.scanImages,
    })
    .from(libraryRoots)
    .where(eq(libraryRoots.enabled, true));

  const videoRootPaths = allRoots.filter((r) => r.scanVideos).map((r) => r.path);
  const imageRootPaths = allRoots.filter((r) => r.scanImages).map((r) => r.path);

  const allKnownScenes = await db
    .select({
      id: scenes.id,
      filePath: scenes.filePath,
    })
    .from(scenes);

  const missingSceneIds = allKnownScenes
    .filter((scene) => scene.filePath && !existsSync(scene.filePath))
    .map((scene) => scene.id);

  if (missingSceneIds.length > 0) {
    await removeGeneratedSceneDirs(missingSceneIds);
    await db.delete(scenes).where(inArray(scenes.id, missingSceneIds));
  }

  const orphanedSceneIds = allKnownScenes
    .filter((scene) => {
      if (!scene.filePath) return false;
      if (missingSceneIds.includes(scene.id)) return false;
      return !isPathWithinAnyRoot(scene.filePath, videoRootPaths);
    })
    .map((scene) => scene.id);

  if (orphanedSceneIds.length > 0) {
    await removeGeneratedSceneDirs(orphanedSceneIds);
    await db.delete(scenes).where(inArray(scenes.id, orphanedSceneIds));
  }

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
