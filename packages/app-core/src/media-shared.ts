import { eq, ilike } from "drizzle-orm";
import type { AppDb } from "@obscura/db";
import { schema } from "@obscura/db";

const { performers, studios, tags } = schema;

export type TxArg = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
export type RelationLookupDb = Pick<TxArg, "select" | "insert" | "update">;

interface RelationOptions {
  isNsfw?: boolean;
}

export async function findOrCreateStudioId(
  tx: RelationLookupDb,
  studioName: string | null | undefined,
  options: RelationOptions = {},
) {
  const trimmed = studioName?.trim() ?? "";
  if (!trimmed) return null;
  const [existing] = await tx
    .select({ id: studios.id })
    .from(studios)
    .where(ilike(studios.name, trimmed))
    .limit(1);
  if (existing) {
    if (options.isNsfw) {
      await tx
        .update(studios)
        .set({ isNsfw: true, updatedAt: new Date() })
        .where(eq(studios.id, existing.id));
    }
    return existing.id;
  }
  const [created] = await tx
    .insert(studios)
    .values({ name: trimmed, ...(options.isNsfw ? { isNsfw: true } : {}) })
    .returning({ id: studios.id });
  return created.id;
}

export async function findOrCreatePerformerId(
  tx: RelationLookupDb,
  name: string,
  options: RelationOptions = {},
) {
  const trimmed = name.trim();
  const [existing] = await tx
    .select({ id: performers.id })
    .from(performers)
    .where(ilike(performers.name, trimmed))
    .limit(1);
  if (existing) {
    if (options.isNsfw) {
      await tx
        .update(performers)
        .set({ isNsfw: true, updatedAt: new Date() })
        .where(eq(performers.id, existing.id));
    }
    return existing.id;
  }
  const [created] = await tx
    .insert(performers)
    .values({ name: trimmed, ...(options.isNsfw ? { isNsfw: true } : {}) })
    .returning({ id: performers.id });
  return created.id;
}

export async function findOrCreateTagId(
  tx: RelationLookupDb,
  name: string,
  options: RelationOptions = {},
) {
  const trimmed = name.trim();
  const [existing] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(ilike(tags.name, trimmed))
    .limit(1);
  if (existing) {
    if (options.isNsfw) {
      await tx
        .update(tags)
        .set({ isNsfw: true, updatedAt: new Date() })
        .where(eq(tags.id, existing.id));
    }
    return existing.id;
  }
  const [created] = await tx
    .insert(tags)
    .values({ name: trimmed, ...(options.isNsfw ? { isNsfw: true } : {}) })
    .returning({ id: tags.id });
  return created.id;
}
