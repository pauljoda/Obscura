import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getCacheRootDir } from "@obscura/media-core";
import { db, schema } from "../db";

const { librarySettings } = schema;

export async function ensureLibrarySettingsRow() {
  const [existing] = await db.select().from(librarySettings).limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db.insert(librarySettings).values({}).returning();
  return created;
}

export async function verifyDirectory(targetPath: string) {
  const stats = await stat(targetPath);
  if (!stats.isDirectory()) {
    throw new Error("Path is not a directory");
  }
}

export async function browseDirectories(rawPath?: string) {
  const resolvedPath = path.resolve(rawPath?.trim() || process.cwd());
  await verifyDirectory(resolvedPath);

  const entries = await readdir(resolvedPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(resolvedPath, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const parentPath = path.dirname(resolvedPath);

  return {
    path: resolvedPath,
    parentPath: parentPath === resolvedPath ? null : parentPath,
    directories,
  };
}

export async function getStorageStats() {
  const rootPath = path.join(getCacheRootDir(), "scenes");
  let thumbnailsBytes = 0;
  let previewsBytes = 0;
  let trickplayBytes = 0;

  async function walk(currentPath: string): Promise<void> {
    try {
      await access(currentPath);
    } catch {
      return;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const info = await stat(entryPath);

      if (entry.name.endsWith(".mp4")) {
        previewsBytes += info.size;
        continue;
      }

      if (entry.name.endsWith(".vtt") || entry.name.includes("sprite")) {
        trickplayBytes += info.size;
        continue;
      }

      if (entry.name.endsWith(".jpg") || entry.name.endsWith(".jpeg") || entry.name.endsWith(".png")) {
        thumbnailsBytes += info.size;
      }
    }
  }

  await walk(rootPath);

  return {
    thumbnailsBytes,
    previewsBytes,
    trickplayBytes,
    totalBytes: thumbnailsBytes + previewsBytes + trickplayBytes,
  };
}
