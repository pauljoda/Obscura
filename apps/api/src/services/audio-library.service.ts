import { mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { getGeneratedAudioLibraryDir } from "@obscura/media-core";
import { db, schema } from "../db";
import {
  eq,
  ilike,
  or,
  sql,
  inArray,
  and,
} from "drizzle-orm";
import { AppError } from "../plugins/error-handler";
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
  audioLibraries,
  audioLibraryPerformers,
  audioLibraryTags,
  audioTracks,
  performers,
  tags,
  studios,
} = schema;

// ─── Sort config ───────────────────────────────────────────────

const sortConfig: SortConfig = {
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
};

// ─── List ─────────────────────────────────────────────────────

export async function listAudioLibraries(query: {
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
  nsfw?: string;
}) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 60, 2000);
  const conditions: ReturnType<typeof eq>[] = [];

  // Hierarchy filtering
  if (query.parent) {
    conditions.push(eq(audioLibraries.parentId, query.parent));
  } else if (query.root !== "all" && !query.search) {
    conditions.push(sql`${audioLibraries.parentId} IS NULL`);
  }

  // Text search
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

  // NSFW filter
  if (query.nsfw === "off") {
    conditions.push(eq(audioLibraries.isNsfw, false));
  }

  // Rating
  conditions.push(...buildRatingConditions(audioLibraries.rating, query.ratingMin, query.ratingMax));

  // Date
  conditions.push(...buildDateConditions(audioLibraries.date, query.dateFrom, query.dateTo));

  // Organized
  const orgCond = buildBooleanCondition(audioLibraries.organized, query.organized);
  if (orgCond) conditions.push(orgCond);

  // Track count min
  if (query.trackCountMin != null) {
    conditions.push(sql`${audioLibraries.trackCount} >= ${Number(query.trackCountMin)}`);
  }

  // Tag filter
  const tagNames = toArray(query.tag);
  if (tagNames.length > 0) {
    const tagIds = await resolveTagIds(tagNames, audioLibraryTags, audioLibraryTags.libraryId, audioLibraryTags.tagId);
    if (tagIds === null) return { items: [], total: 0 };
    if (tagIds) {
      conditions.push(inArray(audioLibraries.id, tagIds));
    }
  }

  // Performer filter
  const perfNames = toArray(query.performer);
  if (perfNames.length > 0) {
    const perfIds = await resolvePerformerIds(perfNames, audioLibraryPerformers, audioLibraryPerformers.libraryId, audioLibraryPerformers.performerId);
    if (perfIds === null) return { items: [], total: 0 };
    if (perfIds) {
      conditions.push(inArray(audioLibraries.id, perfIds));
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
      conditions.push(eq(audioLibraries.studioId, st.id));
    } else {
      return { items: [], total: 0 };
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(audioLibraries)
    .where(where);

  const rows = await db
    .select()
    .from(audioLibraries)
    .where(where)
    .orderBy(buildOrderBy(sortConfig, query.sort, query.order))
    .limit(limit)
    .offset(offset);

  // Batch load performers and tags
  const ids = rows.map((r) => r.id);
  const perfLinks = ids.length > 0
    ? await db
        .select({
          libraryId: audioLibraryPerformers.libraryId,
          performerId: performers.id,
          performerName: performers.name,
        })
        .from(audioLibraryPerformers)
        .innerJoin(performers, eq(audioLibraryPerformers.performerId, performers.id))
        .where(inArray(audioLibraryPerformers.libraryId, ids))
    : [];

  const tagLinks = ids.length > 0
    ? await db
        .select({
          libraryId: audioLibraryTags.libraryId,
          tagId: tags.id,
          tagName: tags.name,
          tagIsNsfw: tags.isNsfw,
        })
        .from(audioLibraryTags)
        .innerJoin(tags, eq(audioLibraryTags.tagId, tags.id))
        .where(inArray(audioLibraryTags.libraryId, ids))
    : [];

  // Studio names
  const studioIds = [...new Set(rows.filter((r) => r.studioId).map((r) => r.studioId!))];
  const studioMap = new Map<string, string>();
  if (studioIds.length > 0) {
    const studioRows = await db
      .select({ id: studios.id, name: studios.name })
      .from(studios)
      .where(inArray(studios.id, studioIds));
    for (const s of studioRows) studioMap.set(s.id, s.name);
  }

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    coverImagePath: r.coverImagePath,
    iconPath: r.iconPath,
    trackCount: r.trackCount,
    rating: r.rating,
    organized: r.organized,
    isNsfw: r.isNsfw,
    date: r.date,
    studioId: r.studioId,
    studioName: r.studioId ? (studioMap.get(r.studioId) ?? null) : null,
    performers: perfLinks
      .filter((p) => p.libraryId === r.id)
      .map((p) => ({ id: p.performerId, name: p.performerName })),
    tags: tagLinks
      .filter((t) => t.libraryId === r.id)
      .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
    parentId: r.parentId,
    createdAt: r.createdAt.toISOString(),
  }));

  return { items, total: countResult.count };
}

