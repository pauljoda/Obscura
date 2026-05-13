import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getCacheRootDir } from "@obscura/media-core";

export interface StorageStats {
  thumbnailsBytes: number;
  previewsBytes: number;
  trickplayBytes: number;
  totalBytes: number;
}

export async function getStorageStats(): Promise<StorageStats> {
  const rootPath = path.join(getCacheRootDir(), "videos");
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

      if (!entry.isFile()) continue;

      const info = await stat(entryPath);

      if (entry.name.endsWith(".mp4")) {
        previewsBytes += info.size;
        continue;
      }
      if (entry.name.endsWith(".vtt") || entry.name.includes("sprite")) {
        trickplayBytes += info.size;
        continue;
      }
      if (
        entry.name.endsWith(".jpg") ||
        entry.name.endsWith(".jpeg") ||
        entry.name.endsWith(".png")
      ) {
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
