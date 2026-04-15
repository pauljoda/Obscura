/**
 * Tag business logic extracted from route handlers.
 *
 * All functions return plain data objects and throw AppError for
 * HTTP-level error conditions (404, 400, 502, etc.).
 */
import { existsSync } from "node:fs";
import { writeFile, mkdir, unlink, rm } from "node:fs/promises";
import path from "node:path";
import {
  eq,
  desc,
  sql,
  and,
  ne,
} from "drizzle-orm";
import { getGeneratedTagDir } from "@obscura/media-core";
import { db, schema } from "../db";
import { AppError } from "../plugins/error-handler";
import {
  tagSfwSceneCountExpr,
  tagTotalSceneCountExpr,
} from "../lib/appearance-count-expressions";

const {
  tags,
  performerTags,
  galleryTags,
  imageTags,
  audioLibraryTags,
  audioTrackTags,
  images,
} = schema;

// ─── listTags ─────────────────────────────────────────────────

export async function listTags(sfwOnly: boolean) {
  const sceneCountExpr = sfwOnly
    ? tagSfwSceneCountExpr()
    : tagTotalSceneCountExpr();

  const imageAgg = sfwOnly
    ? await db
        .select({
          tagId: imageTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(imageTags)
        .innerJoin(images, eq(images.id, imageTags.imageId))
        .where(ne(images.isNsfw, true))
        .groupBy(imageTags.tagId)
    : await db
        .select({
          tagId: imageTags.tagId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(imageTags)
        .groupBy(imageTags.tagId);
  const imageMap = new Map(imageAgg.map((r) => [r.tagId, Number(r.cnt)]));

  const tagRows = await db
    .select({
      id: tags.id,
      name: tags.name,
      description: tags.description,
      aliases: tags.aliases,
      imagePath: tags.imagePath,
      favorite: tags.favorite,
      rating: tags.rating,
      isNsfw: tags.isNsfw,
      sceneCount: sceneCountExpr,
    })
    .from(tags)
    .where(sfwOnly ? ne(tags.isNsfw, true) : undefined);

  const mapped = tagRows.map((tag) => ({
    ...tag,
    sceneCount: Number(tag.sceneCount ?? 0),
    imageCount: imageMap.get(tag.id) ?? 0,
  }));

  mapped.sort((a, b) => b.sceneCount - a.sceneCount);

  return { tags: mapped };
}

// ─── getTagById ───────────────────────────────────────────────

export async function getTagById(id: string, sfwOnly: boolean) {
  const row = await db.query.tags.findFirst({ where: eq(tags.id, id) });
  if (!row) throw new AppError(404, "Tag not found");

  // Recompute scene count from video_episode_tags + video_movie_tags.
  // The cached `tags.scene_count` column is ignored and will be dropped
  // in the videos_to_series finalize phase.
  const [cnt] = await db
    .select({
      n: sfwOnly ? tagSfwSceneCountExpr() : tagTotalSceneCountExpr(),
    })
    .from(tags)
    .where(eq(tags.id, id));
  const sceneCount = Number(cnt?.n ?? 0);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    aliases: row.aliases,
    parentId: row.parentId,
    imageUrl: row.imageUrl,
    imagePath: row.imagePath,
    favorite: row.favorite,
    rating: row.rating,
    isNsfw: row.isNsfw,
    ignoreAutoTag: row.ignoreAutoTag,
    sceneCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── updateTag ────────────────────────────────────────────────

export async function updateTag(
  id: string,
  body: {
    name?: string;
    description?: string | null;
    aliases?: string | null;
    imageUrl?: string | null;
    parentId?: string | null;
    favorite?: boolean;
    rating?: number | null;
    ignoreAutoTag?: boolean;
    isNsfw?: boolean;
  },
) {
  const [existing] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Tag not found");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.aliases !== undefined) updates.aliases = body.aliases?.trim() || null;
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl?.trim() || null;
  if (body.parentId !== undefined) updates.parentId = body.parentId || null;
  if (body.favorite !== undefined) updates.favorite = body.favorite;
  if (body.rating !== undefined) updates.rating = body.rating;
  if (body.ignoreAutoTag !== undefined) updates.ignoreAutoTag = body.ignoreAutoTag;
  if (body.isNsfw !== undefined) updates.isNsfw = body.isNsfw;

  await db.update(tags).set(updates).where(eq(tags.id, id));
  const [updated] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    aliases: updated.aliases,
    parentId: updated.parentId,
    imageUrl: updated.imageUrl,
    imagePath: updated.imagePath,
    favorite: updated.favorite,
    rating: updated.rating,
    isNsfw: updated.isNsfw,
    ignoreAutoTag: updated.ignoreAutoTag,
    sceneCount: updated.sceneCount,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

// ─── createTag ────────────────────────────────────────────────

export async function createTag(body: {
  name: string;
  description?: string;
  aliases?: string;
}) {
  if (!body.name?.trim()) throw new AppError(400, "name is required");
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

// ─── deleteTag ────────────────────────────────────────────────

export async function deleteTag(id: string) {
  const deleted = await db.transaction(async (tx) => {
    // Child tags reference this row via parent_id (no ON DELETE) — detach first.
    await tx
      .update(tags)
      .set({ parentId: null, updatedAt: new Date() })
      .where(eq(tags.parentId, id));

    // Remove entity associations explicitly so delete succeeds even if the DB
    // predates ON DELETE CASCADE on join tables. video_episode_tags,
    // video_movie_tags, and video_series_tags all have ON DELETE CASCADE from
    // their tag_id FK, so they clean up automatically when the tag row is
    // deleted — no explicit wipes needed.
    await tx.delete(performerTags).where(eq(performerTags.tagId, id));
    await tx.delete(galleryTags).where(eq(galleryTags.tagId, id));
    await tx.delete(imageTags).where(eq(imageTags.tagId, id));
    await tx.delete(audioLibraryTags).where(eq(audioLibraryTags.tagId, id));
    await tx.delete(audioTrackTags).where(eq(audioTrackTags.tagId, id));

    const [row] = await tx.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
    return row;
  });

  if (!deleted) throw new AppError(404, "Tag not found");
  // Cleanup generated image directory
  try {
    const dir = getGeneratedTagDir(id);
    if (existsSync(dir)) await rm(dir, { recursive: true });
  } catch {
    /* non-fatal */
  }
  return { ok: true as const };
}

// ─── setTagFavorite ───────────────────────────────────────────

export async function setTagFavorite(id: string, favorite: boolean) {
  const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Tag not found");
  await db.update(tags).set({ favorite, updatedAt: new Date() }).where(eq(tags.id, id));
  return { ok: true as const, favorite };
}

// ─── setTagRating ─────────────────────────────────────────────

export async function setTagRating(id: string, rating: number | null) {
  const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Tag not found");
  await db.update(tags).set({ rating, updatedAt: new Date() }).where(eq(tags.id, id));
  return { ok: true as const, rating };
}

// ─── uploadTagImage ───────────────────────────────────────────

export async function uploadTagImage(id: string, buffer: Buffer) {
  const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Tag not found");
  const genDir = getGeneratedTagDir(id);
  await mkdir(genDir, { recursive: true });
  await writeFile(path.join(genDir, "image.jpg"), buffer);
  const assetUrl = `/assets/tags/${id}/image`;
  await db.update(tags).set({ imagePath: assetUrl, updatedAt: new Date() }).where(eq(tags.id, id));
  return { ok: true as const, imagePath: assetUrl };
}

// ─── setTagImageFromUrl ───────────────────────────────────────

export async function setTagImageFromUrl(id: string, imageUrl: string) {
  if (!imageUrl || (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image/"))) {
    throw new AppError(400, "Invalid image URL");
  }
  const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Tag not found");

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
    const head = buffer.subarray(0, 100).toString("utf8").trim();
    if (head.startsWith("<") || head.startsWith("<?xml")) contentType = "image/svg+xml";
    const ext = contentType.includes("svg")
      ? "svg"
      : contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
    const genDir = getGeneratedTagDir(id);
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
    const assetUrl = `/assets/tags/${id}/image`;
    await db
      .update(tags)
      .set({ imagePath: assetUrl, imageUrl, updatedAt: new Date() })
      .where(eq(tags.id, id));
    return { ok: true as const, imagePath: assetUrl };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, "Failed to download image");
  }
}

// ─── deleteTagImage ───────────────────────────────────────────

export async function deleteTagImage(id: string) {
  const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
  if (!existing) throw new AppError(404, "Tag not found");
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
