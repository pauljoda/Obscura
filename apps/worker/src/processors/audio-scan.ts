import path from "node:path";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  discoverAudioFilesAndDirs,
  fileNameToTitle,
} from "@obscura/media-core";
import { db, libraryRoots, schema } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { enqueuePendingAudioTrackJob } from "../lib/enqueue.js";
import { ensureLibrarySettingsRow } from "../lib/scheduler.js";

const { audioLibraries, audioTracks } = schema;

export async function processAudioScan(job: Job) {
  const sfwOnly = Boolean(job.data.sfwOnly);
  const libraryRootId = String(job.data.libraryRootId);
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, libraryRootId))
    .limit(1);

  if (!root) {
    throw new Error("Library root not found");
  }

  if (!(root.scanAudio ?? true)) {
    return;
  }

  await markJobActive(job, "audio-scan", {
    type: "library-root",
    id: root.id,
    label: root.label,
  });

  const settings = await ensureLibrarySettingsRow();
  const discovery = await discoverAudioFilesAndDirs(root.path, root.recursive);

  // -- Cleanup stale audio libraries --
  const knownLibraries = await db
    .select({ id: audioLibraries.id, folderPath: audioLibraries.folderPath })
    .from(audioLibraries)
    .where(like(audioLibraries.folderPath, `${root.path}%`));

  const discoveredDirSet = new Set(discovery.dirs);
  const staleLibraryIds = knownLibraries
    .filter((l) => l.folderPath && !discoveredDirSet.has(l.folderPath))
    .map((l) => l.id);

  if (staleLibraryIds.length > 0) {
    await db.delete(audioLibraries).where(inArray(audioLibraries.id, staleLibraryIds));
  }

  // -- Cleanup stale audio tracks --
  const knownTracks = await db
    .select({ id: audioTracks.id, filePath: audioTracks.filePath })
    .from(audioTracks)
    .where(like(audioTracks.filePath, `${root.path}%`));

  const discoveredFileSet = new Set(discovery.audioFiles);
  const staleTrackIds = knownTracks
    .filter((t) => !discoveredFileSet.has(t.filePath))
    .map((t) => t.id);

  if (staleTrackIds.length > 0) {
    await db.delete(audioTracks).where(inArray(audioTracks.id, staleTrackIds));
  }

  // -- Group audio files by directory --
  const filesByDir = new Map<string, string[]>();
  for (const file of discovery.audioFiles) {
    const dir = path.dirname(file);
    const existing = filesByDir.get(dir);
    if (existing) {
      existing.push(file);
    } else {
      filesByDir.set(dir, [file]);
    }
  }

  // Sort directories by depth (parent before child) for parentId resolution
  const sortedDirs = [...discovery.dirs].sort(
    (a, b) => a.split(path.sep).length - b.split(path.sep).length,
  );

  const totalWork = sortedDirs.length;
  let processed = 0;

  for (const dirPath of sortedDirs) {
    const dirFiles = filesByDir.get(dirPath) ?? [];
    if (dirFiles.length === 0) continue;

    // Upsert audio library
    const [existingLib] = await db
      .select({ id: audioLibraries.id })
      .from(audioLibraries)
      .where(eq(audioLibraries.folderPath, dirPath))
      .limit(1);

    let libraryId: string;

    if (existingLib) {
      libraryId = existingLib.id;
    } else {
      // Find parent library
      const parentDir = path.dirname(dirPath);
      let parentId: string | null = null;
      if (parentDir !== dirPath && parentDir.startsWith(root.path)) {
        const [parentLib] = await db
          .select({ id: audioLibraries.id })
          .from(audioLibraries)
          .where(eq(audioLibraries.folderPath, parentDir))
          .limit(1);
        parentId = parentLib?.id ?? null;
      }

      const [created] = await db
        .insert(audioLibraries)
        .values({
          title: path.basename(dirPath),
          folderPath: dirPath,
          parentId,
          trackCount: 0,
          isNsfw: root.isNsfw,
        })
        .returning({ id: audioLibraries.id });
      libraryId = created.id;
    }

    // Upsert tracks
    const sortedFiles = [...dirFiles].sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < sortedFiles.length; i++) {
      const filePath = sortedFiles[i];

      const [existingTrack] = await db
        .select({ id: audioTracks.id, duration: audioTracks.duration })
        .from(audioTracks)
        .where(eq(audioTracks.filePath, filePath))
        .limit(1);

      let trackId: string;
      let isNew = false;

      if (existingTrack) {
        trackId = existingTrack.id;
        await db
          .update(audioTracks)
          .set({ libraryId, sortOrder: i, updatedAt: new Date() })
          .where(eq(audioTracks.id, trackId));
        // Re-enqueue probe if duration is missing
        if (existingTrack.duration == null) {
          await enqueuePendingAudioTrackJob("audio-probe", trackId, {
            by: "audio-scan",
            label: `Queued during ${root.label} audio scan`,
          });
        }
      } else {
        const [created] = await db
          .insert(audioTracks)
          .values({
            title: fileNameToTitle(filePath),
            filePath,
            libraryId,
            sortOrder: i,
            isNsfw: root.isNsfw,
          })
          .returning({ id: audioTracks.id });
        trackId = created.id;
        isNew = true;
      }

      if (isNew) {
        // Enqueue probe (extracts metadata + embedded tags)
        await enqueuePendingAudioTrackJob("audio-probe", trackId, {
          by: "audio-scan",
          label: `Queued during ${root.label} audio scan`,
        });

        // Enqueue fingerprint
        if (settings.autoGenerateFingerprints) {
          await enqueuePendingAudioTrackJob("audio-fingerprint", trackId, {
            by: "audio-scan",
            label: `Queued during ${root.label} audio scan`,
          });
        }
      }
    }

    // Update library track count
    await db.execute(sql`
      UPDATE audio_libraries SET track_count = (
        SELECT count(*) FROM audio_tracks WHERE library_id = ${libraryId}
      ), updated_at = NOW() WHERE id = ${libraryId}
    `);

    processed++;
    if (totalWork > 0) {
      await markJobProgress(job, "audio-scan", Math.round((processed / totalWork) * 100));
    }
  }
}
