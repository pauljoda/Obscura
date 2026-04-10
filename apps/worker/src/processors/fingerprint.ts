import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { computeMd5, computeOsHash } from "@obscura/media-core";
import { db, scenes } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

export async function processFingerprint(job: Job) {
  const sceneId = String(job.data.sceneId);
  const [scene] = await db
    .select({ id: scenes.id, title: scenes.title, filePath: scenes.filePath })
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

  const md5 = await computeMd5(scene.filePath);
  await markJobProgress(job, "fingerprint", 50);
  const oshash = await computeOsHash(scene.filePath);

  await db
    .update(scenes)
    .set({
      checksumMd5: md5,
      oshash,
      updatedAt: new Date(),
    })
    .where(eq(scenes.id, scene.id));
}
