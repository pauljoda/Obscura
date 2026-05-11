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
import { getGeneratedAudioLibraryDir } from "@obscura/media-core";
import { NotFoundError, ValidationError } from "./errors";
import { buildHierarchyScopeConditions } from "./hierarchy";
import {
  audioLibraryVisibleSql,
  audioTrackVisibleSql,
} from "./library-root-visibility";
import { ignoreMediaFilePath } from "./media-file-ignores";
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
  buildNsfwFlagConditions,
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
  audioLibraryPerformers,
  audioLibraryTags,
  audioTracks,
  audioTrackPerformers,
  audioTrackTags,
  performers,
  tags,
  studios,
} = schema;

const audioLibrarySortConfig: SortConfig = {
  columns: {
    recent: audioLibraries.createdAt,
    title: audioLibraries.title,
    date: audioLibraries.date,
    rating: audioLibraries.rating,
    trackCount: audioLibraries.trackCount,
  },
  defaultDirs: {
    recent: "desc",
    title: "asc",
    date: "desc",
    rating: "desc",
    trackCount: "desc",
  },
  fallbackColumn: audioLibraries.createdAt,
  randomColumn: audioLibraries.id,
};


export interface ListAudioLibrariesQuery {
  search?: string;
  sort?: string;
  order?: string;
  tag?: string | string[];
  performer?: string | string[];
  studio?: string;
  parent?: string;
  root?: string;
  limit?: string;
  offset?: string;
  ratingMin?: string;
  ratingMax?: string;
  dateFrom?: string;
  dateTo?: string;
  trackCountMin?: string;
  organized?: string;
  isNsfw?: string;
  nsfw?: string;
  randomSeed?: string;
}

export async function listAudioLibrariesRead(
  db: AppDb,
  query: ListAudioLibrariesQuery,
) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 60, 2000);
  const conditions: SQL[] = [audioLibraryVisibleSql(audioLibraries.folderPath)];
  conditions.push(...buildHierarchyScopeConditions(audioLibraries.parentId, query));
  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(audioLibraries.title, term),
        ilike(audioLibraries.details, term),
        ilike(audioLibraries.folderPath, term),
      )!,
    );
  }
  conditions.push(...buildNsfwFlagConditions(audioLibraries.isNsfw, query.nsfw, query.isNsfw));
  conditions.push(
    ...buildRatingConditions(audioLibraries.rating, query.ratingMin, query.ratingMax),
  );
  conditions.push(
    ...buildDateConditions(audioLibraries.date, query.dateFrom, query.dateTo),
  );
  const orgCond = buildBooleanCondition(audioLibraries.organized, query.organized);
  if (orgCond) conditions.push(orgCond);
  if (query.trackCountMin != null) {
    conditions.push(sql`${audioLibraries.trackCount} >= ${Number(query.trackCountMin)}`);
  }

  const tagEntityIds = await resolveTagIds(
    db,
    toArray(query.tag),
    audioLibraryTags,
    audioLibraryTags.libraryId,
    audioLibraryTags.tagId,
  );
  if (tagEntityIds === null) return { items: [], total: 0 };
  if (tagEntityIds) conditions.push(inArray(audioLibraries.id, tagEntityIds));

  const perfEntityIds = await resolvePerformerIds(
    db,
    toArray(query.performer),
    audioLibraryPerformers,
    audioLibraryPerformers.libraryId,
    audioLibraryPerformers.performerId,
  );
  if (perfEntityIds === null) return { items: [], total: 0 };
  if (perfEntityIds) conditions.push(inArray(audioLibraries.id, perfEntityIds));

  if (query.studio) {
    const [studio] = await db
      .select({ id: studios.id })
      .from(studios)
      .where(ilike(studios.name, query.studio))
      .limit(1);
    if (!studio) return { items: [], total: 0 };
    conditions.push(eq(audioLibraries.studioId, studio.id));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countRows, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(audioLibraries)
      .where(where),
    db
      .select()
      .from(audioLibraries)
      .where(where)
      .orderBy(buildOrderBy(audioLibrarySortConfig, query.sort, query.order, query.randomSeed))
      .limit(limit)
      .offset(offset),
  ]);

  const ids = rows.map((r) => r.id);
  const [perfLinks, tagLinks] = await Promise.all([
    ids.length > 0
      ? db
          .select({
            libraryId: audioLibraryPerformers.libraryId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(audioLibraryPerformers)
          .innerJoin(performers, eq(audioLibraryPerformers.performerId, performers.id))
          .where(inArray(audioLibraryPerformers.libraryId, ids))
      : Promise.resolve([]),
    ids.length > 0
      ? db
          .select({
            libraryId: audioLibraryTags.libraryId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(audioLibraryTags)
          .innerJoin(tags, eq(audioLibraryTags.tagId, tags.id))
          .where(inArray(audioLibraryTags.libraryId, ids))
      : Promise.resolve([]),
  ]);

  const studioIds = [...new Set(rows.flatMap((r) => (r.studioId ? [r.studioId] : [])))];
  const studioRows =
    studioIds.length > 0
      ? await db
          .select({ id: studios.id, name: studios.name })
          .from(studios)
          .where(inArray(studios.id, studioIds))
      : [];
  const studioMap = new Map(studioRows.map((s) => [s.id, s.name]));

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      coverImagePath: row.coverImagePath,
      iconPath: row.iconPath,
      trackCount: row.trackCount,
      rating: row.rating,
      organized: row.organized,
      isNsfw: row.isNsfw,
      date: row.date,
      studioId: row.studioId,
      studioName: row.studioId ? (studioMap.get(row.studioId) ?? null) : null,
      performers: perfLinks
        .filter((p) => p.libraryId === row.id)
        .map((p) => ({ id: p.performerId, name: p.performerName })),
      tags: tagLinks
        .filter((t) => t.libraryId === row.id)
        .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
      parentId: row.parentId,
      createdAt: row.createdAt.toISOString(),
    })),
    total: countRows[0]?.count ?? 0,
  };
}

