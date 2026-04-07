import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, ilike, or, desc, asc, sql, inArray, and } from "drizzle-orm";
import { getImagePreviewPath, isVideoImageFormat } from "../lib/image-media";

const {
  images,
  imagePerformers,
  imageTags,
  performers,
  tags,
  studios,
} = schema;

export async function imagesRoutes(app: FastifyInstance) {
  // ─── GET /images ─────────────────────────────────────────────────
  app.get("/images", async (request) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      order?: string;
      gallery?: string;
      tag?: string | string[];
      performer?: string | string[];
      studio?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Number(query.limit) || 80, 200);
    const offset = Number(query.offset) || 0;

    const conditions = [];

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(images.title, term),
          ilike(images.details, term),
          ilike(images.filePath, term)
        )!
      );
    }

    if (query.gallery) {
      conditions.push(eq(images.galleryId, query.gallery));
    }

    if (query.studio) {
      conditions.push(eq(images.studioId, query.studio));
    }

    // Tag filter
    const tagNames = Array.isArray(query.tag) ? query.tag : query.tag ? [query.tag] : [];
    if (tagNames.length > 0) {
      const tagRows = await db
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.name, tagNames));
      const tagIds = tagRows.map((t) => t.id);
      if (tagIds.length > 0) {
        const taggedIds = await db
          .selectDistinct({ imageId: imageTags.imageId })
          .from(imageTags)
          .where(inArray(imageTags.tagId, tagIds));
        const ids = taggedIds.map((r) => r.imageId);
        if (ids.length > 0) {
          conditions.push(inArray(images.id, ids));
        } else {
          return { images: [], total: 0, limit, offset };
        }
      }
    }

    // Performer filter
    const perfNames = Array.isArray(query.performer) ? query.performer : query.performer ? [query.performer] : [];
    if (perfNames.length > 0) {
      const perfRows = await db
        .select({ id: performers.id })
        .from(performers)
        .where(inArray(performers.name, perfNames));
      const perfIds = perfRows.map((p) => p.id);
      if (perfIds.length > 0) {
        const perfImageIds = await db
          .selectDistinct({ imageId: imagePerformers.imageId })
          .from(imagePerformers)
          .where(inArray(imagePerformers.performerId, perfIds));
        const ids = perfImageIds.map((r) => r.imageId);
        if (ids.length > 0) {
          conditions.push(inArray(images.id, ids));
        } else {
          return { images: [], total: 0, limit, offset };
        }
      }
    }

    // Sort
    const sortColumnMap: Record<string, any> = {
      recent: images.createdAt,
      title: images.title,
      date: images.date,
      rating: images.rating,
    };
    const defaultDir: Record<string, "asc" | "desc"> = {
      recent: "desc",
      title: "asc",
      date: "desc",
      rating: "desc",
    };
    const sortKey = query.sort ?? "recent";
    const col = sortColumnMap[sortKey] ?? images.createdAt;
    const dir = query.order === "asc" || query.order === "desc" ? query.order : (defaultDir[sortKey] ?? "desc");
    const orderBy = dir === "asc" ? asc(col) : desc(col);

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
        .map((t) => ({ id: t.tagId, name: t.tagName })),
      createdAt: img.createdAt,
    }));

    return {
      images: result,
      total: Number(countResult.count),
      limit,
      offset,
    };
  });

  // ─── GET /images/:id ─────────────────────────────────────────────
  app.get("/images/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const image = await db.query.images.findFirst({
      where: eq(images.id, id),
      with: {
        studio: true,
        imagePerformers: { with: { performer: true } },
        imageTags: { with: { tag: true } },
      },
    });

    if (!image) {
      reply.code(404);
      return { error: "Image not found" };
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
      })),
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  });

  // ─── PATCH /images/:id ───────────────────────────────────────────
  app.patch("/images/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title?: string;
      details?: string | null;
      date?: string | null;
      rating?: number | null;
      organized?: boolean;
      isNsfw?: boolean;
      studioName?: string | null;
      performerNames?: string[];
      tagNames?: string[];
    };

    const existing = await db.query.images.findFirst({
      where: eq(images.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Image not found" };
    }

    await db.transaction(async (tx) => {
      const update: Record<string, unknown> = { updatedAt: new Date() };

      if (body.title !== undefined) update.title = body.title;
      if (body.details !== undefined) update.details = body.details;
      if (body.date !== undefined) update.date = body.date;
      if (body.rating !== undefined) update.rating = body.rating;
      if (body.organized !== undefined) update.organized = body.organized;
      if (body.isNsfw !== undefined) update.isNsfw = body.isNsfw;

      if (body.studioName !== undefined) {
        if (body.studioName === null || body.studioName === "") {
          update.studioId = null;
        } else {
          const [existingStudio] = await tx
            .select({ id: studios.id })
            .from(studios)
            .where(ilike(studios.name, body.studioName))
            .limit(1);
          update.studioId = existingStudio?.id ?? (
            await tx.insert(studios).values({ name: body.studioName }).returning({ id: studios.id })
          )[0].id;
        }
      }

      await tx.update(images).set(update).where(eq(images.id, id));

      if (body.performerNames !== undefined) {
        await tx.delete(imagePerformers).where(eq(imagePerformers.imageId, id));
        for (const name of body.performerNames) {
          if (!name.trim()) continue;
          const [existingPerf] = await tx
            .select({ id: performers.id })
            .from(performers)
            .where(ilike(performers.name, name.trim()))
            .limit(1);
          const performerId = existingPerf?.id ?? (
            await tx.insert(performers).values({ name: name.trim() }).returning({ id: performers.id })
          )[0].id;
          await tx.insert(imagePerformers).values({ imageId: id, performerId }).onConflictDoNothing();
        }
      }

      if (body.tagNames !== undefined) {
        await tx.delete(imageTags).where(eq(imageTags.imageId, id));
        for (const name of body.tagNames) {
          if (!name.trim()) continue;
          const [existingTag] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(ilike(tags.name, name.trim()))
            .limit(1);
          const tagId = existingTag?.id ?? (
            await tx.insert(tags).values({ name: name.trim() }).returning({ id: tags.id })
          )[0].id;
          await tx.insert(imageTags).values({ imageId: id, tagId }).onConflictDoNothing();
        }
      }
    });

    return { ok: true, id };
  });

  // ─── PATCH /images/bulk ──────────────────────────────────────────
  app.patch("/images/bulk", async (request, reply) => {
    const body = request.body as {
      ids: string[];
      patch: {
        rating?: number | null;
        organized?: boolean;
        isNsfw?: boolean;
        tagNames?: string[];
        galleryId?: string | null;
      };
    };

    if (!body.ids?.length) {
      reply.code(400);
      return { error: "ids array is required" };
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
            const tagId = existingTag?.id ?? (
              await tx.insert(tags).values({ name: name.trim() }).returning({ id: tags.id })
            )[0].id;
            await tx.insert(imageTags).values({ imageId, tagId }).onConflictDoNothing();
          }
        }
      }
    });

    return { ok: true, count: body.ids.length };
  });
}
