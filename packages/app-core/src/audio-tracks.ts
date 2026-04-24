import { existsSync } from "node:fs";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AppDb } from "@obscura/db";
import { schema } from "@obscura/db";
import {
  fileNameToTitle,
  getGeneratedAudioTrackDir,
} from "@obscura/media-core";
import { NotFoundError, ValidationError } from "./errors";
import { buildHierarchyScopeConditions } from "./hierarchy";
import { audioTrackVisibleSql } from "./library-root-visibility";
import { enqueueQueueJob } from "./queue-writes";
import {
  assertDirExists,
  resolveCollisionSafePath,
  validateUploadInput,
  writeUploadBuffer,
  type UploadFileInput,
} from "./upload-utils";
import {
  buildBooleanCondition,
  buildDateConditions,
  buildOrderBy,
  buildRatingConditions,
  parsePagination,
  resolvePerformerIds,
  resolveTagIds,
  toArray,
  type SortConfig,
} from "./media-query-helpers";
import {
  findOrCreatePerformerId,
  findOrCreateStudioId,
  findOrCreateTagId,
} from "./media-shared";

const {
  audioLibraries,
  audioTracks,
  audioTrackPerformers,
  audioTrackTags,
  audioTrackMarkers,
  performers,
  tags,
  studios,
} = schema;