export async function getAudioLibraryDetailRead(
  db: AppDb,
  id: string,
  options?: { trackLimit?: string; trackOffset?: string },
) {
  const trackLimit = Math.min(Number(options?.trackLimit) || 100, 200);
  const trackOffset = Number(options?.trackOffset) || 0;
  const [lib] = await db
    .select()
    .from(audioLibraries)
    .where(and(eq(audioLibraries.id, id), audioLibraryVisibleSql(audioLibraries.folderPath)))
    .limit(1);
  if (!lib) throw new NotFoundError("Audio library not found");

  const [perfRows, tagRows, trackRows, trackCountResult, durationResult, children] =
    await Promise.all([
      db
        .select({
          id: performers.id,
          name: performers.name,
          gender: performers.gender,
          imagePath: performers.imagePath,
        })
        .from(audioLibraryPerformers)
        .innerJoin(performers, eq(audioLibraryPerformers.performerId, performers.id))
        .where(eq(audioLibraryPerformers.libraryId, id)),
      db
        .select({ id: tags.id, name: tags.name, isNsfw: tags.isNsfw })
        .from(audioLibraryTags)
        .innerJoin(tags, eq(audioLibraryTags.tagId, tags.id))
        .where(eq(audioLibraryTags.libraryId, id)),
      db
        .select()
        .from(audioTracks)
        .where(
          and(
            eq(audioTracks.libraryId, id),
            audioTrackVisibleSql(audioTracks.filePath),
          ),
        )
        .orderBy(sql`${audioTracks.sortOrder} ASC, ${audioTracks.title} ASC`)
        .limit(trackLimit)
        .offset(trackOffset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(audioTracks)
        .where(
          and(
            eq(audioTracks.libraryId, id),
            audioTrackVisibleSql(audioTracks.filePath),
          ),
        ),
      db
        .select({ total: sql<number>`COALESCE(SUM(${audioTracks.duration}), 0)` })
        .from(audioTracks)
        .where(
          and(
            eq(audioTracks.libraryId, id),
            audioTrackVisibleSql(audioTracks.filePath),
          ),
        ),
      db
      .select({
          id: audioLibraries.id,
          title: audioLibraries.title,
          trackCount: audioLibraries.trackCount,
          coverImagePath: audioLibraries.coverImagePath,
          iconPath: audioLibraries.iconPath,
          isNsfw: audioLibraries.isNsfw,
        })
        .from(audioLibraries)
        .where(
          and(
            eq(audioLibraries.parentId, id),
            audioLibraryVisibleSql(audioLibraries.folderPath),
          ),
        )
        .orderBy(sql`${audioLibraries.title} ASC`),
    ]);

  let studio: { id: string; name: string; url: string | null } | null = null;
  if (lib.studioId) {
    const [row] = await db
      .select({ id: studios.id, name: studios.name, url: studios.url })
      .from(studios)
      .where(eq(studios.id, lib.studioId))
      .limit(1);
    studio = row ?? null;
  }

  const trackIds = trackRows.map((t) => t.id);
  const [trackPerfLinks, trackTagLinks] = await Promise.all([
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

  return {
    id: lib.id,
    title: lib.title,
    details: lib.details,
    date: lib.date,
    rating: lib.rating,
    organized: lib.organized,
    isNsfw: lib.isNsfw,
    folderPath: lib.folderPath,
    parentId: lib.parentId,
    coverImagePath: lib.coverImagePath,
    iconPath: lib.iconPath,
    trackCount: lib.trackCount,
    totalDuration: durationResult[0]?.total ?? 0,
    studio,
    performers: perfRows,
    tags: tagRows,
    tracks: trackRows.map((track) => ({
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
      performers: trackPerfLinks
        .filter((p) => p.trackId === track.id)
        .map((p) => ({ id: p.performerId, name: p.performerName })),
      tags: trackTagLinks
        .filter((t) => t.trackId === track.id)
        .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
      playCount: track.playCount,
      lastPlayedAt: track.lastPlayedAt?.toISOString() ?? null,
      createdAt: track.createdAt.toISOString(),
    })),
    trackTotal: trackCountResult[0]?.count ?? 0,
    trackLimit,
    trackOffset,
    children,
    createdAt: lib.createdAt.toISOString(),
    updatedAt: lib.updatedAt.toISOString(),
  };
}

export async function getAudioLibraryStatsRead(
  db: AppDb,
  nsfw?: string,
) {
  const sfwOnly = nsfw === "off";
  const libWhere = sfwOnly
    ? and(audioLibraryVisibleSql(audioLibraries.folderPath), eq(audioLibraries.isNsfw, false))
    : audioLibraryVisibleSql(audioLibraries.folderPath);
  const trackWhere = sfwOnly
    ? and(
        audioTrackVisibleSql(audioTracks.filePath),
        eq(audioTracks.isNsfw, false),
        eq(audioLibraries.isNsfw, false),
      )
    : audioTrackVisibleSql(audioTracks.filePath);
  const recentWhere = sfwOnly
    ? and(
        audioTrackVisibleSql(audioTracks.filePath),
        eq(audioTracks.isNsfw, false),
        eq(audioLibraries.isNsfw, false),
        sql`${audioTracks.createdAt} > NOW() - INTERVAL '7 days'`,
      )
    : and(
        audioTrackVisibleSql(audioTracks.filePath),
        sql`${audioTracks.createdAt} > NOW() - INTERVAL '7 days'`,
      );

  const [libCount, trackStats, recent] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(audioLibraries)
      .where(libWhere),
    db
      .select({
        count: sql<number>`count(*)::int`,
        duration: sql<number>`COALESCE(SUM(${audioTracks.duration}), 0)`,
      })
      .from(audioTracks)
      .leftJoin(audioLibraries, eq(audioTracks.libraryId, audioLibraries.id))
      .where(trackWhere),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(audioTracks)
      .leftJoin(audioLibraries, eq(audioTracks.libraryId, audioLibraries.id))
      .where(recentWhere),
  ]);

  return {
    totalLibraries: libCount[0]?.count ?? 0,
    totalTracks: trackStats[0]?.count ?? 0,
    totalDuration: trackStats[0]?.duration ?? 0,
    recentCount: recent[0]?.count ?? 0,
  };
}

export async function updateAudioLibraryWrite(
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
  const existing = await db.query.audioLibraries.findFirst({
    where: eq(audioLibraries.id, id),
    columns: { id: true },
  });
  if (!existing) throw new NotFoundError("Audio library not found");

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
    await tx.update(audioLibraries).set(updates).where(eq(audioLibraries.id, id));

    if (body.performerNames !== undefined) {
      await tx
        .delete(audioLibraryPerformers)
        .where(eq(audioLibraryPerformers.libraryId, id));
      for (const name of body.performerNames) {
        if (!name.trim()) continue;
        await tx
          .insert(audioLibraryPerformers)
          .values({
            libraryId: id,
            performerId: await findOrCreatePerformerId(tx, name),
          })
          .onConflictDoNothing();
      }
    }

    if (body.tagNames !== undefined) {
      await tx.delete(audioLibraryTags).where(eq(audioLibraryTags.libraryId, id));
      for (const name of body.tagNames) {
        if (!name.trim()) continue;
        await tx
          .insert(audioLibraryTags)
          .values({ libraryId: id, tagId: await findOrCreateTagId(tx, name) })
          .onConflictDoNothing();
      }
    }
  });

  return { ok: true as const };
}

