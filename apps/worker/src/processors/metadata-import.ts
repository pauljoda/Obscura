import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { db, scenes } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

export async function processMetadataImport(job: Job) {
  const sceneId = String(job.data.sceneId ?? "");
  const [scene] = sceneId
    ? await db
        .select({ id: scenes.id, title: scenes.title })
        .from(scenes)
        .where(eq(scenes.id, sceneId))
        .limit(1)
    : [];

  await markJobActive(job, "metadata-import", {
    type: scene ? "scene" : undefined,
    id: scene?.id,
    label: scene?.title ?? "Metadata provider sync",
  });

  await markJobProgress(job, "metadata-import", 100);
}
