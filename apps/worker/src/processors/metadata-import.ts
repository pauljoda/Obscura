import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { db, videoEpisodes, videoMovies } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

type VideoEntityKind = "video_episode" | "video_movie";

/**
 * Metadata-provider sync job. Kept as a thin passthrough — the real work
 * lives in the plugin-driven identify flow; this processor exists to show
 * up as a trackable row in the Operations dashboard when the provider sync
 * is queued. Accepts either an `entityKind` + `entityId` discriminator (new
 * video model) or a bare job with no target (generic provider sync).
 */
export async function processMetadataImport(job: Job) {
  const entityKind =
    (job.data.entityKind as VideoEntityKind | undefined) ?? null;
  const entityId = job.data.entityId ? String(job.data.entityId) : "";

  let target: { id: string; title: string | null } | null = null;
  if (entityKind === "video_episode" && entityId) {
    const [row] = await db
      .select({ id: videoEpisodes.id, title: videoEpisodes.title })
      .from(videoEpisodes)
      .where(eq(videoEpisodes.id, entityId))
      .limit(1);
    target = row ?? null;
  } else if (entityKind === "video_movie" && entityId) {
    const [row] = await db
      .select({ id: videoMovies.id, title: videoMovies.title })
      .from(videoMovies)
      .where(eq(videoMovies.id, entityId))
      .limit(1);
    target = row ?? null;
  }

  await markJobActive(job, "metadata-import", {
    type: target ? entityKind ?? undefined : undefined,
    id: target?.id,
    label: target?.title ?? "Metadata provider sync",
  });

  await markJobProgress(job, "metadata-import", 100);
}
