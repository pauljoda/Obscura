import { existsSync } from "node:fs";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  and,
  asc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AppDb } from "@obscura/db";
import { schema } from "@obscura/db";
import {
  fileNameToTitle,
  getGeneratedAudioLibraryDir,
  getGeneratedAudioTrackDir,
  getGeneratedGalleryDir,
  getGeneratedImageDir,
} from "@obscura/media-core";
import { NotFoundError, ValidationError } from "./errors";
import { buildHierarchyScopeConditions } from "./hierarchy";
import { getImagePreviewPath, isVideoImageFormat } from "./image-media";
import {
  audioLibraryVisibleSql,
  audioTrackVisibleSql,
  galleryVisibleSql,
  imageVisibleSql,
} from "./library-root-visibility";
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
  buildResolutionConditions,
  parsePagination,
  resolvePerformerIds,
  resolveTagIds,
  toArray,
  type SortConfig,
} from "./media-query-helpers";

const {
  galleries,
  galleryPerformers,
  galleryTags,
  galleryChapters,
  images,
  imagePerformers,
  imageTags,
  audioLibraries,
  audioLibraryPerformers,
  audioLibraryTags,
  audioTracks,
  audioTrackPerformers,
  audioTrackTags,
  audioTrackMarkers,
  performers,
  tags,
  studios,
} = schema;

type TxArg = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

const gallerySortConfig: SortConfig = {
  columns: {
    recent: galleries.createdAt,
    title: galleries.title,
    date: galleries.date,
    rating: galleries.rating,
    imageCount: galleries.imageCount,
  },
  defaultDirs: {
    recent: "desc",
    title: "asc",
    date: "desc",
    rating: "desc",
    imageCount: "desc",
  },
  fallbackColumn: galleries.createdAt,
};

const imageSortConfig: SortConfig = {
  columns: {
    recent: images.createdAt,
    title: images.title,
    date: images.date,
    rating: images.rating,
    resolution: images.width,
    size: images.fileSize,
  },
  defaultDirs: {
    recent: "desc",
    title: "asc",
    date: "desc",
    rating: "desc",
    resolution: "desc",
    size: "desc",
  },
  fallbackColumn: images.createdAt,
};

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
};

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

function toGalleryImageListItem(img: typeof images.$inferSelect) {
  return {
    id: img.id,
    title: img.title,
    date: img.date,
    rating: img.rating,
    organized: img.organized,
    isNsfw: img.isNsfw,
    width: img.width,
    height: img.height,
    format: img.format,
    isVideo: isVideoImageFormat(img.format),
    fileSize: img.fileSize,
    thumbnailPath: img.thumbnailPath,
    previewPath: getImagePreviewPath(img.id, img.format),
    fullPath: `/assets/images/${img.id}/full`,
    galleryId: img.galleryId,
    sortOrder: img.sortOrder,
    studioId: img.studioId,
    performers: [] as Array<{ id: string; name: string }>,
    tags: [] as Array<{ id: string; name: string; isNsfw: boolean }>,
    createdAt: img.createdAt.toISOString(),
  };
}

