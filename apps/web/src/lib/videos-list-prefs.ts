import { createListPrefs, isRecord } from "./list-prefs";
import type { SortDir, SortOption, ViewMode } from "./video-browse-types";

export const VIDEOS_LIST_PREFS_COOKIE = "obscura-scenes-list";
export const SCENES_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

const PAGE_SIZE = 50;

export interface VideosListPrefsActiveFilter {
  label: string;
  type: string;
  value: string;
}

export interface VideosListPrefs {
  viewMode: ViewMode;
  sortBy: SortOption;
  sortDir: SortDir;
  search: string;
  activeFilters: VideosListPrefsActiveFilter[];
  activePresetId?: string;
}

const SORT_OPTIONS: readonly SortOption[] = [
  "recent",
  "title",
  "duration",
  "size",
  "rating",
  "date",
  "plays",
];

function parseActiveFilters(raw: unknown): VideosListPrefsActiveFilter[] | null {
  if (!Array.isArray(raw)) return null;
  const out: VideosListPrefsActiveFilter[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const { label, type, value } = item;
    if (typeof label !== "string" || typeof type !== "string" || typeof value !== "string") return null;
    if (label.length > 200 || type.length > 64 || value.length > 200) return null;
    out.push({ label, type, value });
  }
  if (out.length > 80) return null;
  return out;
}

const scenesPrefs = createListPrefs<VideosListPrefs>({
  cookieName: VIDEOS_LIST_PREFS_COOKIE,
  maxAge: SCENES_LIST_PREFS_MAX_AGE,
  defaults: () => ({
    viewMode: "grid",
    sortBy: "recent",
    sortDir: "desc",
    search: "",
    activeFilters: [],
  }),
  validate: (parsed) => {
    const viewMode = parsed.viewMode;
    const sortBy = parsed.sortBy;
    const sortDir = parsed.sortDir;
    const search = parsed.search;
    const activeFilters = parseActiveFilters(parsed.activeFilters);

    if (viewMode !== "grid" && viewMode !== "list" && viewMode !== "folders") return null;
    if (typeof sortBy !== "string" || !SORT_OPTIONS.includes(sortBy as SortOption)) return null;
    if (sortDir !== "asc" && sortDir !== "desc") return null;
    if (typeof search !== "string" || search.length > 500) return null;
    if (activeFilters === null) return null;

    const activePresetId = typeof parsed.activePresetId === "string" ? parsed.activePresetId : undefined;

    return {
      viewMode,
      sortBy: sortBy as SortOption,
      sortDir,
      search,
      activeFilters,
      activePresetId,
    };
  },
});

// Re-export under original names for backward compatibility
export const defaultVideosListPrefs = scenesPrefs.defaults;
export const isDefaultVideosListPrefs = scenesPrefs.isDefault;
export const parseVideosListPrefs = scenesPrefs.parse;

export function serializeVideosListPrefs(p: VideosListPrefs): string {
  return scenesPrefs.serialize({
    ...p,
    // Strip activePresetId from serialization when not set (matches original behavior)
  });
}

export const writeVideosListPrefsCookie = scenesPrefs.writeCookie;
export const clearVideosListPrefsCookie = scenesPrefs.clearCookie;

const DURATION_PRESET_TO_API: Record<string, { durationMin?: number; durationMax?: number }> = {
  lt300: { durationMax: 300 },
  "300-900": { durationMin: 300, durationMax: 900 },
  "900-1800": { durationMin: 900, durationMax: 1800 },
  gte1800: { durationMin: 1800 },
};

export function videosListPrefsToFetchParams(
  p: VideosListPrefs,
  nsfw: string,
): {
  search?: string;
  sort: string;
  order: "asc" | "desc";
  tag?: string[];
  performer?: string[];
  resolution?: string[];
  studio?: string[];
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  durationMin?: number;
  durationMax?: number;
  organized?: string;
  interactive?: string;
  hasFile?: string;
  played?: string;
  codec?: string[];
  limit: number;
  nsfw: string;
} {
  const tagFilters = p.activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
  const performerFilters = p.activeFilters.filter((f) => f.type === "performer").map((f) => f.value);
  const resolutionFilters = p.activeFilters.filter((f) => f.type === "resolution").map((f) => f.value);
  const studioFilters = p.activeFilters.filter((f) => f.type === "studio").map((f) => f.value);
  const codecFilters = p.activeFilters.filter((f) => f.type === "codec").map((f) => f.value.toLowerCase());
  const ratingMin = p.activeFilters.find((f) => f.type === "ratingMin")?.value;
  const ratingMax = p.activeFilters.find((f) => f.type === "ratingMax")?.value;
  const dateFrom = p.activeFilters.find((f) => f.type === "dateFrom")?.value;
  const dateTo = p.activeFilters.find((f) => f.type === "dateTo")?.value;
  const durationPreset = p.activeFilters.find((f) => f.type === "duration")?.value;
  const organized = p.activeFilters.find((f) => f.type === "organized")?.value;
  const interactive = p.activeFilters.find((f) => f.type === "interactive")?.value;
  const hasFile = p.activeFilters.find((f) => f.type === "hasFile")?.value;
  const played = p.activeFilters.find((f) => f.type === "played")?.value;

  const dur =
    durationPreset && DURATION_PRESET_TO_API[durationPreset] ? DURATION_PRESET_TO_API[durationPreset] : {};

  const rm = ratingMin !== undefined ? Number(ratingMin) : NaN;
  const rmax = ratingMax !== undefined ? Number(ratingMax) : NaN;

  return {
    search: p.search.trim() || undefined,
    sort: p.sortBy,
    order: p.sortDir,
    tag: tagFilters.length > 0 ? tagFilters : undefined,
    performer: performerFilters.length > 0 ? performerFilters : undefined,
    resolution: resolutionFilters.length > 0 ? resolutionFilters : undefined,
    studio: studioFilters.length > 0 ? studioFilters : undefined,
    ratingMin: Number.isInteger(rm) && rm >= 1 && rm <= 5 ? rm : undefined,
    ratingMax: Number.isInteger(rmax) && rmax >= 1 && rmax <= 5 ? rmax : undefined,
    dateFrom: dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : undefined,
    dateTo: dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : undefined,
    durationMin: dur.durationMin,
    durationMax: dur.durationMax,
    organized: organized === "true" || organized === "false" ? organized : undefined,
    interactive: interactive === "true" || interactive === "false" ? interactive : undefined,
    hasFile: hasFile === "true" || hasFile === "false" ? hasFile : undefined,
    played: played === "true" || played === "false" ? played : undefined,
    codec: codecFilters.length > 0 ? codecFilters : undefined,
    limit: PAGE_SIZE,
    nsfw,
  };
}
