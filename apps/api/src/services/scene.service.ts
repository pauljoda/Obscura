/**
 * Scene business logic extracted from route handlers.
 *
 * All functions return plain data objects and throw AppError for
 * HTTP-level error conditions (404, 400, 502, etc.).
 */
import { existsSync } from "node:fs";
import { writeFile, mkdir, unlink, rm } from "node:fs/promises";
import path from "node:path";
import {
  eq,
  ilike,
  or,
  desc,
  asc,
  sql,
  inArray,
  and,
  ne,
  isNotNull,
  isNull,
  gte,
  lte,
  lt,
  gt,
} from "drizzle-orm";
import {
  formatDuration,
  formatFileSize,
  getResolutionLabel,
} from "@obscura/contracts";
import {
  writeNfo,
  getGeneratedSceneDir,
  runProcess,
} from "@obscura/media-core";
import { db, schema } from "../db";

const {
  scenes,
  scenePerformers,
  sceneTags,
  sceneMarkers,
  performers,
  tags,
  studios,
} = schema;

// ─── Error Type ────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ─── Query Types ───────────────────────────────────────────────

export interface ListScenesQuery {
  search?: string;
  sort?: string;
  order?: string;
  tag?: string | string[];
  performer?: string | string[];
  studio?: string | string[];
  resolution?: string | string[];
  limit?: string;
  offset?: string;
  nsfw?: string;
  ratingMin?: string;
  ratingMax?: string;
  dateFrom?: string;
  dateTo?: string;
  durationMin?: string;
  durationMax?: string;
  organized?: string;
  interactive?: string;
  hasFile?: string;
  played?: string;
  codec?: string | string[];
}

export interface UpdateSceneBody {
  title?: string;
  details?: string | null;
  date?: string | null;
  rating?: number | null;
  url?: string | null;
  organized?: boolean;
  isNsfw?: boolean;
  orgasmCount?: number;
  studioName?: string | null;
  performerNames?: string[];
  tagNames?: string[];
}

export interface CreateMarkerBody {
  title: string;
  seconds: number;
  endSeconds?: number | null;
  primaryTagName?: string | null;
}

