import { db, schema } from "../db";
import {
  eq,
  ilike,
  or,
  asc,
  sql,
  inArray,
  and,
  gte,
} from "drizzle-orm";
import { getImagePreviewPath, isVideoImageFormat } from "../lib/image-media";
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
import { buildHierarchyScopeConditions } from "../lib/hierarchy-service/list";

const {
  galleries,
  galleryPerformers,
  galleryTags,
  galleryChapters,
  images,
  performers,
  tags,
  studios,
} = schema;

// ─── Sort config ───────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────

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
    performers: [],
    tags: [],
    createdAt: img.createdAt,
  };
}

// ─── Query types ───────────────────────────────────────────────

interface ListGalleriesQuery {
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
  /** When `off`, exclude galleries marked NSFW (matches scenes/audio list behavior). */
  nsfw?: string;
}

interface UpdateGalleryBody {
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
}

// ─── listGalleries ─────────────────────────────────────────────

export async function listGalleries(query: ListGalleriesQuery) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 50, 200);
  const conditions = [];

  // Hierarchy: root vs parent vs all
  conditions.push(...buildHierarchyScopeConditions(galleries.parentId, query));

  if (query.nsfw === "off") {
    conditions.push(eq(galleries.isNsfw, false));
  }

  // Text search
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

  // Direct column filters
  if (query.type) conditions.push(eq(galleries.galleryType, query.type));
  if (query.studio) conditions.push(eq(galleries.studioId, query.studio));

  // Tag filter
  const tagNames = toArray(query.tag);
  const tagEntityIds = await resolveTagIds(
    tagNames,
    galleryTags,
    galleryTags.galleryId,
    galleryTags.tagId,
  );
  if (tagEntityIds === null) return { galleries: [], total: 0, limit, offset };
  if (tagEntityIds) conditions.push(inArray(galleries.id, tagEntityIds));

  // Performer filter
  const perfNames = toArray(query.performer);
  const perfEntityIds = await resolvePerformerIds(
    perfNames,
    galleryPerformers,
    galleryPerformers.galleryId,
    galleryPerformers.performerId,
  );
  if (perfEntityIds === null) return { galleries: [], total: 0, limit, offset };
  if (perfEntityIds) conditions.push(inArray(galleries.id, perfEntityIds));

  // Rating
  conditions.push(
    ...buildRatingConditions(galleries.rating, query.ratingMin, query.ratingMax),
  );

  // Date range
  conditions.push(
    ...buildDateConditions(galleries.date, query.dateFrom, query.dateTo),
  );

  // Image count minimum
  const imgCountMin =
    query.imageCountMin !== undefined ? Number(query.imageCountMin) : NaN;
  if (Number.isInteger(imgCountMin) && imgCountMin >= 1) {
    conditions.push(gte(galleries.imageCount, imgCountMin));
  }

  // Organized
  const orgCond = buildBooleanCondition(galleries.organized, query.organized);
  if (orgCond) conditions.push(orgCond);

  // Sort
  const orderBy = buildOrderBy(gallerySortConfig, query.sort, query.order);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(galleries)
    .where(where);

  const galleryRows = await db
    .select()
    .from(galleries)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const galleryIds = galleryRows.map((g) => g.id);

  // Batch fetch performers and tags
  const perfJoins =
    galleryIds.length > 0
      ? await db
          .select({
            galleryId: galleryPerformers.galleryId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(galleryPerformers)
          .innerJoin(performers, eq(galleryPerformers.performerId, performers.id))
          .where(inArray(galleryPerformers.galleryId, galleryIds))
      : [];

  const tagJoins =
    galleryIds.length > 0
      ? await db
          .select({
            galleryId: galleryTags.galleryId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(galleryTags)
          .innerJoin(tags, eq(galleryTags.tagId, tags.id))
          .where(inArray(galleryTags.galleryId, galleryIds))
      : [];

  // Fetch preview images (first 4 per gallery)
  const previewImages =
    galleryIds.length > 0
      ? await db
          .select({
            galleryId: images.galleryId,
            imageId: images.id,
            sortOrder: images.sortOrder,
          })
          .from(images)
          .where(inArray(images.galleryId, galleryIds))
          .orderBy(asc(images.sortOrder))
      : [];

  // Fetch studio names
  const studioIds = [
    ...new Set(
      galleryRows.filter((g) => g.studioId).map((g) => g.studioId!),
    ),
  ];
  const studioRows =
    studioIds.length > 0
      ? await db
          .select({ id: studios.id, name: studios.name })
          .from(studios)
          .where(inArray(studios.id, studioIds))
      : [];
  const studioMap = new Map(studioRows.map((s) => [s.id, s.name]));

  const result = galleryRows.map((gallery) => {
    const galleryPreviewImages = previewImages
      .filter((img) => img.galleryId === gallery.id)
      .slice(0, 4)
      .map((img) => `/assets/images/${img.imageId}/thumb`);

    return {
      id: gallery.id,
      title: gallery.title,
      galleryType: gallery.galleryType as "folder" | "zip" | "virtual",
      coverImagePath: `/assets/galleries/${gallery.id}/cover`,
      previewImagePaths: galleryPreviewImages,
      imageCount: gallery.imageCount,
      rating: gallery.rating,
      organized: gallery.organized,
      isNsfw: gallery.isNsfw,
      date: gallery.date,
      studioId: gallery.studioId,
      studioName: gallery.studioId
        ? studioMap.get(gallery.studioId) ?? null
        : null,
      performers: perfJoins
        .filter((p) => p.galleryId === gallery.id)
        .map((p) => ({ id: p.performerId, name: p.performerName })),
      tags: tagJoins
        .filter((t) => t.galleryId === gallery.id)
        .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
      parentId: gallery.parentId,
      createdAt: gallery.createdAt,
    };
  });

  return {
    galleries: result,
    total: Number(countResult.count),
    limit,
    offset,
  };
}

// ─── getGalleriesByIds ─────────────────────────────────────────

/**
 * Fetch multiple galleries by IDs, returning list-item projections.
 * Used by the collections service for polymorphic entity loading.
 */
export async function getGalleriesByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const galleryRows = await db
    .select()
    .from(galleries)
    .where(inArray(galleries.id, ids));

  const galleryIds = galleryRows.map((g) => g.id);

  const [perfJoins, tagJoins, studioRows] = await Promise.all([
    galleryIds.length > 0
      ? db
          .select({
            galleryId: galleryPerformers.galleryId,
            performerId: performers.id,
            performerName: performers.name,
          })
          .from(galleryPerformers)
          .innerJoin(
            performers,
            eq(galleryPerformers.performerId, performers.id),
          )
          .where(inArray(galleryPerformers.galleryId, galleryIds))
      : [],
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
      : [],
    (() => {
      const studioIds = [
        ...new Set(
          galleryRows.filter((g) => g.studioId).map((g) => g.studioId!),
        ),
      ];
      return studioIds.length > 0
        ? db
            .select({ id: studios.id, name: studios.name })
            .from(studios)
            .where(inArray(studios.id, studioIds))
        : Promise.resolve([]);
    })(),
  ]);

  const studioMap = new Map(studioRows.map((s) => [s.id, s.name]));

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
    studioId: gallery.studioId,
    studioName: gallery.studioId
      ? studioMap.get(gallery.studioId) ?? null
      : null,
    performers: perfJoins
      .filter((p) => p.galleryId === gallery.id)
      .map((p) => ({ id: p.performerId, name: p.performerName })),
    tags: tagJoins
      .filter((t) => t.galleryId === gallery.id)
      .map((t) => ({ id: t.tagId, name: t.tagName, isNsfw: t.tagIsNsfw })),
    parentId: gallery.parentId,
    createdAt: gallery.createdAt,
  }));
}

