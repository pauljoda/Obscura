import { existsSync } from "node:fs";
import { unlink, rm } from "node:fs/promises";
import { db, schema } from "../db";
import {
  eq,
  ilike,
  sql,
  inArray,
  and,
} from "drizzle-orm";
import type { MultipartFile } from "@fastify/multipart";
import type { UploadAudioTrackResponseDto } from "@obscura/contracts";
import {
  fileNameToTitle,
  getGeneratedAudioTrackDir,
} from "@obscura/media-core";
import { AppError } from "../plugins/error-handler";
import {
  assertDirExists,
  resolveCollisionSafePath,
  streamToFile,
  validateUpload,
} from "../lib/upload";
import { enqueueQueueJob } from "../lib/job-enqueue";
import {
  buildOrderBy,
  toArray,
  resolveTagIds,
  resolvePerformerIds,
  buildRatingConditions,
  buildDateConditions,
  buildBooleanCondition,
  parsePagination,
  type SortConfig,
} from "../lib/query-helpers";

const {
  audioTracks,
  audioTrackPerformers,
  audioTrackTags,
  audioTrackMarkers,
  audioLibraries,
  performers,
  tags,
  studios,
} = schema;

// ─── Sort config ───────────────────────────────────────────────

const sortConfig: SortConfig = {
  columns: {
    recent: audioTracks.createdAt,
    title: audioTracks.title,
    date: audioTracks.date,
    rating: audioTracks.rating,
    duration: audioTracks.duration,
  },
  defaultDirs: {
    recent: "desc",
    title: "asc",
    date: "desc",
    rating: "desc",
    duration: "desc",
  },
  fallbackColumn: audioTracks.createdAt,
};

// ─── List ─────────────────────────────────────────────────────

