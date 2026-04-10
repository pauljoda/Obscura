import { existsSync } from "node:fs";
import { unlink, rm } from "node:fs/promises";
import path from "node:path";
import { db, schema } from "../db";
import {
  eq,
  ilike,
  or,
  ne,
  sql,
  inArray,
  and,
} from "drizzle-orm";
import type { MultipartFile } from "@fastify/multipart";
import type { UploadImageResponseDto } from "@obscura/contracts";
import { fileNameToTitle, getGeneratedImageDir } from "@obscura/media-core";
import { getImagePreviewPath, isVideoImageFormat } from "../lib/image-media";
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
  buildResolutionConditions,
  parsePagination,
  type SortConfig,
} from "../lib/query-helpers";

const {
  images,
  imagePerformers,
  imageTags,
  galleries,
  performers,
  tags,
  studios,
} = schema;

// ─── Sort config ───────────────────────────────────────────────

const imageSortConfig: SortConfig = {
  columns: {
    recent: images.createdAt,
    title: images.title,
    date: images.date,
    rating: images.rating,
  },
  defaultDirs: {
    recent: "desc",
    title: "asc",
    date: "desc",
    rating: "desc",
  },
  fallbackColumn: images.createdAt,
};

// ─── Query types ───────────────────────────────────────────────

interface ListImagesQuery {
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

interface UpdateImageBody {
  title?: string;
  details?: string | null;
  date?: string | null;
  rating?: number | null;
  organized?: boolean;
  isNsfw?: boolean;
  studioName?: string | null;
  performerNames?: string[];
  tagNames?: string[];
}

interface BulkUpdateImagesBody {
  ids: string[];
  patch: {
    rating?: number | null;
    organized?: boolean;
    isNsfw?: boolean;
    tagNames?: string[];
    galleryId?: string | null;
  };
}

// ─── listImages ────────────────────────────────────────────────

export async function listImages(query: ListImagesQuery) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 80, 200);
  const conditions = [];

  // SFW filter
  if (query.nsfw === "off") {
    conditions.push(ne(images.isNsfw, true));
  }

  // Text search
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

  // Direct column filters
  if (query.gallery) conditions.push(eq(images.galleryId, query.gallery));
  if (query.studio) conditions.push(eq(images.studioId, query.studio));

  // Tag filter
  const tagNames = toArray(query.tag);
  const tagEntityIds = await resolveTagIds(
    tagNames,
    imageTags,
    imageTags.imageId,
    imageTags.tagId,
  );
  if (tagEntityIds === null) return { images: [], total: 0, limit, offset };
  if (tagEntityIds) conditions.push(inArray(images.id, tagEntityIds));

  // Performer filter
  const perfNames = toArray(query.performer);
  const perfEntityIds = await resolvePerformerIds(
    perfNames,
    imagePerformers,
    imagePerformers.imageId,
    imagePerformers.performerId,
  );
  if (perfEntityIds === null) return { images: [], total: 0, limit, offset };
  if (perfEntityIds) conditions.push(inArray(images.id, perfEntityIds));

  // Rating
  conditions.push(
    ...buildRatingConditions(images.rating, query.ratingMin, query.ratingMax),
  );

  // Date range
  conditions.push(
    ...buildDateConditions(images.date, query.dateFrom, query.dateTo),
  );

  // Resolution
  if (query.resolution) {
    const resCond = buildResolutionConditions(images.height, [query.resolution]);
    if (resCond) conditions.push(resCond);
  }

  // Organized
  const orgCond = buildBooleanCondition(images.organized, query.organized);
  if (orgCond) conditions.push(orgCond);

  // Sort
  const orderBy = buildOrderBy(imageSortConfig, query.sort, query.order);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(images)
    .where(where);

  const imageRows = await db
    .select()
    .from(images)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const imageIds = imageRows.map((img) => img.id);

  // Batch fetch performers and tags
  const perfJoins =
    imageIds.length > 0
      ? await db
          .select({
            imageId: imagePerformers.imageId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(imagePerformers)
          .innerJoin(performers, eq(imagePerformers.performerId, performers.id))
          .where(inArray(imagePerformers.imageId, imageIds))
      : [];

  const tagJoins =
    imageIds.length > 0
      ? await db
          .select({
            imageId: imageTags.imageId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(imageTags)
          .innerJoin(tags, eq(imageTags.tagId, tags.id))
          .where(inArray(imageTags.imageId, imageIds))
      : [];

  const result = imageRows.map((img) => ({
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
    createdAt: img.createdAt,
  }));

  return {
    images: result,
    total: Number(countResult.count),
    limit,
    offset,
  };
}

// ─── getImageById ──────────────────────────────────────────────

export async function getImageById(id: string) {
  const image = await db.query.images.findFirst({
    where: eq(images.id, id),
    with: {
      studio: true,
      imagePerformers: { with: { performer: true } },
      imageTags: { with: { tag: true } },
    },
  });

  if (!image) {
    throw new AppError(404, "Image not found");
  }

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
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
  };
}

// ─── updateImage ───────────────────────────────────────────────

export async function updateImage(id: string, body: UpdateImageBody) {
  const existing = await db.query.images.findFirst({
    where: eq(images.id, id),
    columns: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Image not found");
  }

  await db.transaction(async (tx) => {
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (body.title !== undefined) update.title = body.title;
    if (body.details !== undefined) update.details = body.details;
    if (body.date !== undefined) update.date = body.date;
    if (body.rating !== undefined) update.rating = body.rating;
    if (body.organized !== undefined) update.organized = body.organized;
    if (body.isNsfw !== undefined) update.isNsfw = body.isNsfw;

    // Studio: find or create by name
    if (body.studioName !== undefined) {
      if (body.studioName === null || body.studioName === "") {
        update.studioId = null;
      } else {
        const [existingStudio] = await tx
          .select({ id: studios.id })
          .from(studios)
          .where(ilike(studios.name, body.studioName))
          .limit(1);
        update.studioId =
          existingStudio?.id ??
          (
            await tx
              .insert(studios)
              .values({ name: body.studioName })
              .returning({ id: studios.id })
          )[0].id;
      }
    }

    await tx.update(images).set(update).where(eq(images.id, id));

    // Performers: replace all
    if (body.performerNames !== undefined) {
      await tx.delete(imagePerformers).where(eq(imagePerformers.imageId, id));
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
          .insert(imagePerformers)
          .values({ imageId: id, performerId })
          .onConflictDoNothing();
      }
    }

    // Tags: replace all
    if (body.tagNames !== undefined) {
      await tx.delete(imageTags).where(eq(imageTags.imageId, id));
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
          .insert(imageTags)
          .values({ imageId: id, tagId })
          .onConflictDoNothing();
      }
    }
  });

  return { ok: true, id };
}

// ─── bulkUpdateImages ──────────────────────────────────────────

export async function bulkUpdateImages(body: BulkUpdateImagesBody) {
  if (!body.ids?.length) {
    throw new AppError(400, "ids array is required", "MISSING_IDS");
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
            .insert(imageTags)
            .values({ imageId, tagId })
            .onConflictDoNothing();
        }
      }
    }
  });

  return { ok: true, count: body.ids.length };
}

