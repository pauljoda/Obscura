/**
 * Studio business logic extracted from route handlers.
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
  asc,
  sql,
  inArray,
  and,
  ne,
  isNotNull,
} from "drizzle-orm";
import { getGeneratedStudioDir } from "@obscura/media-core";
import { db, schema } from "../db";
import { AppError } from "../plugins/error-handler";
import {
  studioAudioLibraryCountExpr,
  studioImageAppearanceCountExpr,
  studioSfwSceneCountExpr,
  studioTotalSceneCountExpr,
} from "../lib/appearance-count-expressions";

const {
  studios,
  galleries,
  images,
  audioLibraries,
  audioTracks,
  videoSeries,
  videoMovies,
} = schema;

// ─── listStudios ──────────────────────────────────────────────

export async function listStudios(sfwOnly: boolean) {
  const rows = await db
    .select({
      id: studios.id,
      name: studios.name,
      description: studios.description,
      aliases: studios.aliases,
      url: studios.url,
      parentId: studios.parentId,
      imageUrl: studios.imageUrl,
      imagePath: studios.imagePath,
      favorite: studios.favorite,
      rating: studios.rating,
      isNsfw: studios.isNsfw,
      sceneCount: sfwOnly
        ? studioSfwSceneCountExpr()
        : studioTotalSceneCountExpr(),
      createdAt: studios.createdAt,
      updatedAt: studios.updatedAt,
      imageAppearanceCount: studioImageAppearanceCountExpr(sfwOnly),
      audioLibraryCount: studioAudioLibraryCountExpr(sfwOnly),
    })
    .from(studios)
    .where(sfwOnly ? ne(studios.isNsfw, true) : undefined)
    .orderBy(asc(studios.name));

  return {
    studios: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      aliases: r.aliases,
      url: r.url,
      parentId: r.parentId,
      imageUrl: r.imageUrl,
      imagePath: r.imagePath,
      favorite: r.favorite,
      rating: r.rating,
      isNsfw: r.isNsfw,
      sceneCount: Number(r.sceneCount ?? 0),
      imageAppearanceCount: Number(r.imageAppearanceCount ?? 0),
      audioLibraryCount: Number(r.audioLibraryCount ?? 0),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

// ─── getStudioById ────────────────────────────────────────────

export async function getStudioById(id: string, sfwOnly: boolean) {
  const row = await db.query.studios.findFirst({
    where: eq(studios.id, id),
    with: {
      parent: { columns: { id: true, name: true, imagePath: true, imageUrl: true } },
      children: {
        columns: { id: true, name: true, imagePath: true, imageUrl: true, isNsfw: true },
        orderBy: asc(studios.name),
      },
    },
  });
  if (!row) throw new AppError(404, "Studio not found");
  if (sfwOnly && row.isNsfw) throw new AppError(404, "Studio not found");

  // Compute scene counts (episodes + movies) across the row and all its
  // children in a single UNION aggregate so one DB roundtrip covers both
  // the detail view and its child studio chips.
  const studioIdsForCounts = [row.id, ...row.children.map((c) => c.id)];
  const nsfwClause = sfwOnly ? sql`AND (is_nsfw IS NOT TRUE)` : sql``;
  const sceneCountsByStudio = await db.execute<{
    studio_id: string;
    cnt: number;
  }>(sql`
    SELECT studio_id::text AS studio_id, SUM(cnt)::int AS cnt FROM (
      SELECT vs.studio_id AS studio_id, COUNT(*)::int AS cnt
      FROM video_episodes ve
      INNER JOIN video_series vs ON vs.id = ve.series_id
      WHERE vs.studio_id IS NOT NULL
        AND vs.studio_id IN ${studioIdsForCounts.length > 0 ? sql`(${sql.join(studioIdsForCounts.map((sid) => sql`${sid}::uuid`), sql`, `)})` : sql`(NULL)`}
        ${nsfwClause}
      GROUP BY vs.studio_id
      UNION ALL
      SELECT vm.studio_id AS studio_id, COUNT(*)::int AS cnt
      FROM video_movies vm
      WHERE vm.studio_id IS NOT NULL
        AND vm.studio_id IN ${studioIdsForCounts.length > 0 ? sql`(${sql.join(studioIdsForCounts.map((sid) => sql`${sid}::uuid`), sql`, `)})` : sql`(NULL)`}
        ${nsfwClause}
      GROUP BY vm.studio_id
    ) combined
    GROUP BY studio_id
  `);
  const sceneCountBy = new Map<string, number>();
  for (const r of sceneCountsByStudio as unknown as Array<{
    studio_id: string;
    cnt: number;
  }>) {
    sceneCountBy.set(r.studio_id, Number(r.cnt ?? 0));
  }

  const sceneCount = sceneCountBy.get(row.id) ?? 0;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    aliases: row.aliases,
    url: row.url,
    parentId: row.parentId,
    parent: row.parent
      ? { id: row.parent.id, name: row.parent.name, imagePath: row.parent.imagePath, imageUrl: row.parent.imageUrl }
      : null,
    childStudios: row.children
      .filter((c) => !sfwOnly || !c.isNsfw)
      .map((c) => ({
        id: c.id,
        name: c.name,
        imagePath: c.imagePath,
        imageUrl: c.imageUrl,
        sceneCount: sceneCountBy.get(c.id) ?? 0,
      })),
    imageUrl: row.imageUrl,
    imagePath: row.imagePath,
    favorite: row.favorite,
    rating: row.rating,
    isNsfw: row.isNsfw,
    sceneCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── updateStudio ─────────────────────────────────────────────

export async function updateStudio(
  id: string,
  body: {
    name?: string;
    description?: string | null;
    aliases?: string | null;
    url?: string | null;
    imageUrl?: string | null;
    parentId?: string | null;
    favorite?: boolean;
    rating?: number | null;
    isNsfw?: boolean;
  },
) {
  const [existing] = await db.select().from(studios).where(eq(studios.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Studio not found");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.aliases !== undefined) updates.aliases = body.aliases?.trim() || null;
  if (body.url !== undefined) updates.url = body.url?.trim() || null;
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl?.trim() || null;
  if (body.parentId !== undefined) updates.parentId = body.parentId || null;
  if (body.favorite !== undefined) updates.favorite = body.favorite;
  if (body.rating !== undefined) updates.rating = body.rating;
  if (body.isNsfw !== undefined) updates.isNsfw = body.isNsfw;

  await db.update(studios).set(updates).where(eq(studios.id, id));
  const [updated] = await db
    .select({
      id: studios.id,
      name: studios.name,
      description: studios.description,
      aliases: studios.aliases,
      url: studios.url,
      parentId: studios.parentId,
      imageUrl: studios.imageUrl,
      imagePath: studios.imagePath,
      favorite: studios.favorite,
      rating: studios.rating,
      isNsfw: studios.isNsfw,
      sceneCount: studioTotalSceneCountExpr(),
      createdAt: studios.createdAt,
      updatedAt: studios.updatedAt,
    })
    .from(studios)
    .where(eq(studios.id, id))
    .limit(1);
  return {
    ...updated,
    sceneCount: Number(updated.sceneCount ?? 0),
  };
}

// ─── createStudio ─────────────────────────────────────────────

export async function createStudio(body: {
  name: string;
  description?: string;
  aliases?: string;
  url?: string;
  parentId?: string;
}) {
  if (!body.name?.trim()) throw new AppError(400, "name is required");
  const [created] = await db
    .insert(studios)
    .values({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      aliases: body.aliases?.trim() || null,
      url: body.url?.trim() || null,
      parentId: body.parentId || null,
    })
    .returning();
  return { ok: true as const, id: created.id };
}

// ─── findOrCreateStudio ───────────────────────────────────────

export async function findOrCreateStudio(body: {
  name: string;
  url?: string | null;
  imageUrl?: string | null;
  parentName?: string | null;
  parentUrl?: string | null;
  parentImageUrl?: string | null;
  scrapedEndpointId?: string | null;
  scrapedRemoteId?: string | null;
}) {
  if (!body.name?.trim()) throw new AppError(400, "name is required");

  // Loop-prevention: track visited studio names during recursive parent resolution
  const visited = new Set<string>();

  const resolve = async (
    name: string,
    data?: {
      url?: string | null;
      imageUrl?: string | null;
      parentName?: string | null;
      parentUrl?: string | null;
      parentImageUrl?: string | null;
    },
  ): Promise<string> => {
    const key = name.toLowerCase();
    if (visited.has(key)) {
      // Circular reference — find or create without parent to break the loop
      const [existing] = await db
        .select({ id: studios.id })
        .from(studios)
        .where(ilike(studios.name, name))
        .limit(1);
      if (existing) return existing.id;
      const [created] = await db.insert(studios).values({ name }).returning({ id: studios.id });
      return created.id;
    }
    visited.add(key);

    const [existing] = await db
      .select({ id: studios.id, url: studios.url, imageUrl: studios.imageUrl, parentId: studios.parentId })
      .from(studios)
      .where(ilike(studios.name, name))
      .limit(1);

    if (existing) {
      const backfill: Record<string, unknown> = {};
      if (!existing.url && data?.url) backfill.url = data.url;
      if (!existing.imageUrl && data?.imageUrl) backfill.imageUrl = data.imageUrl;
      if (!existing.parentId && data?.parentName) {
        backfill.parentId = await resolve(data.parentName, {
          url: data.parentUrl,
          imageUrl: data.parentImageUrl,
        });
      }
      if (Object.keys(backfill).length > 0) {
        await db.update(studios).set({ ...backfill, updatedAt: new Date() }).where(eq(studios.id, existing.id));
      }
      return existing.id;
    }

    let parentId: string | null = null;
    if (data?.parentName) {
      parentId = await resolve(data.parentName, {
        url: data.parentUrl,
        imageUrl: data.parentImageUrl,
      });
    }

    const [created] = await db
      .insert(studios)
      .values({
        name,
        url: data?.url?.trim() || null,
        imageUrl: data?.imageUrl?.trim() || null,
        parentId,
      })
      .returning({ id: studios.id });
    return created.id;
  };

  const studioId = await resolve(body.name.trim(), {
    url: body.url,
    imageUrl: body.imageUrl,
    parentName: body.parentName?.trim() || null,
    parentUrl: body.parentUrl,
    parentImageUrl: body.parentImageUrl,
  });

  return { ok: true as const, id: studioId };
}

// ─── deleteStudio ─────────────────────────────────────────────

export async function deleteStudio(id: string) {
  const deleted = await db.transaction(async (tx) => {
    // Child studios and media rows reference this id (no ON DELETE SET NULL) — detach first.
    await tx
      .update(studios)
      .set({ parentId: null, updatedAt: new Date() })
      .where(eq(studios.parentId, id));
    await tx
      .update(videoSeries)
      .set({ studioId: null, updatedAt: new Date() })
      .where(eq(videoSeries.studioId, id));
    await tx
      .update(videoMovies)
      .set({ studioId: null, updatedAt: new Date() })
      .where(eq(videoMovies.studioId, id));
    await tx
      .update(galleries)
      .set({ studioId: null, updatedAt: new Date() })
      .where(eq(galleries.studioId, id));
    await tx
      .update(images)
      .set({ studioId: null, updatedAt: new Date() })
      .where(eq(images.studioId, id));
    await tx
      .update(audioLibraries)
      .set({ studioId: null, updatedAt: new Date() })
      .where(eq(audioLibraries.studioId, id));
    await tx
      .update(audioTracks)
      .set({ studioId: null, updatedAt: new Date() })
      .where(eq(audioTracks.studioId, id));

    const [row] = await tx.delete(studios).where(eq(studios.id, id)).returning({ id: studios.id });
    return row;
  });

  if (!deleted) throw new AppError(404, "Studio not found");
  // Cleanup generated image directory
  try {
    const dir = getGeneratedStudioDir(id);
    if (existsSync(dir)) await rm(dir, { recursive: true });
  } catch {
    /* non-fatal */
  }
  return { ok: true as const };
}

