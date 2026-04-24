import { getUiPrefRead } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";

export function mergeUiPrefObject<T extends object>(
  defaults: T,
  value: unknown,
): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }
  return { ...defaults, ...(value as Partial<T>) };
}

export async function loadUiPrefObject<T extends object>(
  key: string,
  defaults: T,
): Promise<T> {
  const db = await getWebDb();
  const row = await getUiPrefRead(db, key).catch(() => null);
  return mergeUiPrefObject(defaults, row?.value);
}
