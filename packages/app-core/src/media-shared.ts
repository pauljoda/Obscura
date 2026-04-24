import { ilike } from "drizzle-orm";
import type { AppDb } from "@obscura/db";
import { schema } from "@obscura/db";

const { performers, studios, tags } = schema;

export type TxArg = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

export async function findOrCreateStudioId(
  tx: TxArg,
  studioName: string | null | undefined,
) {
  const trimmed = studioName?.trim() ?? "";
  if (!trimmed) return null;
  const [existing] = await tx
    .select({ id: studios.id })
    .from(studios)
    .where(ilike(studios.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(studios)
    .values({ name: trimmed })
    .returning({ id: studios.id });
  return created.id;
}

export async function findOrCreatePerformerId(tx: TxArg, name: string) {
  const trimmed = name.trim();
  const [existing] = await tx
    .select({ id: performers.id })
    .from(performers)
    .where(ilike(performers.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(performers)
    .values({ name: trimmed })
    .returning({ id: performers.id });
  return created.id;
}

export async function findOrCreateTagId(tx: TxArg, name: string) {
  const trimmed = name.trim();
  const [existing] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(ilike(tags.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(tags)
    .values({ name: trimmed })
    .returning({ id: tags.id });
  return created.id;
}
