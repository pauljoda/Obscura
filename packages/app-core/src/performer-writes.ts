import { existsSync } from "node:fs";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getGeneratedPerformerDir } from "@obscura/media-core";
import { schema, type AppDb } from "@obscura/db";
import { eq, ilike } from "drizzle-orm";

const { performers, performerTags, tags } = schema;

export class PerformerNotFoundError extends Error {
  constructor() {
    super("Actor not found");
    this.name = "PerformerNotFoundError";
  }
}
export class PerformerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerformerValidationError";
  }
}
export class PerformerUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerformerUpstreamError";
  }
}

async function requirePerformer(db: AppDb, id: string) {
  const row = await db.query.performers.findFirst({
    where: eq(performers.id, id),
    columns: { id: true },
  });
  if (!row) throw new PerformerNotFoundError();
  return row;
}

// Transaction callback type — drizzle doesn't export it cleanly, so
// we take the same inferred shape the original code did.
type TxArg = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

async function syncTags(tx: TxArg, performerId: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const trimmed = tagName.trim();
    if (!trimmed) continue;
    let tag = await tx.query.tags.findFirst({ where: ilike(tags.name, trimmed) });
    if (!tag) {
      [tag] = await tx.insert(tags).values({ name: trimmed }).returning();
    }
    await tx.insert(performerTags).values({ performerId, tagId: tag.id });
  }
}

async function writePerformerImage(id: string, buffer: Buffer) {
  const genDir = getGeneratedPerformerDir(id);
  await mkdir(genDir, { recursive: true });
  const imageDiskPath = path.join(genDir, "image.jpg");
  await writeFile(imageDiskPath, buffer);
  return `/assets/performers/${id}/image`;
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

export async function createPerformerWrite(db: AppDb, body: CreatePerformerBody) {
  if (!body.name?.trim())
    throw new PerformerValidationError("Name is required");

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

    if (body.tagNames?.length) await syncTags(tx, created.id, body.tagNames);
    return created;
  });

  return { ok: true as const, id: result.id };
}

export async function updatePerformerWrite(
  db: AppDb,
  id: string,
  body: UpdatePerformerBody,
) {
  await requirePerformer(db, id);

  await db.transaction(async (tx) => {
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

    if (body.tagNames !== undefined) {
      await tx.delete(performerTags).where(eq(performerTags.performerId, id));
      if (body.tagNames.length > 0) await syncTags(tx, id, body.tagNames);
    }
  });

  return { ok: true as const, id };
}

export async function deletePerformerWrite(db: AppDb, id: string) {
  await requirePerformer(db, id);
  await db.delete(performers).where(eq(performers.id, id));

  const genDir = getGeneratedPerformerDir(id);
  try {
    if (existsSync(genDir)) await rm(genDir, { recursive: true });
  } catch {
    /* non-fatal */
  }
  return { ok: true as const };
}

export async function setPerformerFavoriteWrite(
  db: AppDb,
  id: string,
  favorite: boolean,
) {
  await requirePerformer(db, id);
  await db
    .update(performers)
    .set({ favorite, updatedAt: new Date() })
    .where(eq(performers.id, id));
  return { ok: true as const, favorite };
}

export async function setPerformerRatingWrite(
  db: AppDb,
  id: string,
  rating: number | null,
) {
  await requirePerformer(db, id);
  await db
    .update(performers)
    .set({ rating, updatedAt: new Date() })
    .where(eq(performers.id, id));
  return { ok: true as const, rating };
}

export async function uploadPerformerImageWrite(
  db: AppDb,
  id: string,
  buffer: Buffer,
) {
  await requirePerformer(db, id);
  const assetUrl = await writePerformerImage(id, buffer);
  await db
    .update(performers)
    .set({ imagePath: assetUrl, updatedAt: new Date() })
    .where(eq(performers.id, id));
  return { ok: true as const, imagePath: assetUrl };
}

export async function setPerformerImageFromUrlWrite(
  db: AppDb,
  id: string,
  imageUrl: string,
) {
  if (
    !imageUrl ||
    (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:image/"))
  ) {
    throw new PerformerValidationError("Invalid image URL");
  }

  await requirePerformer(db, id);

  let buffer: Buffer;
  if (imageUrl.startsWith("data:image/")) {
    const base64Data = imageUrl.split(",")[1];
    if (!base64Data) throw new PerformerValidationError("Invalid data URL");
    buffer = Buffer.from(base64Data, "base64");
  } else {
    let res: Response;
    try {
      res = await fetch(imageUrl);
    } catch {
      throw new PerformerUpstreamError("Failed to download image");
    }
    if (!res.ok)
      throw new PerformerUpstreamError(`Failed to fetch image: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  }

  const assetUrl = await writePerformerImage(id, buffer);
  await db
    .update(performers)
    .set({ imagePath: assetUrl, imageUrl, updatedAt: new Date() })
    .where(eq(performers.id, id));
  return { ok: true as const, imagePath: assetUrl };
}

export async function deletePerformerImageWrite(db: AppDb, id: string) {
  await requirePerformer(db, id);

  const imageDiskPath = path.join(getGeneratedPerformerDir(id), "image.jpg");
  try {
    if (existsSync(imageDiskPath)) await unlink(imageDiskPath);
  } catch {
    /* non-fatal */
  }

  await db
    .update(performers)
    .set({ imagePath: null, updatedAt: new Date() })
    .where(eq(performers.id, id));
  return { ok: true as const };
}