export interface UpdateMarkerBody {
  title?: string;
  seconds?: number;
  endSeconds?: number | null;
  primaryTagName?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_CODECS = new Set([
  "h264",
  "hevc",
  "av1",
  "vp9",
  "mpeg4",
  "prores",
  "wmv",
  "vp8",
]);

const RESOLUTION_MAP: Record<string, [number, number]> = {
  "4K": [2160, 99999],
  "1080p": [1080, 2159],
  "720p": [720, 1079],
  "480p": [0, 719],
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Save a buffer as a custom thumbnail and update the scene record.
 * Shared by upload, from-url, and from-frame flows.
 */
async function saveCustomThumbnail(
  id: string,
  buffer: Buffer,
): Promise<{ thumbnailPath: string }> {
  const genDir = getGeneratedSceneDir(id);
  await mkdir(genDir, { recursive: true });
  const thumbPath = path.join(genDir, "thumbnail-custom.jpg");
  await writeFile(thumbPath, buffer);

  const assetUrl = `/assets/scenes/${id}/thumb-custom`;
  await db
    .update(scenes)
    .set({
      thumbnailPath: assetUrl,
      cardThumbnailPath: null,
      updatedAt: new Date(),
    })
    .where(eq(scenes.id, id));

  return { thumbnailPath: assetUrl };
}

// ─── Service Functions ─────────────────────────────────────────

/**
 * List scenes with filtering, sorting, and pagination.
 */
export async function listScenes(query: ListScenesQuery) {
  const limit = Math.min(Number(query.limit) || 50, 100);
  const offset = Number(query.offset) || 0;

  const conditions = [];

  // SFW filter
  if (query.nsfw === "off") {
    conditions.push(ne(scenes.isNsfw, true));
  }

  // Text search
  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(scenes.title, term),
        ilike(scenes.details, term),
        ilike(scenes.filePath, term),
      )!,
    );
  }

  // Resolution filter
  const resValues = toArray(query.resolution);
  if (resValues.length > 0) {
    const resConditions = resValues
      .map((r) => RESOLUTION_MAP[r])
      .filter(Boolean)
      .map(
        (range) =>
          and(
            sql`${scenes.height} >= ${range[0]}`,
            sql`${scenes.height} <= ${range[1]}`,
          )!,
      );
    if (resConditions.length === 1) {
      conditions.push(resConditions[0]);
    } else if (resConditions.length > 1) {
      conditions.push(or(...resConditions)!);
    }
  }

  // Studio filter
  const studioIds = toArray(query.studio);
  if (studioIds.length === 1) {
    conditions.push(eq(scenes.studioId, studioIds[0]));
  } else if (studioIds.length > 1) {
    conditions.push(inArray(scenes.studioId, studioIds));
  }

  // Tag filter
  const tagNames = toArray(query.tag);
  if (tagNames.length > 0) {
    const tagRows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.name, tagNames));
    const tagIds = tagRows.map((t) => t.id);
    if (tagIds.length > 0) {
      const taggedSceneIds = await db
        .selectDistinct({ sceneId: sceneTags.sceneId })
        .from(sceneTags)
        .where(inArray(sceneTags.tagId, tagIds));
      const ids = taggedSceneIds.map((r) => r.sceneId);
      if (ids.length > 0) {
        conditions.push(inArray(scenes.id, ids));
      } else {
        return { scenes: [], total: 0, limit, offset };
      }
    }
  }

  // Performer filter
  const perfNames = toArray(query.performer);
  if (perfNames.length > 0) {
    const perfRows = await db
      .select({ id: performers.id })
      .from(performers)
      .where(inArray(performers.name, perfNames));
    const perfIds = perfRows.map((p) => p.id);
    if (perfIds.length > 0) {
      const perfSceneIds = await db
        .selectDistinct({ sceneId: scenePerformers.sceneId })
        .from(scenePerformers)
        .where(inArray(scenePerformers.performerId, perfIds));
      const ids = perfSceneIds.map((r) => r.sceneId);
      if (ids.length > 0) {
        conditions.push(inArray(scenes.id, ids));
      } else {
        return { scenes: [], total: 0, limit, offset };
      }
    }
  }

  // Rating filter
  const ratingMin =
    query.ratingMin !== undefined ? Number(query.ratingMin) : NaN;
  if (Number.isInteger(ratingMin) && ratingMin >= 1 && ratingMin <= 5) {
    conditions.push(
      and(isNotNull(scenes.rating), gte(scenes.rating, ratingMin))!,
    );
  }
  const ratingMax =
    query.ratingMax !== undefined ? Number(query.ratingMax) : NaN;
  if (Number.isInteger(ratingMax) && ratingMax >= 1 && ratingMax <= 5) {
    conditions.push(
      and(isNotNull(scenes.rating), lte(scenes.rating, ratingMax))!,
    );
  }

  // Date filter
  if (query.dateFrom && ISO_DATE_RE.test(query.dateFrom)) {
    conditions.push(
      and(isNotNull(scenes.date), gte(scenes.date, query.dateFrom))!,
    );
  }
  if (query.dateTo && ISO_DATE_RE.test(query.dateTo)) {
    conditions.push(
      and(isNotNull(scenes.date), lte(scenes.date, query.dateTo))!,
    );
  }

  // Duration filter
  const durationMin =
    query.durationMin !== undefined ? Number(query.durationMin) : NaN;
  if (Number.isFinite(durationMin) && durationMin >= 0) {
    conditions.push(
      and(isNotNull(scenes.duration), gte(scenes.duration, durationMin))!,
    );
  }
  const durationMax =
    query.durationMax !== undefined ? Number(query.durationMax) : NaN;
  if (Number.isFinite(durationMax) && durationMax > 0) {
    conditions.push(
      and(isNotNull(scenes.duration), lt(scenes.duration, durationMax))!,
    );
  }

  // Boolean filters
  if (query.organized === "true") {
    conditions.push(eq(scenes.organized, true));
  }
  if (query.organized === "false") {
    conditions.push(eq(scenes.organized, false));
  }
  if (query.interactive === "true") {
    conditions.push(eq(scenes.interactive, true));
  }
  if (query.interactive === "false") {
    conditions.push(eq(scenes.interactive, false));
  }
  if (query.hasFile === "true") {
    conditions.push(isNotNull(scenes.filePath));
  }
  if (query.hasFile === "false") {
    conditions.push(isNull(scenes.filePath));
  }
  if (query.played === "true") {
    conditions.push(
      or(gt(scenes.playCount, 0), isNotNull(scenes.lastPlayedAt))!,
    );
  }
  if (query.played === "false") {
    conditions.push(
      and(eq(scenes.playCount, 0), isNull(scenes.lastPlayedAt))!,
    );
  }

  // Codec filter
  const codecValues = toArray(query.codec)
    .map((c) => c.toLowerCase().trim())
    .filter((c) => ALLOWED_CODECS.has(c));
  if (codecValues.length === 1) {
    conditions.push(ilike(scenes.codec, `%${codecValues[0]}%`));
  } else if (codecValues.length > 1) {
    conditions.push(
      or(...codecValues.map((c) => ilike(scenes.codec, `%${c}%`)))!,
    );
  }

  // Sort
  const sortColumnMap: Record<string, typeof scenes.createdAt> = {
    recent: scenes.createdAt,
    title: scenes.title,
    duration: scenes.duration,
    size: scenes.fileSize,
    rating: scenes.rating,
    date: scenes.date,
    plays: scenes.playCount,
  };
  const defaultDir: Record<string, "asc" | "desc"> = {
    recent: "desc",
    title: "asc",
    duration: "desc",
    size: "desc",
    rating: "desc",
    date: "desc",
    plays: "desc",
  };
  const sortKey = query.sort ?? "recent";
  const col = sortColumnMap[sortKey] ?? scenes.createdAt;
  const dir =
    query.order === "asc" || query.order === "desc"
      ? query.order
      : (defaultDir[sortKey] ?? "desc");
  const orderBy = dir === "asc" ? asc(col) : desc(col);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(scenes)
    .where(where);

  // Fetch scenes
  const sceneRows = await db
    .select()
    .from(scenes)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Fetch relations for each scene
  const sceneIds = sceneRows.map((s) => s.id);

  const perfJoins =
    sceneIds.length > 0
      ? await db
          .select({
            sceneId: scenePerformers.sceneId,
            performerId: performers.id,
            performerName: performers.name,
            performerImagePath: performers.imagePath,
            performerIsNsfw: performers.isNsfw,
          })
          .from(scenePerformers)
          .innerJoin(
            performers,
            eq(scenePerformers.performerId, performers.id),
          )
          .where(inArray(scenePerformers.sceneId, sceneIds))
      : [];

  const tagJoins =
    sceneIds.length > 0
      ? await db
          .select({
            sceneId: sceneTags.sceneId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(sceneTags)
          .innerJoin(tags, eq(sceneTags.tagId, tags.id))
          .where(inArray(sceneTags.sceneId, sceneIds))
      : [];

  // Assemble response
  const result = sceneRows.map((scene) => ({
    id: scene.id,
    title: scene.title,
    details: scene.details,
    date: scene.date,
    rating: scene.rating,
    organized: scene.organized,
    isNsfw: scene.isNsfw,
    duration: scene.duration,
    durationFormatted: formatDuration(scene.duration),
    resolution: getResolutionLabel(scene.height),
    width: scene.width,
    height: scene.height,
    codec: scene.codec?.toUpperCase() ?? null,
    container: scene.container,
    fileSize: scene.fileSize,
    fileSizeFormatted: formatFileSize(scene.fileSize),
    filePath: scene.filePath,
    hasVideo: !!(scene.filePath && existsSync(scene.filePath)),
    streamUrl:
      scene.filePath && existsSync(scene.filePath)
        ? `/stream/${scene.id}/hls/master.m3u8`
        : null,
    directStreamUrl:
      scene.filePath && existsSync(scene.filePath)
        ? `/stream/${scene.id}/source`
        : null,
    thumbnailPath: scene.thumbnailPath,
    cardThumbnailPath: scene.cardThumbnailPath,
    spritePath: scene.spritePath,
    trickplayVttPath: scene.trickplayVttPath,
    playCount: scene.playCount,
    orgasmCount: scene.orgasmCount,
    studioId: scene.studioId,
    performers: perfJoins
      .filter((p) => p.sceneId === scene.id)
      .map((p) => ({
        id: p.performerId,
        name: p.performerName,
        imagePath: p.performerImagePath,
        isNsfw: p.performerIsNsfw,
      })),
    tags: tagJoins
      .filter((t) => t.sceneId === scene.id)
      .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
    createdAt: scene.createdAt,
    updatedAt: scene.updatedAt,
  }));

  return {
    scenes: result,
    total: Number(countResult.count),
    limit,
    offset,
  };
}

/**
 * Aggregate statistics across all scenes (optionally SFW-only).
 */
export async function getSceneStats(sfwOnly: boolean) {
  const sfwCondition = sfwOnly ? ne(scenes.isNsfw, true) : undefined;

  const [stats] = await db
    .select({
      totalScenes: sql<number>`count(*)`,
      totalDuration: sql<number>`coalesce(sum(${scenes.duration}), 0)`,
      totalSize: sql<number>`coalesce(sum(${scenes.fileSize}), 0)`,
      totalPlays: sql<number>`coalesce(sum(${scenes.playCount}), 0)`,
    })
    .from(scenes)
    .where(sfwCondition);

  const recentWhere = sfwCondition
    ? and(sfwCondition, sql`${scenes.createdAt} > now() - interval '7 days'`)
    : sql`${scenes.createdAt} > now() - interval '7 days'`;

  const [recentStats] = await db
    .select({
      recentCount: sql<number>`count(*)`,
    })
    .from(scenes)
    .where(recentWhere);

  const durationSec = Number(stats.totalDuration);
  const hours = Math.floor(durationSec / 3600);
  const mins = Math.floor((durationSec % 3600) / 60);

  return {
    totalScenes: Number(stats.totalScenes),
    totalDuration: durationSec,
    totalDurationFormatted: `${hours}h ${mins}m`,
    totalSize: Number(stats.totalSize),
    totalSizeFormatted: formatFileSize(Number(stats.totalSize)),
    totalPlays: Number(stats.totalPlays),
    recentCount: Number(recentStats.recentCount),
  };
}

/**
 * Fetch a single scene by ID with all relations.
 */
export async function getSceneById(id: string) {
  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    with: {
      studio: true,
      scenePerformers: {
        with: { performer: true },
      },
      sceneTags: {
        with: { tag: true },
      },
      markers: {
        with: { primaryTag: true },
        orderBy: asc(sceneMarkers.seconds),
      },
    },
  });

  if (!scene) {
    throw new AppError(404, "Video not found");
  }

  return {
    id: scene.id,
    title: scene.title,
    details: scene.details,
    date: scene.date,
    rating: scene.rating,
    url: scene.url,
    organized: scene.organized,
    isNsfw: scene.isNsfw,
    interactive: scene.interactive,
    duration: scene.duration,
    durationFormatted: formatDuration(scene.duration),
    resolution: getResolutionLabel(scene.height),
    width: scene.width,
    height: scene.height,
    frameRate: scene.frameRate,
    bitRate: scene.bitRate,
    codec: scene.codec?.toUpperCase() ?? null,
    container: scene.container,
    fileSize: scene.fileSize,
    fileSizeFormatted: formatFileSize(scene.fileSize),
    filePath: scene.filePath,
    hasVideo: !!(scene.filePath && existsSync(scene.filePath)),
    streamUrl:
      scene.filePath && existsSync(scene.filePath)
        ? `/stream/${scene.id}/hls/master.m3u8`
        : null,
    directStreamUrl:
      scene.filePath && existsSync(scene.filePath)
        ? `/stream/${scene.id}/source`
        : null,
    thumbnailPath: scene.thumbnailPath,
    cardThumbnailPath: scene.cardThumbnailPath,
    previewPath: scene.previewPath,
    spritePath: scene.spritePath,
    trickplayVttPath: scene.trickplayVttPath,
    playCount: scene.playCount,
    orgasmCount: scene.orgasmCount,
    playDuration: scene.playDuration,
    resumeTime: scene.resumeTime,
    lastPlayedAt: scene.lastPlayedAt,
    studio: scene.studio
      ? { id: scene.studio.id, name: scene.studio.name, url: scene.studio.url }
      : null,
    performers: scene.scenePerformers.map((sp) => ({
      id: sp.performer.id,
      name: sp.performer.name,
      gender: sp.performer.gender,
      imageUrl: sp.performer.imageUrl,
      imagePath: sp.performer.imagePath,
      favorite: sp.performer.favorite,
      isNsfw: sp.performer.isNsfw,
    })),
    tags: scene.sceneTags.map((st) => ({
      id: st.tag.id,
      name: st.tag.name,
      isNsfw: st.tag.isNsfw,
    })),
    markers: scene.markers.map((m) => ({
      id: m.id,
      title: m.title,
      seconds: m.seconds,
      endSeconds: m.endSeconds,
      primaryTag: m.primaryTag
        ? {
            id: m.primaryTag.id,
            name: m.primaryTag.name,
            isNsfw: m.primaryTag.isNsfw,
          }
        : null,
    })),
    createdAt: scene.createdAt,
    updatedAt: scene.updatedAt,
  };
}

