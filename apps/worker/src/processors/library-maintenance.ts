import { existsSync } from "node:fs";
import { copyFile, mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { isNotNull } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { getSceneVideoGeneratedDiskPaths } from "@obscura/media-core";
import { db, videoEpisodes, videoMovies } from "../lib/db.js";
import { markJobActive, markJobProgress, type JobPayload } from "../lib/job-tracking.js";

const ASSET_KEYS = ["thumb", "card", "preview", "sprite", "trickplay"] as const;

/**
 * If only `from` exists, move it to `to`. If both exist, drop `from` as a duplicate.
 */
async function consolidateGeneratedFile(from: string, to: string) {
  if (!existsSync(from)) return;
  if (existsSync(to)) {
    await unlink(from);
    return;
  }
  await mkdir(path.dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch {
    await copyFile(from, to);
    await unlink(from);
  }
}

export async function processLibraryMaintenance(job: Job) {
  const payload = job.data as JobPayload & {
    targetDedicated?: boolean;
    sfwRedactJobLog?: boolean;
  };
  const targetDedicated = Boolean(payload.targetDedicated);
  const sfwRedact = Boolean(payload.sfwRedactJobLog);

  await markJobActive(job, "library-maintenance", {
    type: "library",
    id: "scene-asset-layout",
    label: sfwRedact
      ? "Relocate video generated files"
      : targetDedicated
        ? "Video assets → dedicated cache"
        : "Video assets → beside media",
  });

  const fromLayout = targetDedicated ? "sidecar" : "dedicated";
  const toLayout = targetDedicated ? "dedicated" : "sidecar";

  // Walk video_episodes + video_movies. Each row owns the same asset key
  // set, so the consolidation loop is identical for both kinds.
  const episodeRows = await db
    .select({ id: videoEpisodes.id, filePath: videoEpisodes.filePath })
    .from(videoEpisodes)
    .where(isNotNull(videoEpisodes.filePath));

  const movieRows = await db
    .select({ id: videoMovies.id, filePath: videoMovies.filePath })
    .from(videoMovies)
    .where(isNotNull(videoMovies.filePath));

  const rows = [...episodeRows, ...movieRows];

  const total = rows.length;
  let done = 0;

  for (const row of rows) {
    if (!row.filePath) continue;
    const fromPaths = getSceneVideoGeneratedDiskPaths(row.id, row.filePath, fromLayout);
    const toPaths = getSceneVideoGeneratedDiskPaths(row.id, row.filePath, toLayout);
    for (const key of ASSET_KEYS) {
      await consolidateGeneratedFile(fromPaths[key], toPaths[key]);
    }
    done += 1;
    if (total > 0 && done % 20 === 0) {
      await markJobProgress(
        job,
        "library-maintenance",
        Math.min(99, Math.floor((done / total) * 100)),
      );
    }
  }

  await markJobProgress(job, "library-maintenance", 100);
}