export async function listAudioTracks(query: {
  search?: string;
  sort?: string;
  order?: string;
  library?: string;
  tag?: string | string[];
  performer?: string | string[];
  studio?: string;
  limit?: string;
  offset?: string;
  ratingMin?: string;
  ratingMax?: string;
  dateFrom?: string;
  dateTo?: string;
  organized?: string;
  nsfw?: string;
}) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 80, 500);
  const conditions: ReturnType<typeof eq>[] = [];

  if (query.library) {
    conditions.push(eq(audioTracks.libraryId, query.library));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      sql`(${audioTracks.title} ILIKE ${term} OR ${audioTracks.embeddedArtist} ILIKE ${term} OR ${audioTracks.embeddedAlbum} ILIKE ${term})`,
    );
  }

  if (query.nsfw === "off") {
    conditions.push(eq(audioTracks.isNsfw, false));
  }

  conditions.push(...buildRatingConditions(audioTracks.rating, query.ratingMin, query.ratingMax));
  conditions.push(...buildDateConditions(audioTracks.date, query.dateFrom, query.dateTo));

  const orgCond = buildBooleanCondition(audioTracks.organized, query.organized);
  if (orgCond) conditions.push(orgCond);

  // Tag filter
  const tagNames = toArray(query.tag);
  if (tagNames.length > 0) {
    const tagIds = await resolveTagIds(tagNames, audioTrackTags, audioTrackTags.trackId, audioTrackTags.tagId);
    if (tagIds === null) return { items: [], total: 0 };
    if (tagIds) {
      conditions.push(inArray(audioTracks.id, tagIds));
    }
  }

  // Performer filter
  const perfNames = toArray(query.performer);
  if (perfNames.length > 0) {
    const perfIds = await resolvePerformerIds(perfNames, audioTrackPerformers, audioTrackPerformers.trackId, audioTrackPerformers.performerId);
    if (perfIds === null) return { items: [], total: 0 };
    if (perfIds) {
      conditions.push(inArray(audioTracks.id, perfIds));
    }
  }

  // Studio filter
  if (query.studio) {
    const [st] = await db
      .select({ id: studios.id })
      .from(studios)
      .where(ilike(studios.name, query.studio))
      .limit(1);
    if (st) {
      conditions.push(eq(audioTracks.studioId, st.id));
    } else {
      return { items: [], total: 0 };
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(audioTracks)
    .where(where);

  const rows = await db
    .select()
    .from(audioTracks)
    .where(where)
    .orderBy(buildOrderBy(sortConfig, query.sort, query.order))
    .limit(limit)
    .offset(offset);

  // Batch performers + tags
  const ids = rows.map((r) => r.id);
  const perfLinks = ids.length > 0
    ? await db
        .select({
          trackId: audioTrackPerformers.trackId,
          performerId: performers.id,
          performerName: performers.name,
        })
        .from(audioTrackPerformers)
        .innerJoin(performers, eq(audioTrackPerformers.performerId, performers.id))
        .where(inArray(audioTrackPerformers.trackId, ids))
    : [];

  const tagLinks = ids.length > 0
    ? await db
        .select({
          trackId: audioTrackTags.trackId,
          tagId: tags.id,
          tagName: tags.name,
          tagIsNsfw: tags.isNsfw,
        })
        .from(audioTrackTags)
        .innerJoin(tags, eq(audioTrackTags.tagId, tags.id))
        .where(inArray(audioTrackTags.trackId, ids))
    : [];

  const items = rows.map((t) => ({
    id: t.id,
    title: t.title,
    date: t.date,
    rating: t.rating,
    organized: t.organized,
    isNsfw: t.isNsfw,
    duration: t.duration,
    bitRate: t.bitRate,
    sampleRate: t.sampleRate,
    channels: t.channels,
    codec: t.codec,
    fileSize: t.fileSize,
    embeddedArtist: t.embeddedArtist,
    embeddedAlbum: t.embeddedAlbum,
    trackNumber: t.trackNumber,
    waveformPath: t.waveformPath,
    libraryId: t.libraryId,
    sortOrder: t.sortOrder,
    studioId: t.studioId,
    performers: perfLinks
      .filter((p) => p.trackId === t.id)
      .map((p) => ({ id: p.performerId, name: p.performerName })),
    tags: tagLinks
      .filter((tl) => tl.trackId === t.id)
      .map((tl) => ({ id: tl.tagId, name: tl.tagName, isNsfw: tl.tagIsNsfw })),
    playCount: t.playCount,
    lastPlayedAt: t.lastPlayedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));

  return { items, total: countResult.count };
}

// ─── getTracksByIds ───────────────────────────────────────────

/**
 * Fetch multiple audio tracks by IDs, returning list-item projections.
 * Used by the collections service for polymorphic entity loading.
 */
export async function getTracksByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(audioTracks)
    .where(inArray(audioTracks.id, ids));

  const trackIds = rows.map((r) => r.id);

  const [perfLinks, tagLinks] = await Promise.all([
    trackIds.length > 0
      ? db
          .select({
            trackId: audioTrackPerformers.trackId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(audioTrackPerformers)
          .innerJoin(
            performers,
            eq(audioTrackPerformers.performerId, performers.id),
          )
          .where(inArray(audioTrackPerformers.trackId, trackIds))
      : [],
    trackIds.length > 0
      ? db
          .select({
            trackId: audioTrackTags.trackId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(audioTrackTags)
          .innerJoin(tags, eq(audioTrackTags.tagId, tags.id))
          .where(inArray(audioTrackTags.trackId, trackIds))
      : [],
  ]);

  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    date: t.date,
    rating: t.rating,
    organized: t.organized,
    isNsfw: t.isNsfw,
    duration: t.duration,
    bitRate: t.bitRate,
    sampleRate: t.sampleRate,
    channels: t.channels,
    codec: t.codec,
    fileSize: t.fileSize,
    embeddedArtist: t.embeddedArtist,
    embeddedAlbum: t.embeddedAlbum,
    trackNumber: t.trackNumber,
    waveformPath: t.waveformPath,
    libraryId: t.libraryId,
    sortOrder: t.sortOrder,
    studioId: t.studioId,
    performers: perfLinks
      .filter((p) => p.trackId === t.id)
      .map((p) => ({ id: p.performerId, name: p.performerName })),
    tags: tagLinks
      .filter((tl) => tl.trackId === t.id)
      .map((tl) => ({
        id: tl.tagId,
        name: tl.tagName,
        isNsfw: tl.tagIsNsfw,
      })),
    playCount: t.playCount,
    lastPlayedAt: t.lastPlayedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));
}

// ─── Detail ────────────────────────────────────────────────────

export async function getAudioTrackById(id: string) {
  const [track] = await db.select().from(audioTracks).where(eq(audioTracks.id, id)).limit(1);
  if (!track) throw new AppError(404, "Audio track not found");

  const perfRows = await db
    .select({ id: performers.id, name: performers.name })
    .from(audioTrackPerformers)
    .innerJoin(performers, eq(audioTrackPerformers.performerId, performers.id))
    .where(eq(audioTrackPerformers.trackId, id));

  const tagRows = await db
    .select({ id: tags.id, name: tags.name, isNsfw: tags.isNsfw })
    .from(audioTrackTags)
    .innerJoin(tags, eq(audioTrackTags.tagId, tags.id))
    .where(eq(audioTrackTags.trackId, id));

  let studio: { id: string; name: string } | null = null;
  if (track.studioId) {
    const [s] = await db
      .select({ id: studios.id, name: studios.name })
      .from(studios)
      .where(eq(studios.id, track.studioId))
      .limit(1);
    studio = s ?? null;
  }

  // Markers
  const markers = await db
    .select()
    .from(audioTrackMarkers)
    .where(eq(audioTrackMarkers.trackId, id))
    .orderBy(sql`${audioTrackMarkers.seconds} ASC`);

  return {
    id: track.id,
    title: track.title,
    details: track.details,
    date: track.date,
    rating: track.rating,
    organized: track.organized,
    isNsfw: track.isNsfw,
    duration: track.duration,
    bitRate: track.bitRate,
    sampleRate: track.sampleRate,
    channels: track.channels,
    codec: track.codec,
    container: track.container,
    fileSize: track.fileSize,
    filePath: track.filePath,
    embeddedArtist: track.embeddedArtist,
    embeddedAlbum: track.embeddedAlbum,
    trackNumber: track.trackNumber,
    waveformPath: track.waveformPath,
    checksumMd5: track.checksumMd5,
    oshash: track.oshash,
    libraryId: track.libraryId,
    sortOrder: track.sortOrder,
    studioId: track.studioId,
    studio,
    performers: perfRows,
    tags: tagRows,
    markers: markers.map((m) => ({
      id: m.id,
      trackId: m.trackId,
      title: m.title,
      seconds: m.seconds,
      endSeconds: m.endSeconds,
    })),
    playCount: track.playCount,
    playDuration: track.playDuration,
    resumeTime: track.resumeTime,
    lastPlayedAt: track.lastPlayedAt?.toISOString() ?? null,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  };
}

// ─── Update ────────────────────────────────────────────────────

export async function updateAudioTrack(
  id: string,
  body: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    organized?: boolean;
    isNsfw?: boolean;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
  },
) {
  const [track] = await db.select({ id: audioTracks.id }).from(audioTracks).where(eq(audioTracks.id, id)).limit(1);
  if (!track) throw new AppError(404, "Audio track not found");

  await db.transaction(async (tx) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.details !== undefined) updates.details = body.details;
    if (body.date !== undefined) updates.date = body.date;
    if (body.rating !== undefined) updates.rating = body.rating;
    if (body.organized !== undefined) updates.organized = body.organized;
    if (body.isNsfw !== undefined) updates.isNsfw = body.isNsfw;

    if (body.studioName !== undefined) {
      if (body.studioName) {
        const [existing] = await tx
          .select({ id: studios.id })
          .from(studios)
          .where(ilike(studios.name, body.studioName.trim()))
          .limit(1);
        updates.studioId = existing?.id ?? null;
      } else {
        updates.studioId = null;
      }
    }

    await tx.update(audioTracks).set(updates).where(eq(audioTracks.id, id));

    if (body.performerNames !== undefined) {
      await tx.delete(audioTrackPerformers).where(eq(audioTrackPerformers.trackId, id));
      for (const name of body.performerNames) {
        const [existing] = await tx
          .select({ id: performers.id })
          .from(performers)
          .where(ilike(performers.name, name.trim()))
          .limit(1);
        const performerId = existing?.id ??
          (await tx.insert(performers).values({ name: name.trim() }).returning({ id: performers.id }))[0].id;
        await tx.insert(audioTrackPerformers).values({ trackId: id, performerId }).onConflictDoNothing();
      }
    }

    if (body.tagNames !== undefined) {
      await tx.delete(audioTrackTags).where(eq(audioTrackTags.trackId, id));
      for (const name of body.tagNames) {
        const [existing] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(ilike(tags.name, name.trim()))
          .limit(1);
        const tagId = existing?.id ??
          (await tx.insert(tags).values({ name: name.trim() }).returning({ id: tags.id }))[0].id;
        await tx.insert(audioTrackTags).values({ trackId: id, tagId }).onConflictDoNothing();
      }
    }
  });
}