/**
 * Update a scene's metadata, performers, tags, and studio.
 * Writes an NFO sidecar when the scene has a file on disk.
 */
export async function updateScene(id: string, body: UpdateSceneBody) {
  const existing = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    columns: { id: true, filePath: true },
  });

  if (!existing) {
    throw new AppError(404, "Video not found");
  }

  await db.transaction(async (tx) => {
    const sceneUpdate: Record<string, unknown> = { updatedAt: new Date() };

    if (body.title !== undefined) sceneUpdate.title = body.title;
    if (body.details !== undefined) sceneUpdate.details = body.details;
    if (body.date !== undefined) sceneUpdate.date = body.date;
    if (body.rating !== undefined) sceneUpdate.rating = body.rating;
    if (body.url !== undefined) sceneUpdate.url = body.url;
    if (body.organized !== undefined) sceneUpdate.organized = body.organized;
    if (body.isNsfw !== undefined) sceneUpdate.isNsfw = body.isNsfw;
    if (body.orgasmCount !== undefined)
      sceneUpdate.orgasmCount = body.orgasmCount;

    // Studio: find or create by name
    if (body.studioName !== undefined) {
      if (body.studioName === null || body.studioName === "") {
        sceneUpdate.studioId = null;
      } else {
        const [existingStudio] = await tx
          .select({ id: studios.id })
          .from(studios)
          .where(ilike(studios.name, body.studioName))
          .limit(1);

        if (existingStudio) {
          sceneUpdate.studioId = existingStudio.id;
        } else {
          const [created] = await tx
            .insert(studios)
            .values({ name: body.studioName })
            .returning({ id: studios.id });
          sceneUpdate.studioId = created.id;
        }
      }
    }

    await tx.update(scenes).set(sceneUpdate).where(eq(scenes.id, id));

    // Performers: replace all
    if (body.performerNames !== undefined) {
      await tx
        .delete(scenePerformers)
        .where(eq(scenePerformers.sceneId, id));

      for (const name of body.performerNames) {
        if (!name.trim()) continue;

        const [existingPerf] = await tx
          .select({ id: performers.id })
          .from(performers)
          .where(ilike(performers.name, name.trim()))
          .limit(1);

        const performerId =
          existingPerf?.id ??
          (
            await tx
              .insert(performers)
              .values({ name: name.trim() })
              .returning({ id: performers.id })
          )[0].id;

        await tx
          .insert(scenePerformers)
          .values({ sceneId: id, performerId })
          .onConflictDoNothing();
      }

      // Update performer scene counts
      await tx.execute(sql`
        UPDATE performers SET scene_count = (
          SELECT count(*) FROM scene_performers WHERE performer_id = performers.id
        )
      `);
    }

    // Tags: replace all
    if (body.tagNames !== undefined) {
      await tx.delete(sceneTags).where(eq(sceneTags.sceneId, id));

      for (const name of body.tagNames) {
        if (!name.trim()) continue;

        const [existingTag] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(ilike(tags.name, name.trim()))
          .limit(1);

        const tagId =
          existingTag?.id ??
          (
            await tx
              .insert(tags)
              .values({ name: name.trim() })
              .returning({ id: tags.id })
          )[0].id;

        await tx
          .insert(sceneTags)
          .values({ sceneId: id, tagId })
          .onConflictDoNothing();
      }

      // Update tag scene counts
      await tx.execute(sql`
        UPDATE tags SET scene_count = (
          SELECT count(*) FROM scene_tags WHERE tag_id = tags.id
        )
      `);
    }
  });

  // Write NFO sidecar if the scene has a file
  if (existing.filePath) {
    try {
      const updated = await db.query.scenes.findFirst({
        where: eq(scenes.id, id),
        with: {
          studio: true,
          sceneTags: { with: { tag: true } },
        },
      });

      if (updated) {
        await writeNfo(existing.filePath, {
          title: updated.title,
          plot: updated.details,
          date: updated.date,
          studio: updated.studio?.name,
          rating: updated.rating,
          tags: updated.sceneTags.map((st) => st.tag.name),
          duration: updated.duration,
          url: updated.url,
        });
      }
    } catch {
      // NFO write failure is non-fatal
    }
  }

  return { ok: true as const, id };
}

