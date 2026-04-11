import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { computeMd5, computeOsHash, computePhash } from "@obscura/media-core";
import { db, librarySettings, scenes } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

export async function processFingerprint(job: Job) {
  const sceneId = String(job.data.sceneId);
  const phashOnly = job.data.phashOnly === true;

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

  const [settings] = await db
    .select({ generatePhash: librarySettings.generatePhash })
    .from(librarySettings)
    .limit(1);
  const phashEnabled = settings?.generatePhash === true;

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