// ─── setStudioFavorite ────────────────────────────────────────

export async function setStudioFavorite(id: string, favorite: boolean) {
  const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Studio not found");
  await db.update(studios).set({ favorite, updatedAt: new Date() }).where(eq(studios.id, id));
  return { ok: true as const, favorite };
}

// ─── setStudioRating ──────────────────────────────────────────

export async function setStudioRating(id: string, rating: number | null) {
  const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Studio not found");
  await db.update(studios).set({ rating, updatedAt: new Date() }).where(eq(studios.id, id));
  return { ok: true as const, rating };
}

// ─── uploadStudioImage ────────────────────────────────────────

export async function uploadStudioImage(id: string, buffer: Buffer) {
  const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Studio not found");
  const genDir = getGeneratedStudioDir(id);
  await mkdir(genDir, { recursive: true });
  await writeFile(path.join(genDir, "image.jpg"), buffer);
  const assetUrl = `/assets/studios/${id}/image`;
  await db.update(studios).set({ imagePath: assetUrl, updatedAt: new Date() }).where(eq(studios.id, id));
  return { ok: true as const, imagePath: assetUrl };
}

// ─── setStudioImageFromUrl ────────────────────────────────────

export async function setStudioImageFromUrl(id: string, imageUrl: string) {
  if (!imageUrl || (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image/"))) {
    throw new AppError(400, "Invalid image URL");
  }
  const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Studio not found");

  try {
    let buffer: Buffer;
    let contentType = "image/jpeg";
    if (imageUrl.startsWith("data:image/")) {
      const match = imageUrl.match(/^data:(image\/\w+);/);
      if (match) contentType = match[1];
      const base64Data = imageUrl.split(",")[1];
      if (!base64Data) throw new AppError(400, "Invalid data URL");
      buffer = Buffer.from(base64Data, "base64");
    } else {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new AppError(502, `Failed to fetch image: ${res.status}`);
      contentType = res.headers.get("content-type") ?? "image/jpeg";
      buffer = Buffer.from(await res.arrayBuffer());
    }
    // Detect format by content: SVG starts with < or <?xml
    const head = buffer.subarray(0, 100).toString("utf8").trim();
    if (head.startsWith("<") || head.startsWith("<?xml")) contentType = "image/svg+xml";
    const ext = contentType.includes("svg")
      ? "svg"
      : contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
    const genDir = getGeneratedStudioDir(id);
    await mkdir(genDir, { recursive: true });
    // Remove old image files of any extension
    for (const old of ["jpg", "png", "svg", "webp"]) {
      const oldPath = path.join(genDir, `image.${old}`);
      if (existsSync(oldPath))
        try {
          await unlink(oldPath);
        } catch {
          /* ok */
        }
    }
    await writeFile(path.join(genDir, `image.${ext}`), buffer);
    const assetUrl = `/assets/studios/${id}/image`;
    await db
      .update(studios)
      .set({ imagePath: assetUrl, imageUrl, updatedAt: new Date() })
      .where(eq(studios.id, id));
    return { ok: true as const, imagePath: assetUrl };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, "Failed to download image");
  }
}

// ─── deleteStudioImage ────────────────────────────────────────

export async function deleteStudioImage(id: string) {
  const [existing] = await db.select({ id: studios.id }).from(studios).where(eq(studios.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Studio not found");
  try {
    const p = path.join(getGeneratedStudioDir(id), "image.jpg");
    if (existsSync(p)) await unlink(p);
  } catch {
    /* non-fatal */
  }
  await db
    .update(studios)
    .set({ imagePath: null, imageUrl: null, updatedAt: new Date() })
    .where(eq(studios.id, id));
  return { ok: true as const };
}
