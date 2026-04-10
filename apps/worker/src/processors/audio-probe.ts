import { eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import { probeAudioFile, fileNameToTitle } from "@obscura/media-core";
import { db, schema } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { enqueuePendingAudioTrackJob } from "../lib/enqueue.js";
import { ensureLibrarySettingsRow } from "../lib/scheduler.js";

const { audioTracks } = schema;

export async function processAudioProbe(job: Job) {
  const trackId = String(job.data.trackId);
  const [track] = await db
    .select({ id: audioTracks.id, title: audioTracks.title, filePath: audioTracks.filePath })
    .from(audioTracks)
    .where(eq(audioTracks.id, trackId))
    .limit(1);

  if (!track) {
    throw new Error("Audio track not found");
  }

  await markJobActive(job, "audio-probe", {
    type: "audio-track",
    id: track.id,
    label: track.title,
  });

  const metadata = await probeAudioFile(track.filePath);
  await markJobProgress(job, "audio-probe", 50);

  // Update title from embedded tags if the current title is just the filename
  const fileTitle = fileNameToTitle(track.filePath);
  const titleUpdate =
    metadata.embeddedTitle && track.title === fileTitle
      ? metadata.embeddedTitle
      : undefined;

  await db
    .update(audioTracks)
    .set({
      ...(titleUpdate ? { title: titleUpdate } : {}),
      duration: metadata.duration,
      fileSize: metadata.fileSize,
      bitRate: metadata.bitRate,
      sampleRate: metadata.sampleRate,
      channels: metadata.channels,
      codec: metadata.codec,
      container: metadata.container,
      embeddedArtist: metadata.embeddedArtist,
      embeddedAlbum: metadata.embeddedAlbum,
      trackNumber: metadata.trackNumber,
      updatedAt: new Date(),
    })
    .where(eq(audioTracks.id, track.id));

  // Enqueue waveform generation as a downstream job
  const settings = await ensureLibrarySettingsRow();
  if (settings.autoGeneratePreview) {
    await enqueuePendingAudioTrackJob("audio-waveform", trackId, {
      by: "audio-scan",
      label: `Waveform for ${titleUpdate ?? track.title}`,
    });
  }
}