export async function deleteAudioLibraryWrite(db: AppDb, id: string, deleteFile = false) {
  const [existing] = await db
    .select({ id: audioLibraries.id, folderPath: audioLibraries.folderPath })
    .from(audioLibraries)
    .where(eq(audioLibraries.id, id))
    .limit(1);
  if (!existing) throw new NotFoundError("Audio library not found");

  const fileRows = await db
    .select({ filePath: audioTracks.filePath })
    .from(audioTracks)
    .where(eq(audioTracks.libraryId, id));
  if (!deleteFile) {
    for (const row of fileRows) {
      await ignoreMediaFilePath(db, { path: row.filePath, entityType: "audio" });
    }
  }

  await db.delete(audioLibraries).where(eq(audioLibraries.id, id));

  if (deleteFile && existing.folderPath) {
    try {
      if (existsSync(existing.folderPath)) {
        await rm(existing.folderPath, { recursive: true, force: true });
      }
    } catch {
      /* non-fatal */
    }
  }
  return { ok: true as const };
}

const AUDIO_LIBRARY_COVER_FILE = "cover-custom.jpg";

export async function uploadAudioLibraryCoverWrite(
  db: AppDb,
  id: string,
  buffer: Buffer,
) {
  if (!buffer.length) throw new ValidationError("Empty file");
  const [library] = await db
    .select({ id: audioLibraries.id })
    .from(audioLibraries)
    .where(eq(audioLibraries.id, id))
    .limit(1);
  if (!library) throw new NotFoundError("Audio library not found");

  const dir = getGeneratedAudioLibraryDir(id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, AUDIO_LIBRARY_COVER_FILE), buffer);

  const coverImagePath = `/assets/audio-libraries/${id}/cover`;
  await db
    .update(audioLibraries)
    .set({ coverImagePath, updatedAt: new Date() })
    .where(eq(audioLibraries.id, id));
  return { ok: true as const, coverImagePath };
}

export async function deleteAudioLibraryCoverWrite(db: AppDb, id: string) {
  const [library] = await db
    .select({ id: audioLibraries.id })
    .from(audioLibraries)
    .where(eq(audioLibraries.id, id))
    .limit(1);
  if (!library) throw new NotFoundError("Audio library not found");

  const filePath = path.join(getGeneratedAudioLibraryDir(id), AUDIO_LIBRARY_COVER_FILE);
  try {
    if (existsSync(filePath)) await unlink(filePath);
  } catch {
    /* non-fatal */
  }

  await db
    .update(audioLibraries)
    .set({ coverImagePath: null, updatedAt: new Date() })
    .where(eq(audioLibraries.id, id));
  return { ok: true as const };
}