async function findOrCreateStudioId(
  tx: TxArg,
  studioName: string | null | undefined,
) {
  const trimmed = studioName?.trim() ?? "";
  if (!trimmed) return null;
  const [existing] = await tx
    .select({ id: studios.id })
    .from(studios)
    .where(ilike(studios.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(studios)
    .values({ name: trimmed })
    .returning({ id: studios.id });
  return created.id;
}

async function findOrCreatePerformerId(tx: TxArg, name: string) {
  const trimmed = name.trim();
  const [existing] = await tx
    .select({ id: performers.id })
    .from(performers)
    .where(ilike(performers.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(performers)
    .values({ name: trimmed })
    .returning({ id: performers.id });
  return created.id;
}

async function findOrCreateTagId(tx: TxArg, name: string) {
  const trimmed = name.trim();
  const [existing] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(ilike(tags.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(tags)
    .values({ name: trimmed })
    .returning({ id: tags.id });
  return created.id;
}

export interface ListGalleriesQuery {
  search?: string;
  sort?: string;
  order?: string;
  tag?: string | string[];
  performer?: string | string[];
  studio?: string;
  type?: string;
  parent?: string;
  root?: string;
  limit?: string;
  offset?: string;
  ratingMin?: string;
  ratingMax?: string;
  dateFrom?: string;
  dateTo?: string;
  imageCountMin?: string;
  organized?: string;
  nsfw?: string;
}

export async function listGalleriesRead(db: AppDb, query: ListGalleriesQuery) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 50, 200);
  const conditions: SQL[] = [galleryVisibleSql(galleries.folderPath, galleries.zipFilePath)];

  conditions.push(...buildHierarchyScopeConditions(galleries.parentId, query));

  if (query.nsfw === "off") {
    conditions.push(eq(galleries.isNsfw, false));
  }
  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(galleries.title, term),
        ilike(galleries.details, term),
        ilike(galleries.folderPath, term),
        ilike(galleries.zipFilePath, term),
      )!,
    );
  }
  if (query.type) conditions.push(eq(galleries.galleryType, query.type));
  if (query.studio) conditions.push(eq(galleries.studioId, query.studio));

  const tagEntityIds = await resolveTagIds(
    db,
    toArray(query.tag),
    galleryTags,
    galleryTags.galleryId,
    galleryTags.tagId,
  );
  if (tagEntityIds === null) return { galleries: [], total: 0, limit, offset };
  if (tagEntityIds) conditions.push(inArray(galleries.id, tagEntityIds));

  const perfEntityIds = await resolvePerformerIds(
    db,
    toArray(query.performer),
    galleryPerformers,
    galleryPerformers.galleryId,
    galleryPerformers.performerId,
  );
  if (perfEntityIds === null) return { galleries: [], total: 0, limit, offset };
  if (perfEntityIds) conditions.push(inArray(galleries.id, perfEntityIds));

  conditions.push(
    ...buildRatingConditions(galleries.rating, query.ratingMin, query.ratingMax),
  );
  conditions.push(
    ...buildDateConditions(galleries.date, query.dateFrom, query.dateTo),
  );

  const imgCountMin =
    query.imageCountMin !== undefined ? Number(query.imageCountMin) : NaN;
  if (Number.isInteger(imgCountMin) && imgCountMin >= 1) {
    conditions.push(gte(galleries.imageCount, imgCountMin));
  }

  const orgCond = buildBooleanCondition(galleries.organized, query.organized);
  if (orgCond) conditions.push(orgCond);

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(galleries)
    .where(where);

  const galleryRows = await db
    .select()
    .from(galleries)
    .where(where)
    .orderBy(buildOrderBy(gallerySortConfig, query.sort, query.order))
    .limit(limit)
    .offset(offset);

  const galleryIds = galleryRows.map((g) => g.id);
  const [perfJoins, tagJoins, previewImages] = await Promise.all([
    galleryIds.length > 0
      ? db
          .select({
            galleryId: galleryPerformers.galleryId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(galleryPerformers)
          .innerJoin(performers, eq(galleryPerformers.performerId, performers.id))
          .where(inArray(galleryPerformers.galleryId, galleryIds))
      : Promise.resolve([]),
    galleryIds.length > 0
      ? db
          .select({
            galleryId: galleryTags.galleryId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(galleryTags)
          .innerJoin(tags, eq(galleryTags.tagId, tags.id))
          .where(inArray(galleryTags.galleryId, galleryIds))
      : Promise.resolve([]),
    galleryIds.length > 0
      ? db
          .select({
            galleryId: images.galleryId,
            imageId: images.id,
            sortOrder: images.sortOrder,
          })
          .from(images)
          .where(inArray(images.galleryId, galleryIds))
          .orderBy(asc(images.sortOrder))
      : Promise.resolve([]),
  ]);

  const studioIds = [
    ...new Set(galleryRows.flatMap((g) => (g.studioId ? [g.studioId] : []))),
  ];
  const studioRows =
    studioIds.length > 0
      ? await db
          .select({ id: studios.id, name: studios.name })
          .from(studios)
          .where(inArray(studios.id, studioIds))
      : [];
  const studioMap = new Map(studioRows.map((s) => [s.id, s.name]));

  return {
    galleries: galleryRows.map((gallery) => ({
      id: gallery.id,
      title: gallery.title,
      galleryType: gallery.galleryType as "folder" | "zip" | "virtual",
      coverImagePath: `/assets/galleries/${gallery.id}/cover`,
      previewImagePaths: previewImages
        .filter((img) => img.galleryId === gallery.id)
        .slice(0, 4)
        .map((img) => `/assets/images/${img.imageId}/thumb`),
      imageCount: gallery.imageCount,
      rating: gallery.rating,
      organized: gallery.organized,
      isNsfw: gallery.isNsfw,
      date: gallery.date,
      studioId: gallery.studioId,
      studioName: gallery.studioId
        ? (studioMap.get(gallery.studioId) ?? null)
        : null,
      performers: perfJoins
        .filter((p) => p.galleryId === gallery.id)
        .map((p) => ({ id: p.performerId, name: p.performerName })),
      tags: tagJoins
        .filter((t) => t.galleryId === gallery.id)
        .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
      parentId: gallery.parentId,
      createdAt: gallery.createdAt.toISOString(),
    })),
    total: countResult?.count ?? 0,
    limit,
    offset,
  };
}

export async function getGalleryDetailRead(
  db: AppDb,
  id: string,
  options?: { imageLimit?: string; imageOffset?: string },
) {
  const imageLimit = Math.min(Number(options?.imageLimit) || 60, 200);
  const imageOffset = Number(options?.imageOffset) || 0;

  const gallery = await db.query.galleries.findFirst({
    where: and(
      eq(galleries.id, id),
      galleryVisibleSql(galleries.folderPath, galleries.zipFilePath),
    ),
    with: {
      studio: true,
      galleryPerformers: { with: { performer: true } },
      galleryTags: { with: { tag: true } },
      chapters: { orderBy: asc(galleryChapters.imageIndex) },
    },
  });
  if (!gallery) throw new NotFoundError("Gallery not found");

  const [imageCountResult, imageRows, children] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(images)
      .where(and(eq(images.galleryId, id), imageVisibleSql(images.filePath))),
    db
      .select()
      .from(images)
      .where(and(eq(images.galleryId, id), imageVisibleSql(images.filePath)))
      .orderBy(asc(images.sortOrder))
      .limit(imageLimit)
      .offset(imageOffset),
    db
      .select({
        id: galleries.id,
        title: galleries.title,
        imageCount: galleries.imageCount,
        isNsfw: galleries.isNsfw,
      })
      .from(galleries)
      .where(
        and(
          eq(galleries.parentId, id),
          galleryVisibleSql(galleries.folderPath, galleries.zipFilePath),
        ),
      )
      .orderBy(asc(galleries.title)),
  ]);

  const childIds = children.map((c) => c.id);
  const childPreviewImages =
    childIds.length > 0
      ? await db
          .select({
            galleryId: images.galleryId,
            imageId: images.id,
            sortOrder: images.sortOrder,
          })
          .from(images)
          .where(and(inArray(images.galleryId, childIds), imageVisibleSql(images.filePath)))
          .orderBy(asc(images.sortOrder))
      : [];
  const childPreviewMap = new Map<string, string[]>();
  for (const img of childPreviewImages) {
    if (!img.galleryId) continue;
    const list = childPreviewMap.get(img.galleryId) ?? [];
    if (list.length < 4) list.push(`/assets/images/${img.imageId}/thumb`);
    childPreviewMap.set(img.galleryId, list);
  }

  return {
    id: gallery.id,
    title: gallery.title,
    details: gallery.details,
    galleryType: gallery.galleryType as "folder" | "zip" | "virtual",
    date: gallery.date,
    rating: gallery.rating,
    organized: gallery.organized,
    isNsfw: gallery.isNsfw,
    photographer: gallery.photographer,
    folderPath: gallery.folderPath,
    zipFilePath: gallery.zipFilePath,
    parentId: gallery.parentId,
    coverImageId: gallery.coverImageId,
    coverImagePath: `/assets/galleries/${gallery.id}/cover`,
    imageCount: gallery.imageCount,
    studio: gallery.studio
      ? {
          id: gallery.studio.id,
          name: gallery.studio.name,
          url: gallery.studio.url,
        }
      : null,
    performers: gallery.galleryPerformers.map((gp) => ({
      id: gp.performer.id,
      name: gp.performer.name,
      gender: gp.performer.gender,
      imagePath: gp.performer.imagePath,
    })),
    tags: gallery.galleryTags.map((gt) => ({
      id: gt.tag.id,
      name: gt.tag.name,
      isNsfw: gt.tag.isNsfw,
    })),
    chapters: gallery.chapters.map((ch) => ({
      id: ch.id,
      galleryId: ch.galleryId,
      title: ch.title,
      imageIndex: ch.imageIndex,
    })),
    images: imageRows.map(toGalleryImageListItem),
    imageTotal: imageCountResult[0]?.count ?? 0,
    imageLimit,
    imageOffset,
    children: children.map((child) => ({
      id: child.id,
      title: child.title,
      imageCount: child.imageCount,
      coverImagePath: `/assets/galleries/${child.id}/cover`,
      previewImagePaths: childPreviewMap.get(child.id) ?? [],
      isNsfw: child.isNsfw,
    })),
    createdAt: gallery.createdAt.toISOString(),
    updatedAt: gallery.updatedAt.toISOString(),
  };
}

export async function getGalleryImagesRead(
  db: AppDb,
  galleryId: string,
  options?: { limit?: string; offset?: string },
) {
  const limit = Math.min(Number(options?.limit) || 60, 200);
  const offset = Number(options?.offset) || 0;
  const gallery = await db.query.galleries.findFirst({
    where: and(
      eq(galleries.id, galleryId),
      galleryVisibleSql(galleries.folderPath, galleries.zipFilePath),
    ),
    columns: { id: true },
  });
  if (!gallery) throw new NotFoundError("Gallery not found");

  const [countResult, imageRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(images)
      .where(and(eq(images.galleryId, galleryId), imageVisibleSql(images.filePath))),
    db
      .select()
      .from(images)
      .where(and(eq(images.galleryId, galleryId), imageVisibleSql(images.filePath)))
      .orderBy(asc(images.sortOrder))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    images: imageRows.map(toGalleryImageListItem),
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  };
}

export async function getGalleriesByIdsRead(db: AppDb, ids: string[]) {
  if (ids.length === 0) return [];

  const galleryRows = await db
    .select()
    .from(galleries)
    .where(
      and(
        inArray(galleries.id, ids),
        galleryVisibleSql(galleries.folderPath, galleries.zipFilePath),
      ),
    );

  const galleryIds = galleryRows.map((gallery) => gallery.id);
  const [perfJoins, tagJoins, studioRows] = await Promise.all([
    galleryIds.length > 0
      ? db
          .select({
            galleryId: galleryPerformers.galleryId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(galleryPerformers)
          .innerJoin(performers, eq(galleryPerformers.performerId, performers.id))
          .where(inArray(galleryPerformers.galleryId, galleryIds))
      : Promise.resolve([]),
    galleryIds.length > 0
      ? db
          .select({
            galleryId: galleryTags.galleryId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(galleryTags)
          .innerJoin(tags, eq(galleryTags.tagId, tags.id))
          .where(inArray(galleryTags.galleryId, galleryIds))
      : Promise.resolve([]),
    (() => {
      const studioIds = [
        ...new Set(galleryRows.flatMap((gallery) => (gallery.studioId ? [gallery.studioId] : []))),
      ];
      return studioIds.length > 0
        ? db
            .select({ id: studios.id, name: studios.name })
            .from(studios)
            .where(inArray(studios.id, studioIds))
        : Promise.resolve([]);
    })(),
  ]);

  const studioMap = new Map(studioRows.map((studio) => [studio.id, studio.name]));

  return galleryRows.map((gallery) => ({
    id: gallery.id,
    title: gallery.title,
    galleryType: gallery.galleryType as "folder" | "zip" | "virtual",
    coverImagePath: `/assets/galleries/${gallery.id}/cover`,
    previewImagePaths: [] as string[],
    imageCount: gallery.imageCount,
    rating: gallery.rating,
    organized: gallery.organized,
    isNsfw: gallery.isNsfw,
    date: gallery.date,
    photographer: gallery.photographer,
    parentId: gallery.parentId,
    studioId: gallery.studioId,
    studioName: gallery.studioId ? (studioMap.get(gallery.studioId) ?? null) : null,
    performers: perfJoins
      .filter((join) => join.galleryId === gallery.id)
      .map((join) => ({ id: join.performerId, name: join.performerName })),
    tags: tagJoins
      .filter((join) => join.galleryId === gallery.id)
      .map((join) => ({ id: join.tagId, name: join.tagName, isNsfw: join.tagIsNsfw })),
    createdAt: gallery.createdAt.toISOString(),
  }));
}

export async function getGalleryStatsRead(db: AppDb) {
  const [galleryStats, imageStats, recentStats] = await Promise.all([
    db
      .select({ totalGalleries: sql<number>`count(*)::int` })
      .from(galleries)
      .where(galleryVisibleSql(galleries.folderPath, galleries.zipFilePath)),
    db
      .select({ totalImages: sql<number>`count(*)::int` })
      .from(images)
      .where(imageVisibleSql(images.filePath)),
    db
      .select({ recentCount: sql<number>`count(*)::int` })
      .from(galleries)
      .where(
        and(
          galleryVisibleSql(galleries.folderPath, galleries.zipFilePath),
          sql`${galleries.createdAt} > now() - interval '7 days'`,
        ),
      ),
  ]);

  return {
    totalGalleries: galleryStats[0]?.totalGalleries ?? 0,
    totalImages: imageStats[0]?.totalImages ?? 0,
    recentCount: recentStats[0]?.recentCount ?? 0,
  };
}

export async function createGalleryWrite(
  db: AppDb,
  body: { title: string; details?: string | null; date?: string | null },
) {
  if (!body.title?.trim()) throw new ValidationError("title is required");
  const [created] = await db
    .insert(galleries)
    .values({
      title: body.title.trim(),
      details: body.details ?? null,
      date: body.date ?? null,
      galleryType: "virtual",
      imageCount: 0,
    })
    .returning({ id: galleries.id });
  return { ok: true as const, id: created.id };
}

export async function updateGalleryWrite(
  db: AppDb,
  id: string,
  body: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    organized?: boolean;
    isNsfw?: boolean;
    photographer?: string | null;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
  },
) {
  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, id),
    columns: { id: true, isNsfw: true },
  });
  if (!existing) throw new NotFoundError("Gallery not found");

  let affectedGalleryIds: string[] | undefined;
  const shouldPropagateNsfw =
    body.isNsfw !== undefined && existing.isNsfw !== body.isNsfw;

  await db.transaction(async (tx) => {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) update.title = body.title;
    if (body.details !== undefined) update.details = body.details;
    if (body.date !== undefined) update.date = body.date;
    if (body.rating !== undefined) update.rating = body.rating;
    if (body.organized !== undefined) update.organized = body.organized;
    if (body.isNsfw !== undefined) update.isNsfw = body.isNsfw;
    if (body.photographer !== undefined) update.photographer = body.photographer;
    if (body.studioName !== undefined) {
      update.studioId = await findOrCreateStudioId(tx, body.studioName);
    }
    await tx.update(galleries).set(update).where(eq(galleries.id, id));

    if (shouldPropagateNsfw && body.isNsfw !== undefined) {
      const descendantRows = await tx.execute<{ id: string }>(sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM galleries WHERE parent_id = ${id}
          UNION ALL
          SELECT g.id FROM galleries g
          INNER JOIN descendants d ON g.parent_id = d.id
        )
        SELECT id FROM descendants
      `);
      const descendantIds = descendantRows.map((row) => row.id);
      affectedGalleryIds = [id, ...descendantIds];
      if (descendantIds.length > 0) {
        await tx
          .update(galleries)
          .set({ isNsfw: body.isNsfw, updatedAt: new Date() })
          .where(inArray(galleries.id, descendantIds));
      }
      await tx
        .update(images)
        .set({ isNsfw: body.isNsfw, updatedAt: new Date() })
        .where(inArray(images.galleryId, affectedGalleryIds));
    }

    if (body.performerNames !== undefined) {
      await tx
        .delete(galleryPerformers)
        .where(eq(galleryPerformers.galleryId, id));
      for (const name of body.performerNames) {
        if (!name.trim()) continue;
        await tx
          .insert(galleryPerformers)
          .values({
            galleryId: id,
            performerId: await findOrCreatePerformerId(tx, name),
          })
          .onConflictDoNothing();
      }
    }

    if (body.tagNames !== undefined) {
      await tx.delete(galleryTags).where(eq(galleryTags.galleryId, id));
      for (const name of body.tagNames) {
        if (!name.trim()) continue;
        await tx
          .insert(galleryTags)
          .values({ galleryId: id, tagId: await findOrCreateTagId(tx, name) })
          .onConflictDoNothing();
      }
    }
  });

  return { ok: true as const, id, ...(affectedGalleryIds ? { affectedGalleryIds } : {}) };
}

export async function deleteGalleryWrite(db: AppDb, id: string) {
  const result = await db
    .delete(galleries)
    .where(eq(galleries.id, id))
    .returning({ id: galleries.id });
  if (result.length === 0) throw new NotFoundError("Gallery not found");
  return { ok: true as const };
}

export async function setGalleryCoverWrite(
  db: AppDb,
  galleryId: string,
  imageId: string,
) {
  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
    columns: { id: true },
  });
  if (!existing) throw new NotFoundError("Gallery not found");

  await db
    .update(galleries)
    .set({ coverImageId: imageId, updatedAt: new Date() })
    .where(eq(galleries.id, galleryId));

  return { ok: true as const };
}

export async function deleteGalleryCoverWrite(db: AppDb, galleryId: string) {
  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
    columns: { id: true },
  });
  if (!existing) throw new NotFoundError("Gallery not found");

  const customPath = path.join(
    getGeneratedGalleryDir(galleryId),
    GALLERY_COVER_FILE,
  );
  try {
    if (existsSync(customPath)) await unlink(customPath);
  } catch {
    /* non-fatal */
  }

  await db
    .update(galleries)
    .set({ coverImageId: null, updatedAt: new Date() })
    .where(eq(galleries.id, galleryId));

  return { ok: true as const };
}

const GALLERY_COVER_FILE = "cover-custom.jpg";

export async function uploadGalleryCoverWrite(
  db: AppDb,
  galleryId: string,
  buffer: Buffer,
) {
  if (!buffer.length) throw new ValidationError("Empty file");
  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
    columns: { id: true },
  });
  if (!existing) throw new NotFoundError("Gallery not found");

  const dir = getGeneratedGalleryDir(galleryId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, GALLERY_COVER_FILE), buffer);

  await db
    .update(galleries)
    .set({ updatedAt: new Date() })
    .where(eq(galleries.id, galleryId));

  return {
    ok: true as const,
    coverImagePath: `/assets/galleries/${galleryId}/cover`,
  };
}

const IMAGE_CUSTOM_THUMB_FILE = "thumb-custom.jpg";

export async function setCustomImageThumbnailWrite(
  db: AppDb,
  imageId: string,
  buffer: Buffer,
) {
  if (!buffer.length) throw new ValidationError("Empty file");
  const [image] = await db
    .select({ id: images.id })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);
  if (!image) throw new NotFoundError("Image not found");

  const dir = getGeneratedImageDir(imageId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, IMAGE_CUSTOM_THUMB_FILE), buffer);

  await db
    .update(images)
    .set({
      thumbnailPath: `/assets/images/${imageId}/thumb`,
      updatedAt: new Date(),
    })
    .where(eq(images.id, imageId));

  return {
    ok: true as const,
    thumbnailPath: `/assets/images/${imageId}/thumb`,
  };
}

export async function resetImageThumbnailWrite(db: AppDb, imageId: string) {
  const [image] = await db
    .select({ id: images.id })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);
  if (!image) throw new NotFoundError("Image not found");

  const customPath = path.join(
    getGeneratedImageDir(imageId),
    IMAGE_CUSTOM_THUMB_FILE,
  );
  try {
    if (existsSync(customPath)) await unlink(customPath);
  } catch {
    /* non-fatal */
  }

  await db
    .update(images)
    .set({ updatedAt: new Date() })
    .where(eq(images.id, imageId));

  return {
    ok: true as const,
    thumbnailPath: `/assets/images/${imageId}/thumb`,
  };
}

export async function createGalleryChapterWrite(
  db: AppDb,
  galleryId: string,
  body: { title: string; imageIndex: number },
) {
  if (!body.title?.trim() || body.imageIndex == null) {
    throw new ValidationError("title and imageIndex are required");
  }

  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
    columns: { id: true },
  });
  if (!existing) throw new NotFoundError("Gallery not found");

  const [chapter] = await db
    .insert(galleryChapters)
    .values({
      galleryId,
      title: body.title.trim(),
      imageIndex: body.imageIndex,
    })
    .returning();

  return {
    id: chapter.id,
    galleryId: chapter.galleryId,
    title: chapter.title,
    imageIndex: chapter.imageIndex,
  };
}

export async function updateGalleryChapterWrite(
  db: AppDb,
  chapterId: string,
  body: { title?: string; imageIndex?: number },
) {
  const existing = await db.query.galleryChapters.findFirst({
    where: eq(galleryChapters.id, chapterId),
    columns: { id: true },
  });
  if (!existing) throw new NotFoundError("Chapter not found");

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.imageIndex !== undefined) update.imageIndex = body.imageIndex;

  await db
    .update(galleryChapters)
    .set(update)
    .where(eq(galleryChapters.id, chapterId));

  return { ok: true as const };
}

export async function deleteGalleryChapterWrite(db: AppDb, chapterId: string) {
  const existing = await db.query.galleryChapters.findFirst({
    where: eq(galleryChapters.id, chapterId),
    columns: { id: true },
  });
  if (!existing) throw new NotFoundError("Chapter not found");

  await db.delete(galleryChapters).where(eq(galleryChapters.id, chapterId));
  return { ok: true as const };
}

export async function uploadImageWrite(
  db: AppDb,
  galleryId: string,
  file: UploadFileInput,
) {
  const [gallery] = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      galleryType: galleries.galleryType,
      folderPath: galleries.folderPath,
      isNsfw: galleries.isNsfw,
    })
    .from(galleries)
    .where(eq(galleries.id, galleryId))
    .limit(1);
  if (!gallery) throw new NotFoundError("Gallery not found");
  if (gallery.galleryType !== "folder" || !gallery.folderPath) {
    throw new ValidationError(
      "Uploads are only supported on folder-backed galleries",
    );
  }

  await assertDirExists(gallery.folderPath);
  const { safeName } = validateUploadInput(file, "image");
  const dest = await resolveCollisionSafePath(gallery.folderPath, safeName);
  const { bytesWritten } = await writeUploadBuffer(dest, file.buffer);

  const [created] = await db
    .insert(images)
    .values({
      title: fileNameToTitle(dest),
      filePath: dest,
      fileSize: bytesWritten,
      galleryId: gallery.id,
      organized: false,
      isNsfw: gallery.isNsfw ?? false,
    })
    .returning({ id: images.id, title: images.title, filePath: images.filePath });

  await db
    .update(galleries)
    .set({ imageCount: sql`${galleries.imageCount} + 1`, updatedAt: new Date() })
    .where(eq(galleries.id, gallery.id));

  const target = {
    type: "image" as const,
    id: created.id,
    label: created.title,
  };
  const trigger = {
    by: "manual" as const,
    label: `Queued after upload to ${gallery.title}`,
  };
  await enqueueQueueJob(db, {
    queueName: "image-thumbnail",
    data: { imageId: created.id },
    target,
    trigger,
  });
  await enqueueQueueJob(db, {
    queueName: "image-fingerprint",
    data: { imageId: created.id },
    target,
    trigger,
  });

  return {
    id: created.id,
    title: created.title,
    filePath: created.filePath,
    galleryId: gallery.id,
  };
}

export interface ListImagesQuery {
  search?: string;
  sort?: string;
  order?: string;
  gallery?: string;
  tag?: string | string[];
  performer?: string | string[];
  studio?: string;
  limit?: string;
  offset?: string;
  nsfw?: string;
  ratingMin?: string;
  ratingMax?: string;
  dateFrom?: string;
  dateTo?: string;
  resolution?: string;
  organized?: string;
}

export async function listImagesRead(db: AppDb, query: ListImagesQuery) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 80, 200);
  const conditions: SQL[] = [imageVisibleSql(images.filePath)];
  if (query.nsfw === "off") conditions.push(ne(images.isNsfw, true));
  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(images.title, term),
        ilike(images.details, term),
        ilike(images.filePath, term),
      )!,
    );
  }
  if (query.gallery) conditions.push(eq(images.galleryId, query.gallery));
  if (query.studio) conditions.push(eq(images.studioId, query.studio));

  const tagEntityIds = await resolveTagIds(
    db,
    toArray(query.tag),
    imageTags,
    imageTags.imageId,
    imageTags.tagId,
  );
  if (tagEntityIds === null) return { images: [], total: 0, limit, offset };
  if (tagEntityIds) conditions.push(inArray(images.id, tagEntityIds));

  const perfEntityIds = await resolvePerformerIds(
    db,
    toArray(query.performer),
    imagePerformers,
    imagePerformers.imageId,
    imagePerformers.performerId,
  );
  if (perfEntityIds === null) return { images: [], total: 0, limit, offset };
  if (perfEntityIds) conditions.push(inArray(images.id, perfEntityIds));

  conditions.push(
    ...buildRatingConditions(images.rating, query.ratingMin, query.ratingMax),
  );
  conditions.push(
    ...buildDateConditions(images.date, query.dateFrom, query.dateTo),
  );
  if (query.resolution) {
    const resolutionCond = buildResolutionConditions(images.height, [query.resolution]);
    if (resolutionCond) conditions.push(resolutionCond);
  }
  const orgCond = buildBooleanCondition(images.organized, query.organized);
  if (orgCond) conditions.push(orgCond);

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult, imageRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(images).where(where),
    db
      .select()
      .from(images)
      .where(where)
      .orderBy(buildOrderBy(imageSortConfig, query.sort, query.order))
      .limit(limit)
      .offset(offset),
  ]);

  const imageIds = imageRows.map((img) => img.id);
  const [perfJoins, tagJoins] = await Promise.all([
    imageIds.length > 0
      ? db
          .select({
            imageId: imagePerformers.imageId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(imagePerformers)
          .innerJoin(performers, eq(imagePerformers.performerId, performers.id))
          .where(inArray(imagePerformers.imageId, imageIds))
      : Promise.resolve([]),
    imageIds.length > 0
      ? db
          .select({
            imageId: imageTags.imageId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(imageTags)
          .innerJoin(tags, eq(imageTags.tagId, tags.id))
          .where(inArray(imageTags.imageId, imageIds))
      : Promise.resolve([]),
  ]);

  return {
    images: imageRows.map((img) => ({
      id: img.id,
      title: img.title,
      date: img.date,
      rating: img.rating,
      organized: img.organized,
      isNsfw: img.isNsfw,
      width: img.width,
      height: img.height,
      format: img.format,
      isVideo: isVideoImageFormat(img.format),
      fileSize: img.fileSize,
      thumbnailPath: img.thumbnailPath,
      previewPath: getImagePreviewPath(img.id, img.format),
      fullPath: `/assets/images/${img.id}/full`,
      galleryId: img.galleryId,
      sortOrder: img.sortOrder,
      studioId: img.studioId,
      performers: perfJoins
        .filter((p) => p.imageId === img.id)
        .map((p) => ({ id: p.performerId, name: p.performerName })),
      tags: tagJoins
        .filter((t) => t.imageId === img.id)
        .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
      createdAt: img.createdAt.toISOString(),
    })),
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  };
}

export async function getImageDetailRead(db: AppDb, id: string) {
  const image = await db.query.images.findFirst({
    where: and(eq(images.id, id), imageVisibleSql(images.filePath)),
    with: {
      studio: true,
      imagePerformers: { with: { performer: true } },
      imageTags: { with: { tag: true } },
    },
  });
  if (!image) throw new NotFoundError("Image not found");

  return {
    id: image.id,
    title: image.title,
    details: image.details,
    date: image.date,
    rating: image.rating,
    organized: image.organized,
    isNsfw: image.isNsfw,
    width: image.width,
    height: image.height,
    format: image.format,
    isVideo: isVideoImageFormat(image.format),
    fileSize: image.fileSize,
    thumbnailPath: image.thumbnailPath,
    previewPath: getImagePreviewPath(image.id, image.format),
    fullPath: `/assets/images/${image.id}/full`,
    galleryId: image.galleryId,
    sortOrder: image.sortOrder,
    studioId: image.studioId,
    filePath: image.filePath,
    checksumMd5: image.checksumMd5,
    oshash: image.oshash,
    studio: image.studio
      ? { id: image.studio.id, name: image.studio.name }
      : null,
    performers: image.imagePerformers.map((ip) => ({
      id: ip.performer.id,
      name: ip.performer.name,
    })),
    tags: image.imageTags.map((it) => ({
      id: it.tag.id,
      name: it.tag.name,
      isNsfw: it.tag.isNsfw,
    })),
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };
}

export async function getImagesByIdsRead(db: AppDb, ids: string[]) {
  if (ids.length === 0) return [];

  const imageRows = await db
    .select()
    .from(images)
    .where(and(inArray(images.id, ids), imageVisibleSql(images.filePath)));
  const imageIds = imageRows.map((image) => image.id);
  const [perfJoins, tagJoins] = await Promise.all([
    imageIds.length > 0
      ? db
          .select({
            imageId: imagePerformers.imageId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(imagePerformers)
          .innerJoin(performers, eq(imagePerformers.performerId, performers.id))
          .where(inArray(imagePerformers.imageId, imageIds))
      : Promise.resolve([]),
    imageIds.length > 0
      ? db
          .select({
            imageId: imageTags.imageId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(imageTags)
          .innerJoin(tags, eq(imageTags.tagId, tags.id))
          .where(inArray(imageTags.imageId, imageIds))
      : Promise.resolve([]),
  ]);

  return imageRows.map((image) => ({
    id: image.id,
    title: image.title,
    date: image.date,
    rating: image.rating,
    organized: image.organized,
    isNsfw: image.isNsfw,
    width: image.width,
    height: image.height,
    format: image.format,
    isVideo: isVideoImageFormat(image.format),
    fileSize: image.fileSize,
    thumbnailPath: image.thumbnailPath,
    previewPath: getImagePreviewPath(image.id, image.format),
    fullPath: `/assets/images/${image.id}/full`,
    galleryId: image.galleryId,
    sortOrder: image.sortOrder,
    studioId: image.studioId,
    performers: perfJoins
      .filter((join) => join.imageId === image.id)
      .map((join) => ({ id: join.performerId, name: join.performerName })),
    tags: tagJoins
      .filter((join) => join.imageId === image.id)
      .map((join) => ({ id: join.tagId, name: join.tagName, isNsfw: join.tagIsNsfw })),
    createdAt: image.createdAt.toISOString(),
  }));
}

export async function updateImageWrite(
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
  const existing = await db.query.images.findFirst({
    where: eq(images.id, id),
    columns: { id: true },
  });
  if (!existing) throw new NotFoundError("Image not found");

  await db.transaction(async (tx) => {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) update.title = body.title;
    if (body.details !== undefined) update.details = body.details;
    if (body.date !== undefined) update.date = body.date;
    if (body.rating !== undefined) update.rating = body.rating;
    if (body.organized !== undefined) update.organized = body.organized;
    if (body.isNsfw !== undefined) update.isNsfw = body.isNsfw;
    if (body.studioName !== undefined) {
      update.studioId = await findOrCreateStudioId(tx, body.studioName);
    }
    await tx.update(images).set(update).where(eq(images.id, id));

    if (body.performerNames !== undefined) {
      await tx.delete(imagePerformers).where(eq(imagePerformers.imageId, id));
      for (const name of body.performerNames) {
        if (!name.trim()) continue;
        await tx
          .insert(imagePerformers)
          .values({ imageId: id, performerId: await findOrCreatePerformerId(tx, name) })
          .onConflictDoNothing();
      }
    }

    if (body.tagNames !== undefined) {
      await tx.delete(imageTags).where(eq(imageTags.imageId, id));
      for (const name of body.tagNames) {
        if (!name.trim()) continue;
        await tx
          .insert(imageTags)
          .values({ imageId: id, tagId: await findOrCreateTagId(tx, name) })
          .onConflictDoNothing();
      }
    }
  });

  return { ok: true as const, id };
}

export async function deleteImageWrite(
  db: AppDb,
  id: string,
  deleteFile: boolean,
) {
  const [existing] = await db
    .select({
      id: images.id,
      filePath: images.filePath,
      galleryId: images.galleryId,
    })
    .from(images)
    .where(eq(images.id, id))
    .limit(1);
  if (!existing) throw new NotFoundError("Image not found");

  await db.delete(images).where(eq(images.id, id));
  if (existing.galleryId) {
    await db
      .update(galleries)
      .set({
        imageCount: sql`GREATEST(${galleries.imageCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(galleries.id, existing.galleryId));
  }

  const genDir = getGeneratedImageDir(id);
  try {
    if (existsSync(genDir)) await rm(genDir, { recursive: true });
  } catch {
    /* non-fatal */
  }
  if (deleteFile && existing.filePath && !existing.filePath.includes("::")) {
    try {
      if (existsSync(existing.filePath)) await unlink(existing.filePath);
    } catch {
      /* non-fatal */
    }
  }
  return { ok: true as const };
}

export async function bulkUpdateImagesWrite(
  db: AppDb,
  body: {
    ids: string[];
    patch: {
      rating?: number | null;
      organized?: boolean;
      isNsfw?: boolean;
      tagNames?: string[];
      galleryId?: string | null;
    };
  },
) {
  if (!body.ids?.length) {
    throw new ValidationError("ids array is required");
  }

  await db.transaction(async (tx) => {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.patch.rating !== undefined) update.rating = body.patch.rating;
    if (body.patch.organized !== undefined) update.organized = body.patch.organized;
    if (body.patch.isNsfw !== undefined) update.isNsfw = body.patch.isNsfw;
    if (body.patch.galleryId !== undefined) update.galleryId = body.patch.galleryId;

    if (Object.keys(update).length > 1) {
      await tx.update(images).set(update).where(inArray(images.id, body.ids));
    }

    if (body.patch.tagNames !== undefined) {
      for (const imageId of body.ids) {
        await tx.delete(imageTags).where(eq(imageTags.imageId, imageId));
        for (const name of body.patch.tagNames) {
          if (!name.trim()) continue;
          await tx
            .insert(imageTags)
            .values({
              imageId,
              tagId: await findOrCreateTagId(tx, name),
            })
            .onConflictDoNothing();
        }
      }
    }
  });

  return { ok: true as const, count: body.ids.length };
}

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
  nsfw?: string;
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
  if (query.nsfw === "off") conditions.push(eq(audioLibraries.isNsfw, false));
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
      .orderBy(buildOrderBy(audioLibrarySortConfig, query.sort, query.order))
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

export async function deleteAudioLibraryWrite(db: AppDb, id: string) {
  const result = await db
    .delete(audioLibraries)
    .where(eq(audioLibraries.id, id))
    .returning({ id: audioLibraries.id });
  if (result.length === 0) throw new NotFoundError("Audio library not found");
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
