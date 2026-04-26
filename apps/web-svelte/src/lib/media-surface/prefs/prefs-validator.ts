/**
 * Schema-driven validator for SurfacePrefs<F>. Pages no longer hand-roll
 * a `validateXListPrefs(raw)` function for each route; instead the
 * surface config declares its viewModes, sortOptions, and filterSections,
 * and this validator enforces shape generically.
 *
 * Rejects-on-invalid (returns null) so callers fall back to
 * config.defaultPrefs.
 */

import type {
  ActiveFilter,
  FilterSectionSpec,
  MediaSurfaceConfig,
  SortDir,
  SurfacePrefs,
  ViewModeSpec,
} from "../config";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  if (value.length > max) return null;
  return value;
}

function parseActiveFilters<F extends string>(
  raw: unknown,
  allowedTypes: ReadonlySet<string>,
  max = 80,
): ActiveFilter<F>[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > max) return null;
  const out: ActiveFilter<F>[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const label = asString(item.label, 200);
    const type = asString(item.type, 64);
    const value = asString(item.value, 200);
    if (label === null || type === null || value === null) return null;
    if (allowedTypes.size > 0 && !allowedTypes.has(type)) {
      // unknown filter types get dropped, not reject the whole blob
      continue;
    }
    out.push({ type: type as F, label, value });
  }
  return out;
}

function modesFromConfig(viewModes?: ViewModeSpec[]): string[] {
  return viewModes?.map((m) => m.mode) ?? ["grid"];
}

function sortKeysFromConfig<T extends string>(
  sortOptions: { value: T }[],
): T[] {
  return sortOptions.map((o) => o.value);
}

function allowedFilterTypes<F extends string>(
  sections: FilterSectionSpec<F>[] | undefined,
): ReadonlySet<string> {
  if (!sections) return new Set();
  const out = new Set<string>();
  for (const s of sections) {
    out.add(s.filterType);
    // Range types can produce min/max child filters
    if (s.rangeTypes) {
      out.add(s.rangeTypes.min);
      out.add(s.rangeTypes.max);
    }
  }
  return out;
}

export function validateSurfacePrefs<F extends string>(
  config: Pick<
    MediaSurfaceConfig<{ id: string }, F>,
    "viewModes" | "sortOptions" | "filterSections" | "defaultPrefs" | "thumbSize"
  >,
  raw: unknown,
): SurfacePrefs<F> | null {
  if (!isRecord(raw)) return null;

  const allowedModes = new Set(modesFromConfig(config.viewModes));
  const allowedSorts = new Set(sortKeysFromConfig(config.sortOptions));
  const allowedFilters = allowedFilterTypes(config.filterSections);

  // viewMode falls back to default if invalid (don't reject the whole blob).
  const viewMode =
    typeof raw.viewMode === "string" && allowedModes.has(raw.viewMode)
      ? raw.viewMode
      : config.defaultPrefs.viewMode;

  const sortBy =
    typeof raw.sortBy === "string" && allowedSorts.has(raw.sortBy)
      ? raw.sortBy
      : config.defaultPrefs.sortBy;

  const sortDir: SortDir =
    raw.sortDir === "asc" || raw.sortDir === "desc"
      ? raw.sortDir
      : config.defaultPrefs.sortDir;

  const search = asString(raw.search, 500) ?? "";

  const activeFilters =
    parseActiveFilters<F>(raw.activeFilters, allowedFilters) ??
    config.defaultPrefs.activeFilters;

  const activePresetId =
    typeof raw.activePresetId === "string"
      ? raw.activePresetId
      : undefined;

  const defaultCols = config.thumbSize?.min ?? config.defaultPrefs.cols;
  const cols = (() => {
    if (typeof raw.cols !== "number" || !Number.isFinite(raw.cols)) return defaultCols;
    if (!config.thumbSize) return raw.cols > 0 ? raw.cols : defaultCols;
    return Math.min(config.thumbSize.max, Math.max(config.thumbSize.min, raw.cols));
  })();

  const extras = isRecord(raw.extras)
    ? (raw.extras as SurfacePrefs<F>["extras"])
    : config.defaultPrefs.extras;

  return {
    viewMode,
    sortBy,
    sortDir,
    search,
    activeFilters,
    activePresetId,
    cols,
    extras,
  };
}
