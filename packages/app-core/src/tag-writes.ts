/**
 * Tag write helpers for the first-party API surface. These take a typed
 * Drizzle db and throw sentinel error classes for not-found, validation,
 * and upstream-failure conditions; the route layer maps them to HTTP.
 */
import { existsSync } from "node:fs";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getGeneratedTagDir } from "@obscura/media-core";
import { schema, type AppDb } from "@obscura/db";
import { eq } from "drizzle-orm";
import { tagTotalSceneCountExpr } from "./appearance-count-expressions";

const { tags, performerTags, galleryTags, imageTags, audioLibraryTags, audioTrackTags } =
  schema;

export class TagNotFoundError extends Error {
  constructor() {
    super("Tag not found");
    this.name = "TagNotFoundError";
  }
}

export class TagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TagValidationError";
  }
}

export class TagUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TagUpstreamError";
  }
}

async function requireTag(db: AppDb, id: string) {
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.id, id))
    .limit(1);
  if (!existing) throw new TagNotFoundError();
  return existing;
}

export interface UpdateTagBody {
  name?: string;
  description?: string | null;
  aliases?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  favorite?: boolean;
  rating?: number | null;
  ignoreAutoTag?: boolean;
  isNsfw?: boolean;
}

export async function updateTagWrite(db: AppDb, id: string, body: UpdateTagBody) {
  const [existing] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  if (!existing) throw new TagNotFoundError();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined)
    updates.description = body.description?.trim() || null;
  if (body.aliases !== undefined)
    updates.aliases = body.aliases?.trim() || null;
  if (body.imageUrl !== undefined)
    updates.imageUrl = body.imageUrl?.trim() || null;
  if (body.parentId !== undefined) updates.parentId = body.parentId || null;
  if (body.favorite !== undefined) updates.favorite = body.favorite;
  if (body.rating !== undefined) updates.rating = body.rating;
  if (body.ignoreAutoTag !== undefined)
    updates.ignoreAutoTag = body.ignoreAutoTag;
  if (body.isNsfw !== undefined) updates.isNsfw = body.isNsfw;

  await db.update(tags).set(updates).where(eq(tags.id, id));
  const [updated] = await db
    .select({
      id: tags.id,
      name: tags.name,
      description: tags.description,
      aliases: tags.aliases,
      parentId: tags.parentId,
      imageUrl: tags.imageUrl,
      imagePath: tags.imagePath,
      favorite: tags.favorite,
      rating: tags.rating,
      isNsfw: tags.isNsfw,
      ignoreAutoTag: tags.ignoreAutoTag,
      videoCount: tagTotalSceneCountExpr(),
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
    })
    .from(tags)
    .where(eq(tags.id, id))
    .limit(1);

  return {
    ...updated,
    videoCount: Number(updated.videoCount ?? 0),
  };
}

export interface CreateTagBody {
  name: string;
  description?: string;
  aliases?: string;
}

export async function createTagWrite(db: AppDb, body: CreateTagBody) {
  if (!body.name?.trim()) throw new TagValidationError("name is required");
  const [created] = await db
    .insert(tags)
    .values({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      aliases: body.aliases?.trim() || null,
    })
    .returning();
  return { ok: true as const, id: created.id };
}

export async function deleteTagWrite(db: AppDb, id: string) {
  const deleted = await db.transaction(async (tx) => {
    await tx
      .update(tags)
      .set({ parentId: null, updatedAt: new Date() })
      .where(eq(tags.parentId, id));

    await tx.delete(performerTags).where(eq(performerTags.tagId, id));
    await tx.delete(galleryTags).where(eq(galleryTags.tagId, id));
    await tx.delete(imageTags).where(eq(imageTags.tagId, id));
    await tx.delete(audioLibraryTags).where(eq(audioLibraryTags.tagId, id));
    await tx.delete(audioTrackTags).where(eq(audioTrackTags.tagId, id));

    const [row] = await tx
      .delete(tags)
      .where(eq(tags.id, id))
      .returning({ id: tags.id });
    return row;
  });

  if (!deleted) throw new TagNotFoundError();

  try {
    const dir = getGeneratedTagDir(id);
    if (existsSync(dir)) await rm(dir, { recursive: true });
  } catch {
    /* non-fatal */
  }
  return { ok: true as const };
}

export async function setTagFavoriteWrite(
  db: AppDb,
  id: string,
  favorite: boolean,
) {
  await requireTag(db, id);
  await db
    .update(tags)
    .set({ favorite, updatedAt: new Date() })
    .where(eq(tags.id, id));
  return { ok: true as const, favorite };
}

export async function setTagRatingWrite(
  db: AppDb,
  id: string,
  rating: number | null,
) {
  await requireTag(db, id);
  await db
    .update(tags)
    .set({ rating, updatedAt: new Date() })
    .where(eq(tags.id, id));
  return { ok: true as const, rating };
}

export async function uploadTagImageWrite(
  db: AppDb,
  id: string,
  buffer: Buffer,
) {
  await requireTag(db, id);
  const genDir = getGeneratedTagDir(id);
  await mkdir(genDir, { recursive: true });
  await writeFile(path.join(genDir, "image.jpg"), buffer);
  const assetUrl = `/assets/tags/${id}/image`;
  await db
    .update(tags)
    .set({ imagePath: assetUrl, updatedAt: new Date() })
    .where(eq(tags.id, id));
  return { ok: true as const, imagePath: assetUrl };
}

export async function setTagImageFromUrlWrite(
  db: AppDb,
  id: string,
  imageUrl: string,
) {
  if (
    !imageUrl ||
    (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image/"))
  ) {
    throw new TagValidationError("Invalid image URL");
  }
  await requireTag(db, id);

  try {
    let buffer: Buffer;
    let contentType = "image/jpeg";
    if (imageUrl.startsWith("data:image/")) {
      const match = imageUrl.match(/^data:(image\/\w+);/);
      if (match) contentType = match[1];
      const base64Data = imageUrl.split(",")[1];
      if (!base64Data) throw new TagValidationError("Invalid data URL");
      buffer = Buffer.from(base64Data, "base64");
    } else {
      const res = await fetch(imageUrl);
      if (!res.ok)
        throw new TagUpstreamError(`Failed to fetch image: ${res.status}`);
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
    const genDir = getGeneratedTagDir(id);
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
    const assetUrl = `/assets/tags/${id}/image`;
    await db
      .update(tags)
      .set({ imagePath: assetUrl, imageUrl, updatedAt: new Date() })
      .where(eq(tags.id, id));
    return { ok: true as const, imagePath: assetUrl };
  } catch (err) {
    if (
      err instanceof TagValidationError ||
      err instanceof TagUpstreamError ||
      err instanceof TagNotFoundError
    ) {
      throw err;
    }
    throw new TagUpstreamError("Failed to download image");
  }
}

export async function deleteTagImageWrite(db: AppDb, id: string) {
  await requireTag(db, id);
  try {
    const p = path.join(getGeneratedTagDir(id), "image.jpg");
    if (existsSync(p)) await unlink(p);
  } catch {
    /* non-fatal */
  }
  await db
    .update(tags)
    .set({ imagePath: null, imageUrl: null, updatedAt: new Date() })
    .where(eq(tags.id, id));
  return { ok: true as const };
}
