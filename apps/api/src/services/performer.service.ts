/**
 * Performer business logic extracted from route handlers.
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
  or,
  desc,
  asc,
  sql,
  and,
  ne,
  isNotNull,
  isNull,
  gte,
  lte,
} from "drizzle-orm";
import { getGeneratedPerformerDir } from "@obscura/media-core";
import { db, schema } from "../db";
import { AppError } from "../plugins/error-handler";
import { MAX_ENTITY_LIST_LIMIT, parsePagination, type SortConfig } from "../lib/query-helpers";
import {
  performerAudioLibraryCountExpr,
  performerImageAppearanceCountExpr,
  performerSfwSceneCountExpr,
} from "../lib/appearance-count-expressions";

const { performers, performerTags, scenePerformers, tags, scenes } = schema;

// ─── SQL Expressions ──────────────────────────────────────────

const sfwPerformerSceneCountExpr = performerSfwSceneCountExpr();

// ─── Query Types ──────────────────────────────────────────────

export interface ListPerformersQuery {
  search?: string;
  sort?: string;
  order?: string;
  gender?: string;
  favorite?: string;
  country?: string;
  limit?: string;
  offset?: string;
  nsfw?: string;
  ratingMin?: string;
  ratingMax?: string;
  hasImage?: string;
  sceneCountMin?: string;
}

export interface CreatePerformerBody {
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
}

export interface UpdatePerformerBody {
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
}

// ─── Helpers ──────────────────────────────────────────────────

/** Ensure a performer exists or throw 404. */
async function requirePerformer(id: string) {
  const row = await db.query.performers.findFirst({
    where: eq(performers.id, id),
    columns: { id: true },
  });
  if (!row) throw new AppError(404, "Actor not found");
  return row;
}

/** Resolve tag names and attach them to a performer inside a transaction. */
async function syncTags(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  performerId: string,
  tagNames: string[],
) {
  for (const tagName of tagNames) {
    const trimmed = tagName.trim();
    if (!trimmed) continue;
    let tag = await tx.query.tags.findFirst({
      where: ilike(tags.name, trimmed),
    });
    if (!tag) {
      [tag] = await tx.insert(tags).values({ name: trimmed }).returning();
    }
    await tx.insert(performerTags).values({
      performerId,
      tagId: tag.id,
    });
  }
}

/** Write a buffer to the performer image path and return the asset URL. */
async function writePerformerImage(id: string, buffer: Buffer) {
  const genDir = getGeneratedPerformerDir(id);
  await mkdir(genDir, { recursive: true });
  const imageDiskPath = path.join(genDir, "image.jpg");
  await writeFile(imageDiskPath, buffer);
  return `/assets/performers/${id}/image`;
}

// ─── Service Functions ────────────────────────────────────────

/**
 * List performers with filtering, sorting, and pagination.
 */
export async function listPerformers(query: ListPerformersQuery) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 50, MAX_ENTITY_LIST_LIMIT);
  const sfwOnly = query.nsfw === "off";

  // Build WHERE conditions
  const conditions = [];

  if (sfwOnly) {
    conditions.push(ne(performers.isNsfw, true));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(performers.name, term),
        ilike(performers.aliases, term),
        ilike(performers.disambiguation, term),
      )!,
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

  const pRatingMin =
    query.ratingMin !== undefined ? Number(query.ratingMin) : NaN;
  if (Number.isInteger(pRatingMin) && pRatingMin >= 1 && pRatingMin <= 5) {
    conditions.push(
      and(isNotNull(performers.rating), gte(performers.rating, pRatingMin))!,
    );
  }
  const pRatingMax =
    query.ratingMax !== undefined ? Number(query.ratingMax) : NaN;
  if (Number.isInteger(pRatingMax) && pRatingMax >= 1 && pRatingMax <= 5) {
    conditions.push(
      and(isNotNull(performers.rating), lte(performers.rating, pRatingMax))!,
    );
  }

  if (query.hasImage === "true") {
    conditions.push(isNotNull(performers.imagePath));
  }
  if (query.hasImage === "false") {
    conditions.push(isNull(performers.imagePath));
  }

  const scm =
    query.sceneCountMin !== undefined ? Number(query.sceneCountMin) : NaN;
  if (Number.isInteger(scm) && scm >= 1) {
    if (sfwOnly) {
      conditions.push(gte(sfwPerformerSceneCountExpr, scm));
    } else {
      conditions.push(gte(performers.sceneCount, scm));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sceneCountSelect = sfwOnly
    ? sfwPerformerSceneCountExpr
    : performers.sceneCount;

  // Sorting
  const sortDir = query.order === "asc" ? asc : desc;
  const sortAsc = query.order === "asc" ? asc : null;
  let orderBy;
  switch (query.sort) {
    case "name":
      orderBy = (sortAsc ?? asc)(performers.name);
      break;
    case "scenes":
      orderBy = sfwOnly
        ? query.order === "asc"
          ? asc(sfwPerformerSceneCountExpr)
          : desc(sfwPerformerSceneCountExpr)
        : sortDir(performers.sceneCount);
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
        sceneCount: sceneCountSelect,
        imageAppearanceCount: performerImageAppearanceCountExpr(sfwOnly),
        audioLibraryCount: performerAudioLibraryCountExpr(sfwOnly),
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
      sceneCount: Number(r.sceneCount ?? 0),
      imageAppearanceCount: Number(r.imageAppearanceCount ?? 0),
      audioLibraryCount: Number(r.audioLibraryCount ?? 0),
      createdAt: r.createdAt.toISOString(),
    })),
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  };
}