// ─── getGalleryById ────────────────────────────────────────────

export async function getGalleryById(
  id: string,
  imageLimit?: string,
  imageOffset?: string,
) {
  const imgLimit = Math.min(Number(imageLimit) || 60, 200);
  const imgOffset = Number(imageOffset) || 0;

  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.id, id),
    with: {
      studio: true,
      galleryPerformers: { with: { performer: true } },
      galleryTags: { with: { tag: true } },
      chapters: { orderBy: asc(galleryChapters.imageIndex) },
    },
  });

  if (!gallery) {
    throw new AppError(404, "Gallery not found");
  }

  // Paginated images
  const [imageCountResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(images)
    .where(eq(images.galleryId, id));

  const imageRows = await db
    .select()
    .from(images)
    .where(eq(images.galleryId, id))
    .orderBy(asc(images.sortOrder))
    .limit(imgLimit)
    .offset(imgOffset);

  // Children galleries
  const children = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      imageCount: galleries.imageCount,
      isNsfw: galleries.isNsfw,
    })
    .from(galleries)
    .where(eq(galleries.parentId, id))
    .orderBy(asc(galleries.title));

  // Fetch preview images for children
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
          .where(inArray(images.galleryId, childIds))
          .orderBy(asc(images.sortOrder))
      : [];
  const childPreviewMap = new Map<string, string[]>();
  for (const img of childPreviewImages) {
    if (!img.galleryId) continue;
    const arr = childPreviewMap.get(img.galleryId) ?? [];
    if (arr.length < 4) arr.push(`/assets/images/${img.imageId}/thumb`);
    childPreviewMap.set(img.galleryId, arr);
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
    imageTotal: Number(imageCountResult.count),
    imageLimit: imgLimit,
    imageOffset: imgOffset,
    children: children.map((ch) => ({
      id: ch.id,
      title: ch.title,
      imageCount: ch.imageCount,
      coverImagePath: `/assets/galleries/${ch.id}/cover`,
      previewImagePaths: childPreviewMap.get(ch.id) ?? [],
      isNsfw: ch.isNsfw,
    })),
    createdAt: gallery.createdAt,
    updatedAt: gallery.updatedAt,
  };
}