const audioTrackSortConfig: SortConfig = {
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


export async function getAudioTrackDetailRead(db: AppDb, id: string) {
  const [track] = await db
    .select()
    .from(audioTracks)
    .where(and(eq(audioTracks.id, id), audioTrackVisibleSql(audioTracks.filePath)))
    .limit(1);
  if (!track) throw new NotFoundError("Audio track not found");

  const [perfRows, tagRows, markerRows] = await Promise.all([
    db
      .select({ id: performers.id, name: performers.name })
      .from(audioTrackPerformers)
      .innerJoin(performers, eq(audioTrackPerformers.performerId, performers.id))
      .where(eq(audioTrackPerformers.trackId, id)),
    db
      .select({ id: tags.id, name: tags.name, isNsfw: tags.isNsfw })
      .from(audioTrackTags)
      .innerJoin(tags, eq(audioTrackTags.tagId, tags.id))
      .where(eq(audioTrackTags.trackId, id)),
    db
      .select()
      .from(audioTrackMarkers)
      .where(eq(audioTrackMarkers.trackId, id))
      .orderBy(sql`${audioTrackMarkers.seconds} ASC`),
  ]);

  let studio: { id: string; name: string } | null = null;
  if (track.studioId) {
    const [row] = await db
      .select({ id: studios.id, name: studios.name })
      .from(studios)
      .where(eq(studios.id, track.studioId))
      .limit(1);
    studio = row ?? null;
  }

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
    markers: markerRows.map((m) => ({
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

export interface ListAudioTracksQuery {
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
}

export async function listAudioTracksRead(
  db: AppDb,
  query: ListAudioTracksQuery,
) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 80, 500);
  const conditions: SQL[] = [audioTrackVisibleSql(audioTracks.filePath)];

  if (query.library) conditions.push(eq(audioTracks.libraryId, query.library));
  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(audioTracks.title, term),
        ilike(audioTracks.embeddedArtist, term),
        ilike(audioTracks.embeddedAlbum, term),
      )!,
    );
  }
  if (query.nsfw === "off") conditions.push(eq(audioTracks.isNsfw, false));
  conditions.push(
    ...buildRatingConditions(audioTracks.rating, query.ratingMin, query.ratingMax),
  );
  conditions.push(
    ...buildDateConditions(audioTracks.date, query.dateFrom, query.dateTo),
  );
  const orgCond = buildBooleanCondition(audioTracks.organized, query.organized);
  if (orgCond) conditions.push(orgCond);

  const tagEntityIds = await resolveTagIds(
    db,
    toArray(query.tag),
    audioTrackTags,
    audioTrackTags.trackId,
    audioTrackTags.tagId,
  );
  if (tagEntityIds === null) return { items: [], total: 0 };
  if (tagEntityIds) conditions.push(inArray(audioTracks.id, tagEntityIds));

  const perfEntityIds = await resolvePerformerIds(
    db,
    toArray(query.performer),
    audioTrackPerformers,
    audioTrackPerformers.trackId,
    audioTrackPerformers.performerId,
  );
  if (perfEntityIds === null) return { items: [], total: 0 };
  if (perfEntityIds) conditions.push(inArray(audioTracks.id, perfEntityIds));

  if (query.studio) {
    const [studio] = await db
      .select({ id: studios.id })
      .from(studios)
      .where(ilike(studios.name, query.studio))
      .limit(1);
    if (!studio) return { items: [], total: 0 };
    conditions.push(eq(audioTracks.studioId, studio.id));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(audioTracks).where(where),
    db
      .select()
      .from(audioTracks)
      .where(where)
      .orderBy(buildOrderBy(audioTrackSortConfig, query.sort, query.order))
      .limit(limit)
      .offset(offset),
  ]);

  const ids = rows.map((row) => row.id);
  const [perfLinks, tagLinks] = await Promise.all([
    ids.length > 0
      ? db
          .select({
            trackId: audioTrackPerformers.trackId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(audioTrackPerformers)
          .innerJoin(performers, eq(audioTrackPerformers.performerId, performers.id))
          .where(inArray(audioTrackPerformers.trackId, ids))
      : Promise.resolve([]),
    ids.length > 0
      ? db
          .select({
            trackId: audioTrackTags.trackId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(audioTrackTags)
          .innerJoin(tags, eq(audioTrackTags.tagId, tags.id))
          .where(inArray(audioTrackTags.trackId, ids))
      : Promise.resolve([]),
  ]);

  return {
    items: rows.map((track) => ({
      id: track.id,
      title: track.title,
      date: track.date,
      rating: track.rating,
      organized: track.organized,
      isNsfw: track.isNsfw,
      duration: track.duration,
      bitRate: track.bitRate,
      sampleRate: track.sampleRate,
      channels: track.channels,
      codec: track.codec,
      fileSize: track.fileSize,
      embeddedArtist: track.embeddedArtist,
      embeddedAlbum: track.embeddedAlbum,
      trackNumber: track.trackNumber,
      waveformPath: track.waveformPath,
      libraryId: track.libraryId,
      sortOrder: track.sortOrder,
      studioId: track.studioId,
      performers: perfLinks
        .filter((p) => p.trackId === track.id)
        .map((p) => ({ id: p.performerId, name: p.performerName })),
      tags: tagLinks
        .filter((t) => t.trackId === track.id)
        .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
      playCount: track.playCount,
      lastPlayedAt: track.lastPlayedAt?.toISOString() ?? null,
      createdAt: track.createdAt.toISOString(),
    })),
    total: countResult[0]?.count ?? 0,
  };
}

export async function getTracksByIdsRead(db: AppDb, ids: string[]) {
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(audioTracks)
    .where(and(inArray(audioTracks.id, ids), audioTrackVisibleSql(audioTracks.filePath)));
  const trackIds = rows.map((row) => row.id);
  const [perfLinks, tagLinks] = await Promise.all([
    trackIds.length > 0
      ? db
          .select({
            trackId: audioTrackPerformers.trackId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(audioTrackPerformers)
          .innerJoin(performers, eq(audioTrackPerformers.performerId, performers.id))
          .where(inArray(audioTrackPerformers.trackId, trackIds))
      : Promise.resolve([]),
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
      : Promise.resolve([]),
  ]);

  return rows.map((track) => ({
    id: track.id,
    title: track.title,
    date: track.date,
    rating: track.rating,
    organized: track.organized,
    isNsfw: track.isNsfw,
    duration: track.duration,
    bitRate: track.bitRate,
    sampleRate: track.sampleRate,
    channels: track.channels,
    codec: track.codec,
    fileSize: track.fileSize,
    embeddedArtist: track.embeddedArtist,
    embeddedAlbum: track.embeddedAlbum,
    trackNumber: track.trackNumber,
    waveformPath: track.waveformPath,
    libraryId: track.libraryId,
    sortOrder: track.sortOrder,
    studioId: track.studioId,
    performers: perfLinks
      .filter((join) => join.trackId === track.id)
      .map((join) => ({ id: join.performerId, name: join.performerName })),
    tags: tagLinks
      .filter((join) => join.trackId === track.id)
      .map((join) => ({ id: join.tagId, name: join.tagName, isNsfw: join.tagIsNsfw })),
    playCount: track.playCount,
    lastPlayedAt: track.lastPlayedAt?.toISOString() ?? null,
    createdAt: track.createdAt.toISOString(),
  }));
}

export async function updateAudioTrackWrite(
  db: AppDb,
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
  const [track] = await db
    .select({ id: audioTracks.id })
    .from(audioTracks)
    .where(eq(audioTracks.id, id))
    .limit(1);
  if (!track) throw new NotFoundError("Audio track not found");

  await db.transaction(async (tx) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.details !== undefined) updates.details = body.details;
    if (body.date !== undefined) updates.date = body.date;
    if (body.rating !== undefined) updates.rating = body.rating;
    if (body.organized !== undefined) updates.organized = body.organized;
    if (body.isNsfw !== undefined) updates.isNsfw = body.isNsfw;
    if (body.studioName !== undefined) {
      updates.studioId = await findOrCreateStudioId(tx, body.studioName);
    }
    await tx.update(audioTracks).set(updates).where(eq(audioTracks.id, id));

    if (body.performerNames !== undefined) {
      await tx.delete(audioTrackPerformers).where(eq(audioTrackPerformers.trackId, id));
      for (const name of body.performerNames) {
        if (!name.trim()) continue;
        await tx
          .insert(audioTrackPerformers)
          .values({ trackId: id, performerId: await findOrCreatePerformerId(tx, name) })
          .onConflictDoNothing();
      }
    }

    if (body.tagNames !== undefined) {
      await tx.delete(audioTrackTags).where(eq(audioTrackTags.trackId, id));
      for (const name of body.tagNames) {
        if (!name.trim()) continue;
        await tx
          .insert(audioTrackTags)
          .values({ trackId: id, tagId: await findOrCreateTagId(tx, name) })
          .onConflictDoNothing();
      }
    }
  });

  return { ok: true as const };
}

export async function deleteAudioTrackWrite(
  db: AppDb,
  id: string,
  deleteFile: boolean,
) {
  const [existing] = await db
    .select({
      id: audioTracks.id,
      filePath: audioTracks.filePath,
      libraryId: audioTracks.libraryId,
    })
    .from(audioTracks)
    .where(eq(audioTracks.id, id))
    .limit(1);
  if (!existing) throw new NotFoundError("Audio track not found");

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
    /* non-fatal */
  }
  if (deleteFile && existing.filePath) {
    try {
      if (existsSync(existing.filePath)) await unlink(existing.filePath);
    } catch {
      /* non-fatal */
    }
  }

  return { ok: true as const };
}

export async function recordAudioTrackPlayWrite(db: AppDb, id: string) {
  const [track] = await db
    .select({ id: audioTracks.id })
    .from(audioTracks)
    .where(eq(audioTracks.id, id))
    .limit(1);
  if (!track) throw new NotFoundError("Audio track not found");

  await db
    .update(audioTracks)
    .set({
      playCount: sql`${audioTracks.playCount} + 1`,
      lastPlayedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(audioTracks.id, id));

  return { ok: true as const };
}

export async function createAudioTrackMarkerWrite(
  db: AppDb,
  trackId: string,
  body: { title: string; seconds: number; endSeconds?: number | null },
) {
  const [track] = await db
    .select({ id: audioTracks.id })
    .from(audioTracks)
    .where(eq(audioTracks.id, trackId))
    .limit(1);
  if (!track) throw new NotFoundError("Audio track not found");

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

export async function updateAudioTrackMarkerWrite(
  db: AppDb,
  markerId: string,
  body: { title?: string; seconds?: number; endSeconds?: number | null },
) {
  await db
    .update(audioTrackMarkers)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.seconds !== undefined ? { seconds: body.seconds } : {}),
      ...(body.endSeconds !== undefined ? { endSeconds: body.endSeconds } : {}),
      updatedAt: new Date(),
    })
    .where(eq(audioTrackMarkers.id, markerId));

  return { ok: true as const };
}

export async function deleteAudioTrackMarkerWrite(db: AppDb, markerId: string) {
  await db.delete(audioTrackMarkers).where(eq(audioTrackMarkers.id, markerId));
  return { ok: true as const };
}

export async function uploadAudioTrackWrite(
  db: AppDb,
  libraryId: string,
  file: UploadFileInput,
) {
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
  if (!library) throw new NotFoundError("Audio library not found");
  if (!library.folderPath) {
    throw new ValidationError("Audio library is not folder-backed");
  }

  await assertDirExists(library.folderPath);
  const { safeName } = validateUploadInput(file, "audio");
  const dest = await resolveCollisionSafePath(library.folderPath, safeName);
  const { bytesWritten } = await writeUploadBuffer(dest, file.buffer);

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
  await enqueueQueueJob(db, {
    queueName: "audio-probe",
    data: { trackId: created.id },
    target,
    trigger,
  });
  await enqueueQueueJob(db, {
    queueName: "audio-fingerprint",
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
