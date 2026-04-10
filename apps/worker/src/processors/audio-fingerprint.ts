import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { computeMd5, computeOsHash } from "@obscura/media-core";
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

  const md5 = await computeMd5(track.filePath);
  await markJobProgress(job, "audio-fingerprint", 50);
  const oshash = await computeOsHash(track.filePath);

  await db
    .update(audioTracks)
    .set({
      checksumMd5: md5,
      oshash,
      updatedAt: new Date(),
    })
    .where(eq(audioTracks.id, track.id));
}
