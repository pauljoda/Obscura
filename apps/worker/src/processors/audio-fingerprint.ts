import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { computeMd5AndOsHash } from "@obscura/media-core";
import { db, schema } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

const { audioTracks } = schema;

export async function processAudioFingerprint(job: Job) {
  const trackId = String(job.data.trackId);
  const [track] = await db
    .select({ id: audioTracks.id, title: audioTracks.title, filePath: audioTracks.filePath })
    .from(audioTracks)
    .where(eq(audioTracks.id, trackId))
    .limit(1);

  if (!track) {
    throw new Error("Audio track not found");
  }

  await markJobActive(job, "audio-fingerprint", {
    type: "audio-track",
    id: track.id,
    label: track.title,
  });

  const { md5, oshash } = await computeMd5AndOsHash(track.filePath);
  await markJobProgress(job, "audio-fingerprint", 80);

  await db
    .update(audioTracks)
    .set({
      checksumMd5: md5,
      oshash,
      updatedAt: new Date(),
    })
    .where(eq(audioTracks.id, track.id));
}
