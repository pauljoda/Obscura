import { eq, sql } from "drizzle-orm";
import type { AppDb } from "@obscura/db";
import { NotFoundError } from "./errors";
import { findVideoEntity, videoEntityTable } from "./video-core";

export async function recordVideoPlayWrite(db: AppDb, id: string) {
  const entity = await findVideoEntity(db, id);
  if (!entity) throw new NotFoundError("Video not found");
  const table = videoEntityTable(entity.kind);
  await db
    .update(table)
    .set({
      playCount: sql`${table.playCount} + 1`,
      lastPlayedAt: new Date(),
    })
    .where(eq(table.id, id));
  return { ok: true as const };
}

export async function recordVideoOrgasmWrite(db: AppDb, id: string) {
  const entity = await findVideoEntity(db, id);
  if (!entity) throw new NotFoundError("Video not found");
  const table = videoEntityTable(entity.kind);
  const [updated] = await db
    .update(table)
    .set({
      orgasmCount: sql`${table.orgasmCount} + 1`,
    })
    .where(eq(table.id, id))
    .returning({ orgasmCount: table.orgasmCount });
  return { ok: true as const, orgasmCount: updated.orgasmCount };
}

