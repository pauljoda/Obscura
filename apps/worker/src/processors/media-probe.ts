import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { probeVideoFile } from "@obscura/media-core";
import { db, scenes } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

/** Probe the file on disk and persist format/dimensions/duration into `scenes`. */
export async function applyVideoProbeToScene(sceneId: string, filePath: string) {
  const metadata = await probeVideoFile(filePath);
  await db
    .update(scenes)
    .set({
      fileSize: metadata.fileSize,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      frameRate: metadata.frameRate,
      bitRate: metadata.bitRate,
      codec: metadata.codec,
      container: metadata.container,
      updatedAt: new Date(),
    })
    .where(eq(scenes.id, sceneId));
  return metadata;
}

export async function processMediaProbe(job: Job) {
  const sceneId = String(job.data.sceneId);
  const [scene] = await db
    .select({ id: scenes.id, title: scenes.title, filePath: scenes.filePath })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene?.filePath) {
    throw new Error("Video file not found");
  }

  await markJobActive(job, "media-probe", {
    type: "scene",
    id: scene.id,
    label: scene.title,
  });

  await applyVideoProbeToScene(scene.id, scene.filePath);
  await markJobProgress(job, "media-probe", 70);
}