/**
 * Get a single performer by ID with full detail and tags.
 */
export async function getPerformerById(id: string, sfwOnly: boolean) {
  const row = await db.query.performers.findFirst({
    where: eq(performers.id, id),
    with: {
      performerTags: {
        with: { tag: true },
      },
    },
  });

  if (!row) throw new AppError(404, "Actor not found");
  if (sfwOnly && row.isNsfw) throw new AppError(404, "Actor not found");

  let sceneCount = row.sceneCount;
  if (sfwOnly) {
    const [cnt] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(scenePerformers)
      .innerJoin(scenes, eq(scenes.id, scenePerformers.sceneId))
      .where(
        and(
          eq(scenePerformers.performerId, id),
          ne(scenes.isNsfw, true),
        ),
      );
    sceneCount = Number(cnt?.n ?? 0);
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
    sceneCount,
    tags: row.performerTags.map((pt) => ({
      id: pt.tag.id,
      name: pt.tag.name,
      isNsfw: pt.tag.isNsfw,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Create a new performer, optionally with tag names.
 */
export async function createPerformer(body: CreatePerformerBody) {
  if (!body.name?.trim()) {
    throw new AppError(400, "Name is required");
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

    if (body.tagNames?.length) {
      await syncTags(tx, created.id, body.tagNames);
    }

    return created;
  });

  return { ok: true as const, id: result.id };
}

/**
 * Update a performer, optionally replacing tags.
 */
export async function updatePerformer(id: string, body: UpdatePerformerBody) {
  await requirePerformer(id);

  await db.transaction(async (tx) => {
    // Build update set from provided fields
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = [
      "name",
      "disambiguation",
      "aliases",
      "gender",
      "birthdate",
      "country",
      "ethnicity",
      "eyeColor",
      "hairColor",
      "height",
      "weight",
      "measurements",
      "tattoos",
      "piercings",
      "careerStart",
      "careerEnd",
      "details",
      "imageUrl",
      "favorite",
      "rating",
      "isNsfw",
    ] as const;

    for (const field of fields) {
      if (field in body) {
        updates[field] = (body as Record<string, unknown>)[field];
      }
    }

    await tx.update(performers).set(updates).where(eq(performers.id, id));

    // Handle tags if provided
    if (body.tagNames !== undefined) {
      await tx
        .delete(performerTags)
        .where(eq(performerTags.performerId, id));

      if (body.tagNames.length > 0) {
        await syncTags(tx, id, body.tagNames);
      }
    }
  });

  return { ok: true as const, id };
}

/**
 * Delete a performer and clean up generated files.
 */
export async function deletePerformer(id: string) {
  await requirePerformer(id);

  await db.delete(performers).where(eq(performers.id, id));

  // Clean up image files
  const genDir = getGeneratedPerformerDir(id);
  try {
    if (existsSync(genDir)) await rm(genDir, { recursive: true });
  } catch {
    // non-fatal
  }

  return { ok: true as const };
}

/**
 * Set the favorite flag on a performer.
 */
export async function setPerformerFavorite(id: string, favorite: boolean) {
  await requirePerformer(id);

  await db
    .update(performers)
    .set({ favorite, updatedAt: new Date() })
    .where(eq(performers.id, id));

  return { ok: true as const, favorite };
}

/**
 * Set the rating on a performer.
 */
export async function setPerformerRating(id: string, rating: number | null) {
  await requirePerformer(id);

  await db
    .update(performers)
    .set({ rating, updatedAt: new Date() })
    .where(eq(performers.id, id));

  return { ok: true as const, rating };
}

/**
 * Upload a performer image from a buffer (multipart upload).
 */
export async function uploadPerformerImage(id: string, buffer: Buffer) {
  await requirePerformer(id);

  const assetUrl = await writePerformerImage(id, buffer);

  await db
    .update(performers)
    .set({ imagePath: assetUrl, updatedAt: new Date() })
    .where(eq(performers.id, id));

  return { ok: true as const, imagePath: assetUrl };
}

/**
 * Set a performer image from a URL or base64 data URL.
 */
export async function setPerformerImageFromUrl(id: string, imageUrl: string) {
  if (
    !imageUrl ||
    (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image/"))
  ) {
    throw new AppError(400, "Invalid image URL");
  }

  await requirePerformer(id);

  let buffer: Buffer;

  if (imageUrl.startsWith("data:image/")) {
    const base64Data = imageUrl.split(",")[1];
    if (!base64Data) {
      throw new AppError(400, "Invalid data URL");
    }
    buffer = Buffer.from(base64Data, "base64");
  } else {
    let res: Response;
    try {
      res = await fetch(imageUrl);
    } catch {
      throw new AppError(502, "Failed to download image");
    }
    if (!res.ok) {
      throw new AppError(502, `Failed to fetch image: ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  }

  const assetUrl = await writePerformerImage(id, buffer);

  await db
    .update(performers)
    .set({ imagePath: assetUrl, imageUrl, updatedAt: new Date() })
    .where(eq(performers.id, id));

  return { ok: true as const, imagePath: assetUrl };
}

/**
 * Delete a performer's image file and clear the database reference.
 */
export async function deletePerformerImage(id: string) {
  await requirePerformer(id);

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

  return { ok: true as const };
}
