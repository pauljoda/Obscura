import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { computeMd5, computeOsHash, computePhash } from "@obscura/media-core";
import {
  db,
  librarySettings,
  scenes,
  videoEpisodes,
  videoMovies,
} from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

type VideoEntityKind = "video_episode" | "video_movie";

export async function processFingerprint(job: Job) {
  const phashOnly = job.data.phashOnly === true;
  const entityKind = (job.data.entityKind as VideoEntityKind | undefined) ?? null;

  const [settings] = await db
    .select({ generatePhash: librarySettings.generatePhash })
    .from(librarySettings)
    .limit(1);
  const phashEnabled = settings?.generatePhash === true;

  if (entityKind === "video_episode" || entityKind === "video_movie") {
    const entityId = String(job.data.entityId);
    const table = entityKind === "video_episode" ? videoEpisodes : videoMovies;
    const [row] = await db
      .select({
        id: table.id,
        title: table.title,
        filePath: table.filePath,
        duration: table.duration,
      })
      .from(table)
      .where(eq(table.id, entityId))
      .limit(1);

    if (!row?.filePath) {
      throw new Error("Video file not found");
    }

    await markJobActive(job, "fingerprint", {
      type: entityKind,
      id: row.id,
      label: row.title ?? undefined,
    });

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (!phashOnly) {
      update.checksumMd5 = await computeMd5(row.filePath);
      await markJobProgress(job, "fingerprint", phashEnabled ? 33 : 50);
      update.oshash = await computeOsHash(row.filePath);
      await markJobProgress(job, "fingerprint", phashEnabled ? 66 : 100);
    }
    if (phashEnabled || phashOnly) {
      const phash = await computePhash(row.filePath, row.duration);
      if (phash) update.phash = phash;
      await markJobProgress(job, "fingerprint", 100);
    }
    await db.update(table).set(update).where(eq(table.id, row.id));
    return;
  }

  const sceneId = String(job.data.sceneId);
  const [scene] = await db
    .select({
      id: scenes.id,
      title: scenes.title,
      filePath: scenes.filePath,
      duration: scenes.duration,
    })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene?.filePath) {
    throw new Error("Video file not found");
  }

  await markJobActive(job, "fingerprint", {
    type: "scene",
    id: scene.id,
    label: scene.title,
  });

  const update: Partial<typeof scenes.$inferInsert> = { updatedAt: new Date() };

  if (!phashOnly) {
    update.checksumMd5 = await computeMd5(scene.filePath);
    await markJobProgress(job, "fingerprint", phashEnabled ? 33 : 50);
    update.oshash = await computeOsHash(scene.filePath);
    await markJobProgress(job, "fingerprint", phashEnabled ? 66 : 100);
  }

  if (phashEnabled || phashOnly) {
    const phash = await computePhash(scene.filePath, scene.duration);
    if (phash) {
      update.phash = phash;
    }
    await markJobProgress(job, "fingerprint", 100);
  }

  await db.update(scenes).set(update).where(eq(scenes.id, scene.id));
}
