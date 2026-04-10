import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { generateAudioWaveform, getGeneratedAudioTrackDir } from "@obscura/media-core";
import { db, schema } from "../lib/db.js";
import { markJobActive } from "../lib/job-tracking.js";
import path from "node:path";

const { audioTracks } = schema;

export async function processAudioWaveform(job: Job) {
  const trackId = String(job.data.trackId);
  const [track] = await db
    .select({
      id: audioTracks.id,
      title: audioTracks.title,
      filePath: audioTracks.filePath,
      waveformPath: audioTracks.waveformPath,
    })
    .from(audioTracks)
    .where(eq(audioTracks.id, trackId))
    .limit(1);

  if (!track) {
    throw new Error("Audio track not found");
  }

  // Skip if waveform already exists
  if (track.waveformPath) {
    return;
  }

  await markJobActive(job, "audio-waveform", {
    type: "audio-track",
    id: track.id,
    label: track.title,
  });

  const cacheDir = getGeneratedAudioTrackDir(track.id);
  await mkdir(cacheDir, { recursive: true });
  const outputPath = path.join(cacheDir, "waveform.json");

  await generateAudioWaveform(track.filePath, outputPath);

  // Store path relative to cache root
  const relativePath = `audio-tracks/${track.id}/waveform.json`;

  await db
    .update(audioTracks)
    .set({
      waveformPath: relativePath,
      updatedAt: new Date(),
    })
    .where(eq(audioTracks.id, track.id));
}
