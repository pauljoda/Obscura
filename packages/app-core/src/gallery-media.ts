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
  getGeneratedGalleryDir,
  getGeneratedImageDir,
} from "@obscura/media-core";
import { NotFoundError, ValidationError } from "./errors";
import { buildHierarchyScopeConditions } from "./hierarchy";
import { getImagePreviewPath, isVideoImageFormat } from "./image-media";
import {
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
import {
  findOrCreatePerformerId,
  findOrCreateStudioId,
  findOrCreateTagId,
} from "./media-shared";

const {
  galleries,
  galleryPerformers,
  galleryTags,
  galleryChapters,
  images,
  imagePerformers,
  imageTags,
  performers,
  tags,
  studios,
} = schema;

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
