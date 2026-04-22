import { existsSync } from "node:fs";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getGeneratedStudioDir } from "@obscura/media-core";
import { schema, type AppDb } from "@obscura/db";
import { eq, ilike } from "drizzle-orm";
import { studioTotalSceneCountExpr } from "./appearance-count-expressions";

const { studios, galleries, images, audioLibraries, audioTracks, videoSeries, videoMovies } =
  schema;

export class StudioNotFoundError extends Error {
  constructor() {
    super("Studio not found");
    this.name = "StudioNotFoundError";
  }
}
export class StudioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioValidationError";
  }
}
export class StudioUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioUpstreamError";
  }
}

async function requireStudio(db: AppDb, id: string) {
  const [existing] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.id, id))
    .limit(1);
  if (!existing) throw new StudioNotFoundError();
  return existing;
}

export interface UpdateStudioBody {
  name?: string;
  description?: string | null;
  aliases?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  favorite?: boolean;
  rating?: number | null;
  isNsfw?: boolean;
}

export async function updateStudioWrite(
  db: AppDb,
  id: string,
  body: UpdateStudioBody,
) {
  const [existing] = await db.select().from(studios).where(eq(studios.id, id)).limit(1);
  if (!existing) throw new StudioNotFoundError();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined)
    updates.description = body.description?.trim() || null;
  if (body.aliases !== undefined)
    updates.aliases = body.aliases?.trim() || null;
  if (body.url !== undefined) updates.url = body.url?.trim() || null;
  if (body.imageUrl !== undefined)
    updates.imageUrl = body.imageUrl?.trim() || null;
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
      videoCount: studioTotalSceneCountExpr(),
      createdAt: studios.createdAt,
      updatedAt: studios.updatedAt,
    })
    .from(studios)
    .where(eq(studios.id, id))
    .limit(1);
  return {
    ...updated,
    videoCount: Number(updated.videoCount ?? 0),
  };
}

export interface CreateStudioBody {
  name: string;
  description?: string;
  aliases?: string;
  url?: string;
  parentId?: string;
}

export async function createStudioWrite(db: AppDb, body: CreateStudioBody) {
  if (!body.name?.trim()) throw new StudioValidationError("name is required");
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

export interface FindOrCreateStudioBody {
  name: string;
  url?: string | null;
  imageUrl?: string | null;
  parentName?: string | null;
  parentUrl?: string | null;
  parentImageUrl?: string | null;
  scrapedEndpointId?: string | null;
  scrapedRemoteId?: string | null;
}

export async function findOrCreateStudioWrite(
  db: AppDb,
  body: FindOrCreateStudioBody,
) {
  if (!body.name?.trim()) throw new StudioValidationError("name is required");

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
      const [existing] = await db
        .select({ id: studios.id })
        .from(studios)
        .where(ilike(studios.name, name))
        .limit(1);
      if (existing) return existing.id;
      const [created] = await db
        .insert(studios)
        .values({ name })
        .returning({ id: studios.id });
      return created.id;
    }
    visited.add(key);

    const [existing] = await db
      .select({
        id: studios.id,
        url: studios.url,
        imageUrl: studios.imageUrl,
        parentId: studios.parentId,
      })
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
        await db
          .update(studios)
          .set({ ...backfill, updatedAt: new Date() })
          .where(eq(studios.id, existing.id));
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

export async function deleteStudioWrite(db: AppDb, id: string) {
  const deleted = await db.transaction(async (tx) => {
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

    const [row] = await tx
      .delete(studios)
      .where(eq(studios.id, id))
      .returning({ id: studios.id });
    return row;
  });

  if (!deleted) throw new StudioNotFoundError();

  try {
    const dir = getGeneratedStudioDir(id);
    if (existsSync(dir)) await rm(dir, { recursive: true });
  } catch {
    /* non-fatal */
  }
  return { ok: true as const };
}

export async function setStudioFavoriteWrite(
  db: AppDb,
  id: string,
  favorite: boolean,
) {
  await requireStudio(db, id);
  await db
    .update(studios)
    .set({ favorite, updatedAt: new Date() })
    .where(eq(studios.id, id));
  return { ok: true as const, favorite };
}

export async function setStudioRatingWrite(
  db: AppDb,
  id: string,
  rating: number | null,
) {
  await requireStudio(db, id);
  await db
    .update(studios)
    .set({ rating, updatedAt: new Date() })
    .where(eq(studios.id, id));
  return { ok: true as const, rating };
}

export async function uploadStudioImageWrite(
  db: AppDb,
  id: string,
  buffer: Buffer,
) {
  await requireStudio(db, id);
  const genDir = getGeneratedStudioDir(id);
  await mkdir(genDir, { recursive: true });
  await writeFile(path.join(genDir, "image.jpg"), buffer);
  const assetUrl = `/assets/studios/${id}/image`;
  await db
    .update(studios)
    .set({ imagePath: assetUrl, updatedAt: new Date() })
    .where(eq(studios.id, id));
  return { ok: true as const, imagePath: assetUrl };
}

export async function setStudioImageFromUrlWrite(
  db: AppDb,
  id: string,
  imageUrl: string,
) {
  if (
    !imageUrl ||
    (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image/"))
  ) {
    throw new StudioValidationError("Invalid image URL");
  }
  await requireStudio(db, id);

  try {
    let buffer: Buffer;
    let contentType = "image/jpeg";
    if (imageUrl.startsWith("data:image/")) {
      const match = imageUrl.match(/^data:(image\/\w+);/);
      if (match) contentType = match[1];
      const base64Data = imageUrl.split(",")[1];
      if (!base64Data) throw new StudioValidationError("Invalid data URL");
      buffer = Buffer.from(base64Data, "base64");
    } else {
      const res = await fetch(imageUrl);
      if (!res.ok)
        throw new StudioUpstreamError(`Failed to fetch image: ${res.status}`);
      contentType = res.headers.get("content-type") ?? "image/jpeg";
      buffer = Buffer.from(await res.arrayBuffer());
    }
    const head = buffer.subarray(0, 100).toString("utf8").trim();
    if (head.startsWith("<") || head.startsWith("<?xml"))
      contentType = "image/svg+xml";
    const ext = contentType.includes("svg")
      ? "svg"
      : contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
    const genDir = getGeneratedStudioDir(id);
    await mkdir(genDir, { recursive: true });
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
    if (
      err instanceof StudioValidationError ||
      err instanceof StudioUpstreamError ||
      err instanceof StudioNotFoundError
    ) {
      throw err;
    }
    throw new StudioUpstreamError("Failed to download image");
  }
}

export async function deleteStudioImageWrite(db: AppDb, id: string) {
  await requireStudio(db, id);
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
