import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { computeMd5, computeOsHash, computePhash } from "@obscura/media-core";
import { db, librarySettings, videoEpisodes, videoMovies } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

/**
 * Recognize obscura-phash helper output that means a frame could not be
 * decoded (corrupt source frame, ffmpeg returning garbage on seek, etc.).
 * These files still have a valid MD5 / oshash — only the perceptual hash
 * needs to be skipped.
 */
function isPhashSkipError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  return (
    /obscura-phash/i.test(msg) &&
    (/decode bmp/i.test(msg) ||
      /unknown format/i.test(msg) ||
      /extract frames/i.test(msg) ||
      /ffmpeg:/i.test(msg) ||
      /unexpected output/i.test(msg))
  );
}

type VideoEntityKind = "video_episode" | "video_movie";

export async function processFingerprint(job: Job) {
  const phashOnly = job.data.phashOnly === true;
  const entityKind =
    (job.data.entityKind as VideoEntityKind | undefined) ?? null;

  if (entityKind !== "video_episode" && entityKind !== "video_movie") {
    throw new Error(
      `fingerprint processor received legacy payload ${JSON.stringify(job.data)} — expected entityKind video_episode or video_movie`,
    );
  }

  const [settings] = await db
    .select({ generatePhash: librarySettings.generatePhash })
    .from(librarySettings)
    .limit(1);
  const phashEnabled = settings?.generatePhash === true;

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
    try {
      const phash = await computePhash(row.filePath, row.duration);
      if (phash) update.phash = phash;
    } catch (err) {
      if (isPhashSkipError(err)) {
        console.warn(
          `[fingerprint] Skipping phash for ${entityKind} ${row.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      } else {
        throw err;
      }
    }
    await markJobProgress(job, "fingerprint", 100);
  }
  await db.update(table).set(update).where(eq(table.id, row.id));
}