// ─── updateGallery ─────────────────────────────────────────────

export async function updateGallery(id: string, body: UpdateGalleryBody) {
  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, id),
    columns: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Gallery not found");
  }

  let affectedGalleryIds: string[] | undefined;
  let shouldPropagateNsfw = false;

  if (body.isNsfw !== undefined) {
    const [current] = await db
      .select({ isNsfw: galleries.isNsfw })
      .from(galleries)
      .where(eq(galleries.id, id))
      .limit(1);
    shouldPropagateNsfw = current?.isNsfw !== body.isNsfw;
  }

  await db.transaction(async (tx) => {
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (body.title !== undefined) update.title = body.title;
    if (body.details !== undefined) update.details = body.details;
    if (body.date !== undefined) update.date = body.date;
    if (body.rating !== undefined) update.rating = body.rating;
    if (body.organized !== undefined) update.organized = body.organized;
    if (body.isNsfw !== undefined) update.isNsfw = body.isNsfw;
    if (body.photographer !== undefined) update.photographer = body.photographer;

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

    await tx.update(galleries).set(update).where(eq(galleries.id, id));

    // Propagate NSFW to descendants and their images
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
      const descendantIds = descendantRows.map((r) => r.id);
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

    // Performers: replace all
    if (body.performerNames !== undefined) {
      await tx
        .delete(galleryPerformers)
        .where(eq(galleryPerformers.galleryId, id));

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
          .insert(galleryPerformers)
          .values({ galleryId: id, performerId })
          .onConflictDoNothing();
      }
    }

    // Tags: replace all
    if (body.tagNames !== undefined) {
      await tx.delete(galleryTags).where(eq(galleryTags.galleryId, id));

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
          .insert(galleryTags)
          .values({ galleryId: id, tagId })
          .onConflictDoNothing();
      }
    }
  });

  return {
    ok: true,
    id,
    ...(affectedGalleryIds ? { affectedGalleryIds } : {}),
  };
}

