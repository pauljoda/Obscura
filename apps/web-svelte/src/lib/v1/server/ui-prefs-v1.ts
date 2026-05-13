import { getUiPrefRead } from "@obscura/app-core";
import {
  formFactorUiPrefKey,
  type FormFactorUiPrefs,
  type UiPrefsFormFactor,
} from "$lib/prefs/form-factor-prefs";
import { getWebDb } from "$lib/v1/server/db-v1";

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

export async function loadFormFactorUiPrefObjects<T extends object>(
  baseKey: string,
  defaults: T,
  suffix = "",
): Promise<FormFactorUiPrefs<T>> {
  const db = await getWebDb();
  const legacyRow = await getUiPrefRead(db, `${baseKey}${suffix}`).catch(() => null);
  const legacyValue = legacyRow?.value;
  const entries = await Promise.all(
    (["mobile", "desktop"] as const).map(async (formFactor) => {
      const scopedKey = formFactorUiPrefKey(baseKey, formFactor, suffix);
      const row = await getUiPrefRead(db, scopedKey).catch(() => null);
      return [
        formFactor,
        mergeUiPrefObject(defaults, row?.value ?? legacyValue),
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as FormFactorUiPrefs<T>;
}

export function pickFormFactorUiPrefObject<T>(
  prefs: FormFactorUiPrefs<T>,
  formFactor: UiPrefsFormFactor,
): T | undefined {
  return prefs[formFactor] ?? prefs.desktop ?? prefs.mobile;
}