/**
 * Delete a scene and its generated assets. Optionally delete the source file.
 */
export async function deleteScene(id: string, deleteFile: boolean) {
  const existing = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    columns: { id: true, filePath: true },
  });

  if (!existing) {
    throw new AppError(404, "Video not found");
  }

  // Delete scene record (cascades handle scenePerformers, sceneTags, sceneMarkers)
  await db.delete(scenes).where(eq(scenes.id, id));

  // Clean up generated files (thumbnails, sprites, HLS cache, etc.)
  const genDir = getGeneratedSceneDir(id);
  try {
    if (existsSync(genDir)) await rm(genDir, { recursive: true });
  } catch {
    // non-fatal
  }

  // Optionally delete the source video file from disk
  if (deleteFile && existing.filePath) {
    try {
      if (existsSync(existing.filePath)) await unlink(existing.filePath);
    } catch {
      // non-fatal
    }
  }

  return { ok: true as const };
}

/**
 * Create a scene marker with optional primary tag (find-or-create).
 */
export async function createMarker(sceneId: string, body: CreateMarkerBody) {
  if (!body.title?.trim() || body.seconds == null) {
    throw new AppError(400, "title and seconds are required");
  }

  const existing = await db.query.scenes.findFirst({
    where: eq(scenes.id, sceneId),
    columns: { id: true },
  });
  if (!existing) {
    throw new AppError(404, "Video not found");
  }

  let primaryTagId: string | null = null;
  if (body.primaryTagName?.trim()) {
    const [existingTag] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(ilike(tags.name, body.primaryTagName.trim()))
      .limit(1);
    primaryTagId =
      existingTag?.id ??
      (
        await db
          .insert(tags)
          .values({ name: body.primaryTagName.trim() })
          .returning({ id: tags.id })
      )[0].id;
  }

  const [marker] = await db
    .insert(sceneMarkers)
    .values({
      sceneId,
      title: body.title.trim(),
      seconds: body.seconds,
      endSeconds: body.endSeconds ?? null,
      primaryTagId,
    })
    .returning();

  const primaryTag = primaryTagId
    ? await db.query.tags.findFirst({
        where: eq(tags.id, primaryTagId),
        columns: { id: true, name: true },
      })
    : null;

  return {
    id: marker.id,
    title: marker.title,
    seconds: marker.seconds,
    endSeconds: marker.endSeconds,
    primaryTag: primaryTag
      ? { id: primaryTag.id, name: primaryTag.name }
      : null,
  };
}

