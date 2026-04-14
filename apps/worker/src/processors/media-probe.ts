import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { probeVideoFile } from "@obscura/media-core";
import { db, scenes, videoEpisodes, videoMovies } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { enqueuePendingSceneJob } from "../lib/enqueue.js";

type VideoEntityKind = "video_episode" | "video_movie";

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
  const entityKind = (job.data.entityKind as VideoEntityKind | undefined) ?? null;

  if (entityKind === "video_episode" || entityKind === "video_movie") {
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

    await applyVideoProbeToVideoEntity(entityKind, row.id, row.filePath);
    await markJobProgress(job, "media-probe", 100);
    return;
  }

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

  // Auto-extract embedded subtitle tracks (best-effort; the processor
  // tolerates videos with no subtitle streams).
  try {
    await enqueuePendingSceneJob("extract-subtitles", scene.id, {
      by: "system",
      label: "Queued after media probe",
    });
  } catch (err) {
    console.warn(
      `[media-probe] failed to enqueue extract-subtitles for ${scene.id}: ${(err as Error).message}`
    );
  }
}