// ─── Detail ────────────────────────────────────────────────────

export async function getAudioLibraryById(
  id: string,
  trackLimit = 100,
  trackOffset = 0,
) {
  const [lib] = await db.select().from(audioLibraries).where(eq(audioLibraries.id, id)).limit(1);
  if (!lib) throw new AppError(404, "Audio library not found");

  // Performers
  const perfRows = await db
    .select({
      id: performers.id,
      name: performers.name,
      gender: performers.gender,
      imagePath: performers.imagePath,
    })
    .from(audioLibraryPerformers)
    .innerJoin(performers, eq(audioLibraryPerformers.performerId, performers.id))
    .where(eq(audioLibraryPerformers.libraryId, id));

  // Tags
  const tagRows = await db
    .select({ id: tags.id, name: tags.name, isNsfw: tags.isNsfw })
    .from(audioLibraryTags)
    .innerJoin(tags, eq(audioLibraryTags.tagId, tags.id))
    .where(eq(audioLibraryTags.libraryId, id));

  // Studio
  let studio: { id: string; name: string; url: string | null } | null = null;
  if (lib.studioId) {
    const [s] = await db
      .select({ id: studios.id, name: studios.name, url: studios.url })
      .from(studios)
      .where(eq(studios.id, lib.studioId))
      .limit(1);
    studio = s ?? null;
  }

  // Tracks (paginated)
  const trackRows = await db
    .select()
    .from(audioTracks)
    .where(eq(audioTracks.libraryId, id))
    .orderBy(sql`${audioTracks.sortOrder} ASC, ${audioTracks.title} ASC`)
    .limit(trackLimit)
    .offset(trackOffset);

  const [trackCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(audioTracks)
    .where(eq(audioTracks.libraryId, id));

  // Total duration
  const [durationResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${audioTracks.duration}), 0)` })
    .from(audioTracks)
    .where(eq(audioTracks.libraryId, id));

  // Track performers + tags (batch)
  const trackIds = trackRows.map((t) => t.id);
  const trackPerfLinks = trackIds.length > 0
    ? await db
        .select({
          trackId: schema.audioTrackPerformers.trackId,
          performerId: performers.id,
          performerName: performers.name,
        })
        .from(schema.audioTrackPerformers)
        .innerJoin(performers, eq(schema.audioTrackPerformers.performerId, performers.id))
        .where(inArray(schema.audioTrackPerformers.trackId, trackIds))
    : [];

  const trackTagLinks = trackIds.length > 0
    ? await db
        .select({
          trackId: schema.audioTrackTags.trackId,
          tagId: tags.id,
          tagName: tags.name,
          tagIsNsfw: tags.isNsfw,
        })
        .from(schema.audioTrackTags)
        .innerJoin(tags, eq(schema.audioTrackTags.tagId, tags.id))
        .where(inArray(schema.audioTrackTags.trackId, trackIds))
    : [];

  // Children
  const children = await db
    .select({
      id: audioLibraries.id,
      title: audioLibraries.title,
      trackCount: audioLibraries.trackCount,
      coverImagePath: audioLibraries.coverImagePath,
      iconPath: audioLibraries.iconPath,
      isNsfw: audioLibraries.isNsfw,
    })
    .from(audioLibraries)
    .where(eq(audioLibraries.parentId, id))
    .orderBy(sql`${audioLibraries.title} ASC`);

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
    totalDuration: durationResult.total,
    studio,
    performers: perfRows,
    tags: tagRows,
    tracks: trackRows.map((t) => ({
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
      performers: trackPerfLinks
        .filter((p) => p.trackId === t.id)
        .map((p) => ({ id: p.performerId, name: p.performerName })),
      tags: trackTagLinks
        .filter((tl) => tl.trackId === t.id)
        .map((tl) => ({ id: tl.tagId, name: tl.tagName, isNsfw: tl.tagIsNsfw })),
      playCount: t.playCount,
      lastPlayedAt: t.lastPlayedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    trackTotal: trackCountResult.count,
    trackLimit,
    trackOffset,
    children,
    createdAt: lib.createdAt.toISOString(),
    updatedAt: lib.updatedAt.toISOString(),
  };
}

// ─── Stats ────────────────────────────────────────────────────

export async function getAudioLibraryStats(nsfw?: string) {
  const sfwOnly = nsfw === "off";
  const libNsfwFilter = sfwOnly ? eq(audioLibraries.isNsfw, false) : undefined;
  // Tracks are considered NSFW if either the track itself or its owning
  // library is flagged — filter by both so SFW totals don't leak tracks
  // that live inside an NSFW library.
  const trackSfwCondition = sfwOnly
    ? and(eq(audioTracks.isNsfw, false), eq(audioLibraries.isNsfw, false))
    : undefined;

  const [libCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(audioLibraries)
    .where(libNsfwFilter);

  const [trackStats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      duration: sql<number>`COALESCE(SUM(${audioTracks.duration}), 0)`,
    })
    .from(audioTracks)
    .leftJoin(audioLibraries, eq(audioTracks.libraryId, audioLibraries.id))
    .where(trackSfwCondition);

  const recentWhere = sfwOnly
    ? and(
        eq(audioTracks.isNsfw, false),
        eq(audioLibraries.isNsfw, false),
        sql`${audioTracks.createdAt} > NOW() - INTERVAL '7 days'`,
      )
    : sql`${audioTracks.createdAt} > NOW() - INTERVAL '7 days'`;

  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(audioTracks)
    .leftJoin(audioLibraries, eq(audioTracks.libraryId, audioLibraries.id))
    .where(recentWhere);

  return {
    totalLibraries: libCount.count,
    totalTracks: trackStats.count,
    totalDuration: trackStats.duration,
    recentCount: recent.count,
  };
}

// ─── Update ────────────────────────────────────────────────────

export async function updateAudioLibrary(
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
  const [lib] = await db.select({ id: audioLibraries.id }).from(audioLibraries).where(eq(audioLibraries.id, id)).limit(1);
  if (!lib) throw new AppError(404, "Audio library not found");

  await db.transaction(async (tx) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.details !== undefined) updates.details = body.details;
    if (body.date !== undefined) updates.date = body.date;
    if (body.rating !== undefined) updates.rating = body.rating;
    if (body.organized !== undefined) updates.organized = body.organized;
    if (body.isNsfw !== undefined) updates.isNsfw = body.isNsfw;

    // Studio: find or create by name (same behavior as scene updates)
    if (body.studioName !== undefined) {
      const trimmed = body.studioName?.trim() ?? "";
      if (!trimmed) {
        updates.studioId = null;
      } else {
        const [existingStudio] = await tx
          .select({ id: studios.id })
          .from(studios)
          .where(ilike(studios.name, trimmed))
          .limit(1);
        if (existingStudio) {
          updates.studioId = existingStudio.id;
        } else {
          const [created] = await tx
            .insert(studios)
            .values({ name: trimmed })
            .returning({ id: studios.id });
          updates.studioId = created!.id;
        }
      }
    }

    await tx.update(audioLibraries).set(updates).where(eq(audioLibraries.id, id));

    // Performers
    if (body.performerNames !== undefined) {
      await tx.delete(audioLibraryPerformers).where(eq(audioLibraryPerformers.libraryId, id));
      for (const name of body.performerNames) {
        const [existing] = await tx
          .select({ id: performers.id })
          .from(performers)
          .where(ilike(performers.name, name.trim()))
          .limit(1);
        const performerId = existing?.id ??
          (await tx.insert(performers).values({ name: name.trim() }).returning({ id: performers.id }))[0].id;
        await tx.insert(audioLibraryPerformers).values({ libraryId: id, performerId }).onConflictDoNothing();
      }
    }

    // Tags
    if (body.tagNames !== undefined) {
      await tx.delete(audioLibraryTags).where(eq(audioLibraryTags.libraryId, id));
      for (const name of body.tagNames) {
        const [existing] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(ilike(tags.name, name.trim()))
          .limit(1);
        const tagId = existing?.id ??
          (await tx.insert(tags).values({ name: name.trim() }).returning({ id: tags.id }))[0].id;
        await tx.insert(audioLibraryTags).values({ libraryId: id, tagId }).onConflictDoNothing();
      }
    }
  });
}

// ─── Delete ────────────────────────────────────────────────────

export async function deleteAudioLibrary(id: string) {
  const [lib] = await db.select({ id: audioLibraries.id }).from(audioLibraries).where(eq(audioLibraries.id, id)).limit(1);
  if (!lib) throw new AppError(404, "Audio library not found");
  await db.delete(audioLibraries).where(eq(audioLibraries.id, id));
}

const AUDIO_LIBRARY_COVER_FILE = "cover-custom.jpg";

function audioLibraryCoverAssetPath(libraryId: string) {
  return `/assets/audio-libraries/${libraryId}/cover`;
}

/** Save multipart image bytes as the library cover (JPEG on disk). */
export async function setAudioLibraryCover(id: string, buffer: Buffer) {
  if (!buffer.length) {
    throw new AppError(400, "Empty file");
  }
  const [lib] = await db.select({ id: audioLibraries.id }).from(audioLibraries).where(eq(audioLibraries.id, id)).limit(1);
  if (!lib) throw new AppError(404, "Audio library not found");

  const dir = getGeneratedAudioLibraryDir(id);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, AUDIO_LIBRARY_COVER_FILE);
  await writeFile(filePath, buffer);

  const coverImagePath = audioLibraryCoverAssetPath(id);
  await db
    .update(audioLibraries)
    .set({ coverImagePath, updatedAt: new Date() })
    .where(eq(audioLibraries.id, id));

  return { ok: true as const, coverImagePath };
}

/** Remove user-uploaded cover file and clear `coverImagePath`. */
export async function clearAudioLibraryCover(id: string) {
  const [lib] = await db
    .select({ id: audioLibraries.id })
    .from(audioLibraries)
    .where(eq(audioLibraries.id, id))
    .limit(1);
  if (!lib) throw new AppError(404, "Audio library not found");

  const filePath = path.join(getGeneratedAudioLibraryDir(id), AUDIO_LIBRARY_COVER_FILE);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }

  await db
    .update(audioLibraries)
    .set({ coverImagePath: null, updatedAt: new Date() })
    .where(eq(audioLibraries.id, id));

  return { ok: true as const };
}