// ─── getGalleryStats ───────────────────────────────────────────

export async function getGalleryStats(_sfwOnly?: boolean) {
  const [galleryStats] = await db
    .select({ totalGalleries: sql<number>`count(*)` })
    .from(galleries);

  const [imageStats] = await db
    .select({ totalImages: sql<number>`count(*)` })
    .from(images);

  const [recentStats] = await db
    .select({ recentCount: sql<number>`count(*)` })
    .from(galleries)
    .where(sql`${galleries.createdAt} > now() - interval '7 days'`);

  return {
    totalGalleries: Number(galleryStats.totalGalleries),
    totalImages: Number(imageStats.totalImages),
    recentCount: Number(recentStats.recentCount),
  };
}

// ─── setCoverImage ─────────────────────────────────────────────

export async function setCoverImage(galleryId: string, imageId: string) {
  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
    columns: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Gallery not found");
  }

  await db
    .update(galleries)
    .set({ coverImageId: imageId, updatedAt: new Date() })
    .where(eq(galleries.id, galleryId));

  return { ok: true };
}

// ─── Chapter CRUD ──────────────────────────────────────────────

export async function createChapter(
  galleryId: string,
  body: { title: string; imageIndex: number },
) {
  if (!body.title?.trim() || body.imageIndex == null) {
    throw new AppError(400, "title and imageIndex are required", "INVALID_CHAPTER");
  }

  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
    columns: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Gallery not found");
  }

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

export async function updateChapter(
  chapterId: string,
  body: { title?: string; imageIndex?: number },
) {
  const existing = await db.query.galleryChapters.findFirst({
    where: eq(galleryChapters.id, chapterId),
  });

  if (!existing) {
    throw new AppError(404, "Chapter not found");
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.imageIndex !== undefined) update.imageIndex = body.imageIndex;

  await db
    .update(galleryChapters)
    .set(update)
    .where(eq(galleryChapters.id, chapterId));

  return { ok: true };
}

export async function deleteChapter(chapterId: string) {
  const existing = await db.query.galleryChapters.findFirst({
    where: eq(galleryChapters.id, chapterId),
  });

  if (!existing) {
    throw new AppError(404, "Chapter not found");
  }

  await db.delete(galleryChapters).where(eq(galleryChapters.id, chapterId));
  return { ok: true };
}

// ─── createGallery ────────────────────────────────────────────

export async function createGallery(body: {
  title: string;
  details?: string | null;
  date?: string | null;
}) {
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

  return { ok: true, id: created.id };
}

// ─── deleteGallery ────────────────────────────────────────────

export async function deleteGallery(id: string) {
  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, id),
    columns: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Gallery not found");
  }

  await db.delete(galleries).where(eq(galleries.id, id));
  return { ok: true };
}

// ─── deleteCoverImage ─────────────────────────────────────────

export async function deleteCoverImage(galleryId: string) {
  const existing = await db.query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
    columns: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Gallery not found");
  }

  await db
    .update(galleries)
    .set({ coverImageId: null, updatedAt: new Date() })
    .where(eq(galleries.id, galleryId));

  return { ok: true };
}

// ─── getGalleryImages ─────────────────────────────────────────

export async function getGalleryImages(
  galleryId: string,
  limitStr?: string,
  offsetStr?: string,
) {
  const limit = Math.min(Number(limitStr) || 60, 200);
  const offset = Number(offsetStr) || 0;

  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
    columns: { id: true },
  });

  if (!gallery) {
    throw new AppError(404, "Gallery not found");
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(images)
    .where(eq(images.galleryId, galleryId));

  const imageRows = await db
    .select()
    .from(images)
    .where(eq(images.galleryId, galleryId))
    .orderBy(asc(images.sortOrder))
    .limit(limit)
    .offset(offset);

  return {
    images: imageRows.map(toGalleryImageListItem),
    total: Number(countResult.count),
    limit,
    offset,
  };
}
