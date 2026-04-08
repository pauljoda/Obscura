import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, ilike, or, desc, asc, sql, and } from "drizzle-orm";
import { existsSync } from "node:fs";
import { writeFile, mkdir, unlink, rm } from "node:fs/promises";
import path from "node:path";
import { getGeneratedPerformerDir } from "@obscura/media-core";

const { performers, performerTags, scenePerformers, tags } = schema;

export async function performersRoutes(app: FastifyInstance) {
  // ─── GET /performers ────────────────────────────────────────────
  app.get("/performers", async (request) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      order?: string;
      gender?: string;
      favorite?: string;
      country?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = Number(query.offset) || 0;

    // Build WHERE conditions
    const conditions = [];

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        or(
          ilike(performers.name, term),
          ilike(performers.aliases, term),
          ilike(performers.disambiguation, term)
        )!
      );
    }

    if (query.gender) {
      conditions.push(ilike(performers.gender, query.gender));
    }

    if (query.favorite === "true") {
      conditions.push(eq(performers.favorite, true));
    }

    if (query.country) {
      conditions.push(ilike(performers.country, query.country));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Sorting
    const sortDir = query.order === "asc" ? asc : desc;
    const sortAsc = query.order === "asc" ? asc : null;
    let orderBy;
    switch (query.sort) {
      case "name":
        orderBy = (sortAsc ?? asc)(performers.name);
        break;
      case "scenes":
        orderBy = sortDir(performers.sceneCount);
        break;
      case "rating":
        orderBy = sortDir(performers.rating);
        break;
      case "recent":
      default:
        orderBy = sortDir(performers.createdAt);
        break;
    }

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: performers.id,
          name: performers.name,
          disambiguation: performers.disambiguation,
          gender: performers.gender,
          imagePath: performers.imagePath,
          favorite: performers.favorite,
          rating: performers.rating,
          isNsfw: performers.isNsfw,
          sceneCount: performers.sceneCount,
          country: performers.country,
          createdAt: performers.createdAt,
        })
        .from(performers)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(performers)
        .where(where),
    ]);

    return {
      performers: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    };
  });

  // ─── GET /performers/:id ────────────────────────────────────────
  app.get("/performers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await db.query.performers.findFirst({
      where: eq(performers.id, id),
      with: {
        performerTags: {
          with: { tag: true },
        },
      },
    });

    if (!row) {
      reply.code(404);
      return { error: "Actor not found" };
    }

    return {
      id: row.id,
      name: row.name,
      disambiguation: row.disambiguation,
      aliases: row.aliases,
      gender: row.gender,
      birthdate: row.birthdate,
      country: row.country,
      ethnicity: row.ethnicity,
      eyeColor: row.eyeColor,
      hairColor: row.hairColor,
      height: row.height,
      weight: row.weight,
      measurements: row.measurements,
      tattoos: row.tattoos,
      piercings: row.piercings,
      careerStart: row.careerStart,
      careerEnd: row.careerEnd,
      details: row.details,
      imageUrl: row.imageUrl,
      imagePath: row.imagePath,
      favorite: row.favorite,
      rating: row.rating,
      isNsfw: row.isNsfw,
      sceneCount: row.sceneCount,
      tags: row.performerTags.map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        isNsfw: pt.tag.isNsfw,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  // ─── POST /performers ──────────────────────────────────────────
  app.post("/performers", async (request, reply) => {
    const body = request.body as {
      name: string;
      disambiguation?: string | null;
      aliases?: string | null;
      gender?: string | null;
      birthdate?: string | null;
      country?: string | null;
      ethnicity?: string | null;
      eyeColor?: string | null;
      hairColor?: string | null;
      height?: number | null;
      weight?: number | null;
      measurements?: string | null;
      tattoos?: string | null;
      piercings?: string | null;
      careerStart?: number | null;
      careerEnd?: number | null;
      details?: string | null;
      imageUrl?: string | null;
      favorite?: boolean;
      rating?: number | null;
      tagNames?: string[];
    };

    if (!body.name?.trim()) {
      reply.code(400);
      return { error: "Name is required" };
    }

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(performers)
        .values({
          name: body.name.trim(),
          disambiguation: body.disambiguation ?? null,
          aliases: body.aliases ?? null,
          gender: body.gender ?? null,
          birthdate: body.birthdate ?? null,
          country: body.country ?? null,
          ethnicity: body.ethnicity ?? null,
          eyeColor: body.eyeColor ?? null,
          hairColor: body.hairColor ?? null,
          height: body.height ?? null,
          weight: body.weight ?? null,
          measurements: body.measurements ?? null,
          tattoos: body.tattoos ?? null,
          piercings: body.piercings ?? null,
          careerStart: body.careerStart ?? null,
          careerEnd: body.careerEnd ?? null,
          details: body.details ?? null,
          imageUrl: body.imageUrl ?? null,
          favorite: body.favorite ?? false,
          rating: body.rating ?? null,
        })
        .returning();

      // Handle tags
      if (body.tagNames?.length) {
        for (const tagName of body.tagNames) {
          const trimmed = tagName.trim();
          if (!trimmed) continue;
          let tag = await tx.query.tags.findFirst({
            where: ilike(tags.name, trimmed),
          });
          if (!tag) {
            [tag] = await tx.insert(tags).values({ name: trimmed }).returning();
          }
          await tx.insert(performerTags).values({
            performerId: created.id,
            tagId: tag.id,
          });
        }
      }

      return created;
    });

    reply.code(201);
    return { ok: true, id: result.id };
  });

  // ─── PATCH /performers/:id ─────────────────────────────────────
  app.patch("/performers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      disambiguation?: string | null;
      aliases?: string | null;
      gender?: string | null;
      birthdate?: string | null;
      country?: string | null;
      ethnicity?: string | null;
      eyeColor?: string | null;
      hairColor?: string | null;
      height?: number | null;
      weight?: number | null;
      measurements?: string | null;
      tattoos?: string | null;
      piercings?: string | null;
      careerStart?: number | null;
      careerEnd?: number | null;
      details?: string | null;
      imageUrl?: string | null;
      favorite?: boolean;
      rating?: number | null;
      isNsfw?: boolean;
      tagNames?: string[];
    };

    const existing = await db.query.performers.findFirst({
      where: eq(performers.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Actor not found" };
    }

    await db.transaction(async (tx) => {
      // Build update set from provided fields
      const updates: Record<string, any> = { updatedAt: new Date() };
      const fields = [
        "name", "disambiguation", "aliases", "gender", "birthdate",
        "country", "ethnicity", "eyeColor", "hairColor", "height",
        "weight", "measurements", "tattoos", "piercings", "careerStart",
        "careerEnd", "details", "imageUrl", "favorite", "rating", "isNsfw",
      ] as const;

      for (const field of fields) {
        if (field in body) {
          updates[field] = (body as any)[field];
        }
      }

      await tx.update(performers).set(updates).where(eq(performers.id, id));

      // Handle tags if provided
      if (body.tagNames !== undefined) {
        // Clear existing tags
        await tx.delete(performerTags).where(eq(performerTags.performerId, id));

        if (body.tagNames.length > 0) {
          for (const tagName of body.tagNames) {
            const trimmed = tagName.trim();
            if (!trimmed) continue;
            let tag = await tx.query.tags.findFirst({
              where: ilike(tags.name, trimmed),
            });
            if (!tag) {
              [tag] = await tx.insert(tags).values({ name: trimmed }).returning();
            }
            await tx.insert(performerTags).values({
              performerId: id,
              tagId: tag.id,
            });
          }
        }
      }
    });

    return { ok: true, id };
  });

  // ─── DELETE /performers/:id ────────────────────────────────────
  app.delete("/performers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.query.performers.findFirst({
      where: eq(performers.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Actor not found" };
    }

    // Delete performer (cascades handle join tables)
    await db.delete(performers).where(eq(performers.id, id));

    // Clean up image files
    const genDir = getGeneratedPerformerDir(id);
    try {
      if (existsSync(genDir)) await rm(genDir, { recursive: true });
    } catch {
      // non-fatal
    }

    // Update scene counts for scenes that had this performer
    // (cascade already deleted scenePerformers rows, but counts are denormalized)

    return { ok: true };
  });

  // ─── PATCH /performers/:id/favorite ────────────────────────────
  app.patch("/performers/:id/favorite", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { favorite } = request.body as { favorite: boolean };

    const existing = await db.query.performers.findFirst({
      where: eq(performers.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Actor not found" };
    }

    await db
      .update(performers)
      .set({ favorite, updatedAt: new Date() })
      .where(eq(performers.id, id));

    return { ok: true, favorite };
  });

  // ─── PATCH /performers/:id/rating ──────────────────────────────
  app.patch("/performers/:id/rating", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rating } = request.body as { rating: number | null };

    const existing = await db.query.performers.findFirst({
      where: eq(performers.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Actor not found" };
    }

    await db
      .update(performers)
      .set({ rating, updatedAt: new Date() })
      .where(eq(performers.id, id));

    return { ok: true, rating };
  });

  // ─── POST /performers/:id/image (multipart upload) ─────────────
  app.post("/performers/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.query.performers.findFirst({
      where: eq(performers.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Actor not found" };
    }

    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }

    const buffer = await file.toBuffer();
    const genDir = getGeneratedPerformerDir(id);
    await mkdir(genDir, { recursive: true });
    const imageDiskPath = path.join(genDir, "image.jpg");
    await writeFile(imageDiskPath, buffer);

    const assetUrl = `/assets/performers/${id}/image`;
    await db
      .update(performers)
      .set({ imagePath: assetUrl, updatedAt: new Date() })
      .where(eq(performers.id, id));

    return { ok: true, imagePath: assetUrl };
  });

  // ─── POST /performers/:id/image/from-url ───────────────────────
  app.post("/performers/:id/image/from-url", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { imageUrl } = request.body as { imageUrl: string };

    if (!imageUrl || (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image/"))) {
      reply.code(400);
      return { error: "Invalid image URL" };
    }

    const existing = await db.query.performers.findFirst({
      where: eq(performers.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Actor not found" };
    }

    try {
      let buffer: Buffer;

      if (imageUrl.startsWith("data:image/")) {
        // Handle base64 data URL
        const base64Data = imageUrl.split(",")[1];
        if (!base64Data) {
          reply.code(400);
          return { error: "Invalid data URL" };
        }
        buffer = Buffer.from(base64Data, "base64");
      } else {
        const res = await fetch(imageUrl);
        if (!res.ok) {
          reply.code(502);
          return { error: `Failed to fetch image: ${res.status}` };
        }
        buffer = Buffer.from(await res.arrayBuffer());
      }

      const genDir = getGeneratedPerformerDir(id);
      await mkdir(genDir, { recursive: true });
      const imageDiskPath = path.join(genDir, "image.jpg");
      await writeFile(imageDiskPath, buffer);

      const assetUrl = `/assets/performers/${id}/image`;
      await db
        .update(performers)
        .set({ imagePath: assetUrl, imageUrl, updatedAt: new Date() })
        .where(eq(performers.id, id));

      return { ok: true, imagePath: assetUrl };
    } catch (err) {
      reply.code(502);
      return { error: "Failed to download image" };
    }
  });

  // ─── DELETE /performers/:id/image ──────────────────────────────
  app.delete("/performers/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.query.performers.findFirst({
      where: eq(performers.id, id),
      columns: { id: true },
    });

    if (!existing) {
      reply.code(404);
      return { error: "Actor not found" };
    }

    const imageDiskPath = path.join(getGeneratedPerformerDir(id), "image.jpg");
    try {
      if (existsSync(imageDiskPath)) await unlink(imageDiskPath);
    } catch {
      // non-fatal
    }

    await db
      .update(performers)
      .set({ imagePath: null, updatedAt: new Date() })
      .where(eq(performers.id, id));

    return { ok: true };
  });
}