/**
 * Update an existing scene marker.
 */
export async function updateMarker(markerId: string, body: UpdateMarkerBody) {
  const existing = await db.query.sceneMarkers.findFirst({
    where: eq(sceneMarkers.id, markerId),
  });
  if (!existing) {
    throw new AppError(404, "Marker not found");
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.seconds !== undefined) update.seconds = body.seconds;
  if (body.endSeconds !== undefined) update.endSeconds = body.endSeconds;

  if (body.primaryTagName !== undefined) {
    if (!body.primaryTagName?.trim()) {
      update.primaryTagId = null;
    } else {
      const [existingTag] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(ilike(tags.name, body.primaryTagName.trim()))
        .limit(1);
      update.primaryTagId =
        existingTag?.id ??
        (
          await db
            .insert(tags)
            .values({ name: body.primaryTagName.trim() })
            .returning({ id: tags.id })
        )[0].id;
    }
  }

  await db
    .update(sceneMarkers)
    .set(update)
    .where(eq(sceneMarkers.id, markerId));

  return { ok: true as const };
}

/**
 * Delete a scene marker by ID.
 */
export async function deleteMarker(markerId: string) {
  const existing = await db.query.sceneMarkers.findFirst({
    where: eq(sceneMarkers.id, markerId),
  });
  if (!existing) {
    throw new AppError(404, "Marker not found");
  }

  await db.delete(sceneMarkers).where(eq(sceneMarkers.id, markerId));
  return { ok: true as const };
}

