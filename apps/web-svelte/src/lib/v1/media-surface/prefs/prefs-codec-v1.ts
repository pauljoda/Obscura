/**
 * Translate SurfacePrefs<F> into the API query-params object the
 * fetcher receives. Most filter-section kinds have a built-in encoder;
 * sections with custom encoding (e.g. the videos `duration` preset
 * which maps "lt300" → durationMax: 300) supply their own `encode`.
 */

import type {
  ActiveFilter,
  FilterSectionSpec,
  SurfacePrefs,
} from "../config-v1";

function appendEnumValue(
  params: Record<string, unknown>,
  key: string,
  value: string,
) {
  const existing = params[key];
  if (existing === undefined) {
    params[key] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    params[key] = [existing as string, value];
  }
}

function defaultEncode<F extends string>(
  section: FilterSectionSpec<F>,
  filter: ActiveFilter<F>,
  params: Record<string, unknown>,
) {
  switch (section.kind) {
    case "enum":
      appendEnumValue(params, section.filterType, filter.value);
      return;
    case "alphabetical-id-list":
      appendEnumValue(params, section.filterType, filter.value);
      return;
    case "rating":
    case "range": {
      // The activeFilter type is one of the bracket types (min/max),
      // not the section's filterType. Just pass it through verbatim.
      const n = Number(filter.value);
      if (Number.isFinite(n)) params[filter.type] = n;
      return;
    }
    case "date-range":
      params[filter.type] = filter.value;
      return;
  }
}

export interface EncodePrefsOptions<F extends string> {
  filterSections?: FilterSectionSpec<F>[];
  /** Extra fields written into the params before filter encoding (e.g. nsfw). */
  base?: Record<string, unknown>;
}

export function encodeSurfacePrefs<F extends string>(
  prefs: SurfacePrefs<F>,
  opts: EncodePrefsOptions<F> = {},
): Record<string, unknown> {
  const params: Record<string, unknown> = { ...(opts.base ?? {}) };

  // Search / sort
  const search = prefs.search.trim();
  if (search) params.search = search;
  if (prefs.sortBy) params.sort = prefs.sortBy;
  if (prefs.sortDir) params.order = prefs.sortDir;

  // Look up the section for each active filter — the filter's `type`
  // may match the section's `filterType` directly, or one of the
  // section's `rangeTypes.{min,max}` for range/date-range/rating.
  const sections = opts.filterSections ?? [];
  const sectionByType = new Map<string, FilterSectionSpec<F>>();
  for (const s of sections) {
    sectionByType.set(s.filterType, s);
    if (s.rangeTypes) {
      sectionByType.set(s.rangeTypes.min, s);
      sectionByType.set(s.rangeTypes.max, s);
    }
  }

  // Group multi-select filters so we hand them to encoders as arrays.
  const grouped = new Map<F, ActiveFilter<F>[]>();
  for (const f of prefs.activeFilters) {
    const arr = grouped.get(f.type);
    if (arr) arr.push(f);
    else grouped.set(f.type, [f]);
  }

  for (const [type, filters] of grouped) {
    const section = sectionByType.get(type);
    if (!section) {
      // Unknown filter type — best-effort: write its value(s) under the type key.
      if (filters.length === 1) params[type] = filters[0].value;
      else params[type] = filters.map((f) => f.value);
      continue;
    }

    if (section.encode) {
      const value = filters.length === 1 ? filters[0].value : filters.map((f) => f.value);
      section.encode(value, params);
      continue;
    }

    for (const f of filters) {
      defaultEncode(section, f, params);
    }
  }

  return params;
}