// ─── uploadImage ───────────────────────────────────────────────

/**
 * Upload an image file into a folder-backed gallery and create the
 * matching `images` row. Rejects galleries that are not folder-backed
 * (zip / virtual galleries have no on-disk folder to write into).
 */
export async function uploadImage(
  galleryId: string,
  file: MultipartFile,
): Promise<UploadImageResponseDto> {
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
  if (!gallery) {
    throw new AppError(404, "Gallery not found");
  }
  if (gallery.galleryType !== "folder" || !gallery.folderPath) {
    throw new AppError(
      400,
      "Uploads are only supported on folder-backed galleries",
    );
  }
  await assertDirExists(gallery.folderPath);

  const { safeName } = validateUpload(file, { category: "image" });
  const dest = await resolveCollisionSafePath(gallery.folderPath, safeName);
  const { bytesWritten } = await streamToFile(file, dest);

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

  if (!created) {
    throw new AppError(500, "Failed to create image row after upload");
  }

  // Bump the denormalized imageCount on the parent gallery so the list
  // view reflects the new image without waiting for a rescan.
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
  await enqueueQueueJob({
    queueName: "image-thumbnail",
    jobName: "image-thumbnail",
    data: { imageId: created.id },
    target,
    trigger,
  });
  await enqueueQueueJob({
    queueName: "image-fingerprint",
    jobName: "image-fingerprint",
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

// ─── deleteImage ───────────────────────────────────────────────

/**
 * Delete a single image. Mirrors deleteScene: DB row first (cascades
 * handle imagePerformers/imageTags), then the generated thumb dir, then
 * optionally the source file on disk.
 */
export async function deleteImage(id: string, deleteFile: boolean) {
  const [existing] = await db
    .select({
      id: images.id,
      filePath: images.filePath,
      galleryId: images.galleryId,
    })
    .from(images)
    .where(eq(images.id, id))
    .limit(1);
  if (!existing) {
    throw new AppError(404, "Image not found");
  }

  await db.delete(images).where(eq(images.id, id));

  // Bump parent gallery count down (gallery FK is onDelete: "set null",
  // so the image no longer points at it — decrement directly).
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
    // non-fatal
  }

  // Only unlink the source if the caller asked for it AND the path looks
  // like a real file (not a zip member "archive.zip::member.jpg").
  if (
    deleteFile &&
    existing.filePath &&
    !existing.filePath.includes("::")
  ) {
    try {
      if (existsSync(existing.filePath)) await unlink(existing.filePath);
    } catch {
      // non-fatal
    }
  }

  return { ok: true as const };
}