/**
 * Increment play count and update last-played timestamp.
 */
export async function recordPlay(id: string) {
  const existing = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    columns: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Video not found");
  }

  await db
    .update(scenes)
    .set({
      playCount: sql`${scenes.playCount} + 1`,
      lastPlayedAt: new Date(),
    })
    .where(eq(scenes.id, id));

  return { ok: true as const };
}

/**
 * Increment orgasm count for a scene.
 */
export async function recordOrgasm(id: string) {
  const existing = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    columns: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Video not found");
  }

  const [updated] = await db
    .update(scenes)
    .set({
      orgasmCount: sql`${scenes.orgasmCount} + 1`,
    })
    .where(eq(scenes.id, id))
    .returning({ orgasmCount: scenes.orgasmCount });

  return { ok: true as const, orgasmCount: updated.orgasmCount };
}

/**
 * Set a custom thumbnail from a raw image buffer.
 * Used by the upload, from-url, and from-frame endpoints.
 */
export async function setCustomThumbnail(id: string, buffer: Buffer) {
  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    columns: { id: true, filePath: true },
  });

  if (!scene) {
    throw new AppError(404, "Video not found");
  }

  return saveCustomThumbnail(id, buffer);
}

/**
 * Set a custom thumbnail by downloading from a URL.
 */
