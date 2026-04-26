/**
 * DB-backed reactive prefs for one MediaSurface. Wraps the existing
 * `createServerPrefs` storage layer with surface-aware key derivation
 * (`surface:${surfaceId}:prefs`) and a one-time legacy-key fallback so
 * users don't lose `videos:listPrefs` on the migration.
 */

import { fetchApi } from "$lib/api/core";
import { createServerPrefs, type ServerPrefs } from "$lib/server-prefs.svelte";
import { validateSurfacePrefs } from "./prefs-validator";
import type { MediaSurfaceConfig, SurfacePrefs } from "../config";

export interface CreateSurfacePrefsOptions<F extends string> {
  config: Pick<
    MediaSurfaceConfig<{ id: string }, F>,
    "surfaceId" | "defaultPrefs" | "filterSections" | "sortOptions" | "viewModes" | "thumbSize"
  >;
  /** Server-loaded snapshot from the page's load function. */
  initial?: Partial<SurfacePrefs<F>> | null;
  /**
   * Optional legacy key to read once and migrate from. If the surface
   * key is empty/missing on first load and this key has a value, the
   * value is copied to the surface key and the legacy key is left
   * alone (best-effort, single read). Drop after one release cycle.
   */
  legacyKey?: string;
}

export function surfacePrefsKey(surfaceId: string): string {
  return `surface:${surfaceId}:prefs`;
}

export function surfacePresetsKey(surfaceId: string): string {
  return `surface:${surfaceId}:presets`;
}

interface LegacyResponse<T> {
  key: string;
  value: T | null;
}

export function createSurfacePrefs<F extends string>(
  opts: CreateSurfacePrefsOptions<F>,
): ServerPrefs<SurfacePrefs<F>> {
  const key = surfacePrefsKey(opts.config.surfaceId);
  const defaultPrefs: SurfacePrefs<F> = {
    ...opts.config.defaultPrefs,
    cols: opts.config.thumbSize?.min ?? opts.config.defaultPrefs.cols,
  };
  const validationConfig = { ...opts.config, defaultPrefs };

  const initial = opts.initial
    ? (validateSurfacePrefs<F>(validationConfig, opts.initial) ??
        defaultPrefs)
    : null;

  const prefs = createServerPrefs<SurfacePrefs<F>>(
    key,
    defaultPrefs,
    initial,
    (raw) => validateSurfacePrefs<F>(validationConfig, raw),
  );

  // Best-effort one-time migration from a legacy DB key. We don't gate
  // the surface load on this; if it fails or the legacy value is
  // invalid, we silently fall back to defaults.
  if (opts.legacyKey && typeof window !== "undefined") {
    void (async () => {
      try {
        const surfaceRow = await fetchApi<LegacyResponse<unknown>>(
          `/ui-prefs/${encodeURIComponent(key)}`,
        );
        if (surfaceRow.value) return; // surface key already populated
        const legacyRow = await fetchApi<LegacyResponse<unknown>>(
          `/ui-prefs/${encodeURIComponent(opts.legacyKey!)}`,
        );
        if (!legacyRow.value) return;
        const validated = validateSurfacePrefs<F>(validationConfig, legacyRow.value);
        if (!validated) return;
        prefs.set(validated);
      } catch {
        // ignore — defaults stand
      }
    })();
  }

  return prefs;
}