// ─── Play tracking ────────────────────────────────────────────

export async function recordPlay(id: string) {
  const [track] = await db.select({ id: audioTracks.id }).from(audioTracks).where(eq(audioTracks.id, id)).limit(1);
  if (!track) throw new AppError(404, "Audio track not found");

  await db
    .update(audioTracks)
    .set({
      playCount: sql`${audioTracks.playCount} + 1`,
      lastPlayedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(audioTracks.id, id));
}

// ─── Markers ──────────────────────────────────────────────────

export async function createMarker(
  trackId: string,
  body: { title: string; seconds: number; endSeconds?: number | null },
) {
  const [track] = await db.select({ id: audioTracks.id }).from(audioTracks).where(eq(audioTracks.id, trackId)).limit(1);
  if (!track) throw new AppError(404, "Audio track not found");

  const [marker] = await db
    .insert(audioTrackMarkers)
    .values({
      trackId,
      title: body.title,
      seconds: body.seconds,
      endSeconds: body.endSeconds ?? null,
    })
    .returning();

  return marker;
}

export async function updateMarker(
  markerId: string,
  body: { title?: string; seconds?: number; endSeconds?: number | null },
) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.seconds !== undefined) updates.seconds = body.seconds;
  if (body.endSeconds !== undefined) updates.endSeconds = body.endSeconds;

  await db.update(audioTrackMarkers).set(updates).where(eq(audioTrackMarkers.id, markerId));
}