export async function setCustomThumbnailFromUrl(id: string, imageUrl: string) {
  if (!imageUrl || !imageUrl.startsWith("http")) {
    throw new AppError(400, "Invalid image URL");
  }

  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    columns: { id: true },
  });

  if (!scene) {
    throw new AppError(404, "Video not found");
  }

  let buffer: Buffer;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new AppError(502, `Failed to fetch image: ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, "Failed to download image");
  }

  return saveCustomThumbnail(id, buffer);
}

/**
 * Set a custom thumbnail extracted from a specific frame of the video.
 */
export async function setCustomThumbnailFromFrame(
  id: string,
  requestedSeconds: number,
) {
  if (!Number.isFinite(requestedSeconds)) {
    throw new AppError(400, "Invalid frame time");
  }

  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    columns: { id: true, filePath: true, duration: true },
  });

  if (!scene || !scene.filePath || !existsSync(scene.filePath)) {
    throw new AppError(404, "Video file not found");
  }

  const maxSeconds =
    scene.duration && scene.duration > 0
      ? Math.max(0, scene.duration - 0.05)
      : null;
  const seconds =
    maxSeconds != null
      ? Math.min(Math.max(0, requestedSeconds), maxSeconds)
      : Math.max(0, requestedSeconds);

  const genDir = getGeneratedSceneDir(id);
  await mkdir(genDir, { recursive: true });
  const thumbPath = path.join(genDir, "thumbnail-custom.jpg");

  try {
    await runProcess("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      scene.filePath,
      "-ss",
      seconds.toFixed(3),
      "-frames:v",
      "1",
      "-q:v",
      "2",
      thumbPath,
    ]);
  } catch {
    throw new AppError(500, "Failed to generate thumbnail from frame");
  }

  const assetUrl = `/assets/scenes/${id}/thumb-custom`;
  await db
    .update(scenes)
    .set({
      thumbnailPath: assetUrl,
      cardThumbnailPath: null,
      updatedAt: new Date(),
    })
    .where(eq(scenes.id, id));

  return { ok: true as const, thumbnailPath: assetUrl, seconds };
}

/**
 * Remove the custom thumbnail and revert to the auto-generated default.
 */
export async function resetThumbnail(id: string) {
  const scene = await db.query.scenes.findFirst({
    where: eq(scenes.id, id),
    columns: { id: true, filePath: true },
  });

  if (!scene) {
    throw new AppError(404, "Video not found");
  }

  // Delete custom thumbnail file if it exists
  const customPath = path.join(
    getGeneratedSceneDir(id),
    "thumbnail-custom.jpg",
  );
  try {
    if (existsSync(customPath)) await unlink(customPath);
  } catch {
    // non-fatal
  }

  // Revert to the standard generated thumbnail/card URLs
  const defaultUrl = `/assets/scenes/${id}/thumb`;
  const defaultCardUrl = `/assets/scenes/${id}/card`;
  await db
    .update(scenes)
    .set({
      thumbnailPath: defaultUrl,
      cardThumbnailPath: defaultCardUrl,
      updatedAt: new Date(),
    })
    .where(eq(scenes.id, id));

  return { ok: true as const, thumbnailPath: defaultUrl };
}
