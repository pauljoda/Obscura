/**
 * Server-side read/write for the ui_prefs table — a generic key/value
 * store the client uses to persist per-page view settings (thumbnail
 * size sliders, saved filter presets, etc.) across devices. The value
 * column is opaque JSON; the client defines the schema.
 */

import { eq } from "drizzle-orm";
import { schema, type AppDb } from "@obscura/db";

const { uiPrefs } = schema;

const KEY_MAX = 200;

export async function getUiPrefRead(
  db: AppDb,
  key: string,
): Promise<{ key: string; value: unknown } | null> {
  if (typeof key !== "string" || !key.length || key.length > KEY_MAX) {
    return null;
  }
  const [row] = await db
    .select({ key: uiPrefs.key, value: uiPrefs.value })
    .from(uiPrefs)
    .where(eq(uiPrefs.key, key))
    .limit(1);
  return row ?? null;
}

export async function setUiPrefWrite(
  db: AppDb,
  key: string,
  value: unknown,
): Promise<{ ok: true }> {
  if (typeof key !== "string" || !key.length || key.length > KEY_MAX) {
    throw new Error("Invalid key");
  }
  await db
    .insert(uiPrefs)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: uiPrefs.key,
      set: { value, updatedAt: new Date() },
    });
  return { ok: true as const };
}

export async function deleteUiPrefWrite(
  db: AppDb,
  key: string,
): Promise<{ ok: true }> {
  await db.delete(uiPrefs).where(eq(uiPrefs.key, key));
  return { ok: true as const };
}