export async function deleteMarker(markerId: string) {
  await db.delete(audioTrackMarkers).where(eq(audioTrackMarkers.id, markerId));
}

// ─── uploadTrack ───────────────────────────────────────────────

/**
 * Upload an audio file into an audio library's folder and create the
 * matching `audio_tracks` row. Requires the library to have a folderPath
 * that exists on disk.
 */
export async function uploadTrack(
  libraryId: string,
  file: MultipartFile,
): Promise<UploadAudioTrackResponseDto> {
  const [library] = await db
    .select({
      id: audioLibraries.id,
      title: audioLibraries.title,
      folderPath: audioLibraries.folderPath,
      isNsfw: audioLibraries.isNsfw,
    })
    .from(audioLibraries)
    .where(eq(audioLibraries.id, libraryId))
    .limit(1);
  if (!library) {
    throw new AppError(404, "Audio library not found");
  }
  if (!library.folderPath) {
    throw new AppError(400, "Audio library is not folder-backed");
  }
  await assertDirExists(library.folderPath);

  const { safeName } = validateUpload(file, { category: "audio" });
  const dest = await resolveCollisionSafePath(library.folderPath, safeName);
  const { bytesWritten } = await streamToFile(file, dest);

  const [created] = await db
    .insert(audioTracks)
    .values({
      title: fileNameToTitle(dest),
      filePath: dest,
      fileSize: bytesWritten,
      libraryId: library.id,
      organized: false,
      isNsfw: library.isNsfw ?? false,
    })
    .returning({
      id: audioTracks.id,
      title: audioTracks.title,
      filePath: audioTracks.filePath,
    });

  if (!created) {
    throw new AppError(500, "Failed to create audio track row after upload");
  }

  await db
    .update(audioLibraries)
    .set({
      trackCount: sql`${audioLibraries.trackCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(audioLibraries.id, library.id));

  const target = {
    type: "audio-track" as const,
    id: created.id,
    label: created.title,
  };
  const trigger = {
    by: "manual" as const,
    label: `Queued after upload to ${library.title}`,
  };
  await enqueueQueueJob({
    queueName: "audio-probe",
    jobName: "audio-probe",
    data: { trackId: created.id },
    target,
    trigger,
  });
  await enqueueQueueJob({
    queueName: "audio-fingerprint",
    jobName: "audio-fingerprint",
    data: { trackId: created.id },
    target,
    trigger,
  });
  await enqueueQueueJob({
    queueName: "audio-waveform",
    jobName: "audio-waveform",
    data: { trackId: created.id },
    target,
    trigger,
  });

  return {
    id: created.id,
    title: created.title,
    filePath: created.filePath,
    libraryId: library.id,
  };
}

// ─── deleteTrack ───────────────────────────────────────────────

/**
 * Delete a single audio track. Cascades join tables + markers via FK,
 * wipes the generated waveform/cover dir, and optionally unlinks the
 * source file on disk.
 */
export async function deleteTrack(id: string, deleteFile: boolean) {
  const [existing] = await db
    .select({
      id: audioTracks.id,
      filePath: audioTracks.filePath,
      libraryId: audioTracks.libraryId,
    })
    .from(audioTracks)
    .where(eq(audioTracks.id, id))
    .limit(1);
  if (!existing) {
    throw new AppError(404, "Audio track not found");
  }

  await db.delete(audioTracks).where(eq(audioTracks.id, id));

  if (existing.libraryId) {
    await db
      .update(audioLibraries)
      .set({
        trackCount: sql`GREATEST(${audioLibraries.trackCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(audioLibraries.id, existing.libraryId));
  }

  const genDir = getGeneratedAudioTrackDir(id);
  try {
    if (existsSync(genDir)) await rm(genDir, { recursive: true });
  } catch {
    // non-fatal
  }

  if (deleteFile && existing.filePath) {
    try {
      if (existsSync(existing.filePath)) await unlink(existing.filePath);
    } catch {
      // non-fatal
    }
  }

  return { ok: true as const };
}
