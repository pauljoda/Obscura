import { existsSync } from "node:fs";
import { copyFile, mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { isNotNull } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { getSceneVideoGeneratedDiskPaths } from "@obscura/media-core";
import { db, scenes } from "../lib/db.js";
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
  const payload = job.data as JobPayload & { targetDedicated?: boolean; sfwRedactJobLog?: boolean };
  const targetDedicated = Boolean(payload.targetDedicated);
  const sfwRedact = Boolean(payload.sfwRedactJobLog);

  await markJobActive(job, "library-maintenance", {
    type: "library",
    id: "scene-asset-layout",
    label: sfwRedact
      ? "Relocate scene generated files"
      : targetDedicated
        ? "Scene assets → dedicated cache"
        : "Scene assets → beside media",
  });

  const fromLayout = targetDedicated ? "sidecar" : "dedicated";
  const toLayout = targetDedicated ? "dedicated" : "sidecar";

  const rows = await db
    .select({ id: scenes.id, filePath: scenes.filePath })
    .from(scenes)
    .where(isNotNull(scenes.filePath));

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
      await markJobProgress(job, "library-maintenance", Math.min(99, Math.floor((done / total) * 100)));
    }
  }

  await markJobProgress(job, "library-maintenance", 100);
}
