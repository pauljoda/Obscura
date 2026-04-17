import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { CorruptMediaError, probeVideoFile } from "@obscura/media-core";
import { db, videoEpisodes, videoMovies } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

type VideoEntityKind = "video_episode" | "video_movie";

/**
 * Probe a video entity (episode or movie) and persist the technical
 * metadata onto the appropriate table.
 */
export async function applyVideoProbeToVideoEntity(
  kind: VideoEntityKind,
  entityId: string,
  filePath: string,
) {
  const metadata = await probeVideoFile(filePath);
  const table = kind === "video_episode" ? videoEpisodes : videoMovies;
  await db
    .update(table)
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
    .where(eq(table.id, entityId));
  return metadata;
}

export async function processMediaProbe(job: Job) {
  const entityKind =
    (job.data.entityKind as VideoEntityKind | undefined) ?? null;

  if (entityKind !== "video_episode" && entityKind !== "video_movie") {
    throw new Error(
      `media-probe processor received legacy payload ${JSON.stringify(job.data)} — expected entityKind video_episode or video_movie`,
    );
  }

  const entityId = String(job.data.entityId);
  const table = entityKind === "video_episode" ? videoEpisodes : videoMovies;
  const [row] = await db
    .select({ id: table.id, title: table.title, filePath: table.filePath })
    .from(table)
    .where(eq(table.id, entityId))
    .limit(1);

  if (!row?.filePath) {
    throw new Error("Video file not found");
  }

  await markJobActive(job, "media-probe", {
    type: entityKind,
    id: row.id,
    label: row.title ?? undefined,
  });

  try {
    await applyVideoProbeToVideoEntity(entityKind, row.id, row.filePath);
  } catch (err) {
    if (err instanceof CorruptMediaError) {
      // Source file is broken on disk (truncated, missing moov atom, etc.).
      // Retrying won't help — log a warning and let the job complete so the
      // Operations dashboard isn't permanently red for unplayable media.
      console.warn(
        `[media-probe] Skipping corrupt ${entityKind} ${row.id}: ${err.message}`,
      );
    } else {
      throw err;
    }
  }
  await markJobProgress(job, "media-probe", 100);
}
