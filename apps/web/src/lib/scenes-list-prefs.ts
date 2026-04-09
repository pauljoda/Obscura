import type { SortDir, SortOption, ViewMode } from "./scene-browse-types";

export const SCENES_LIST_PREFS_COOKIE = "obscura-scenes-list";
export const SCENES_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

const PAGE_SIZE = 50;

export interface ScenesListPrefsActiveFilter {
  label: string;
  type: string;
  value: string;
}

export interface ScenesListPrefs {
  viewMode: ViewMode;
  sortBy: SortOption;
  sortDir: SortDir;
  search: string;
  activeFilters: ScenesListPrefsActiveFilter[];
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseActiveFilters(raw: unknown): ScenesListPrefsActiveFilter[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ScenesListPrefsActiveFilter[] = [];
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

export function defaultScenesListPrefs(): ScenesListPrefs {
  return {
    viewMode: "grid",
    sortBy: "recent",
    sortDir: "desc",
    search: "",
    activeFilters: [],
  };
}

export function isDefaultScenesListPrefs(p: ScenesListPrefs): boolean {
  const d = defaultScenesListPrefs();
  if (p.viewMode !== d.viewMode || p.sortBy !== d.sortBy || p.sortDir !== d.sortDir || p.search !== d.search) {
    return false;
  }
  if (p.activeFilters.length !== d.activeFilters.length) return false;
  return p.activeFilters.every(
    (f, i) =>
      f.label === d.activeFilters[i]?.label &&
      f.type === d.activeFilters[i]?.type &&
      f.value === d.activeFilters[i]?.value,
  );
}

export function parseScenesListPrefs(raw: string | undefined): ScenesListPrefs | null {
  if (raw === undefined || raw === "") return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const viewMode = parsed.viewMode;
  const sortBy = parsed.sortBy;
  const sortDir = parsed.sortDir;
  const search = parsed.search;
  const activeFilters = parseActiveFilters(parsed.activeFilters);

  if (viewMode !== "grid" && viewMode !== "list") return null;
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
}

export function serializeScenesListPrefs(p: ScenesListPrefs): string {
  return encodeURIComponent(
    JSON.stringify({
      viewMode: p.viewMode,
      sortBy: p.sortBy,
      sortDir: p.sortDir,
      search: p.search,
      activeFilters: p.activeFilters,
      ...(p.activePresetId ? { activePresetId: p.activePresetId } : {}),
    }),
  );
}

const DURATION_PRESET_TO_API: Record<string, { durationMin?: number; durationMax?: number }> = {
  lt300: { durationMax: 300 },
  "300-900": { durationMin: 300, durationMax: 900 },
  "900-1800": { durationMin: 900, durationMax: 1800 },
  gte1800: { durationMin: 1800 },
};

export function scenesListPrefsToFetchParams(
  p: ScenesListPrefs,
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
  // codec is now extracted above as codecFilters

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

export function writeScenesListPrefsCookie(p: ScenesListPrefs): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SCENES_LIST_PREFS_COOKIE}=${serializeScenesListPrefs(p)};path=/;max-age=${SCENES_LIST_PREFS_MAX_AGE};samesite=lax`;
}

export function clearScenesListPrefsCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SCENES_LIST_PREFS_COOKIE}=;path=/;max-age=0;samesite=lax`;
}
