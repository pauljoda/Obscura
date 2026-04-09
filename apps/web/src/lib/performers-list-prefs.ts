export const PERFORMERS_LIST_PREFS_COOKIE = "obscura-performers-list";
export const PERFORMERS_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

const PAGE_SIZE = 50;

export type PerformersViewMode = "grid" | "list";
export type PerformersSortKey = "name" | "scenes" | "rating" | "recent";
export type PerformersPhotoFilter = "all" | "with" | "without";

export interface PerformersListPrefs {
  viewMode: PerformersViewMode;
  search: string;
  sortKey: PerformersSortKey;
  sortDir: "asc" | "desc";
  gender: string;
  favoriteOnly: boolean;
  minRating: number | null;
  maxRating: number | null;
  photoFilter: PerformersPhotoFilter;
  minSceneCount: number | null;
}

const SORT_KEYS: readonly PerformersSortKey[] = ["name", "scenes", "rating", "recent"];

const ALLOWED_GENDER = new Set([
  "",
  "Female",
  "Male",
  "Transgender Female",
  "Transgender Male",
  "Non-Binary",
]);

function parseRating(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) return null;
  return v;
}

function parseSceneCountMin(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return null;
  return v;
}

export function defaultPerformersListPrefs(): PerformersListPrefs {
  return {
    viewMode: "grid",
    search: "",
    sortKey: "scenes",
    sortDir: "desc",
    gender: "",
    favoriteOnly: false,
    minRating: null,
    maxRating: null,
    photoFilter: "all",
    minSceneCount: null,
  };
}

export function isDefaultPerformersListPrefs(p: PerformersListPrefs): boolean {
  const d = defaultPerformersListPrefs();
  return (
    p.viewMode === d.viewMode &&
    p.search === d.search &&
    p.sortKey === d.sortKey &&
    p.sortDir === d.sortDir &&
    p.gender === d.gender &&
    p.favoriteOnly === d.favoriteOnly &&
    p.minRating === d.minRating &&
    p.maxRating === d.maxRating &&
    p.photoFilter === d.photoFilter &&
    p.minSceneCount === d.minSceneCount
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parsePerformersListPrefs(raw: string | undefined): PerformersListPrefs | null {
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
  const search = parsed.search;
  const sortKey = parsed.sortKey;
  const sortDir = parsed.sortDir;
  const gender = parsed.gender;
  const favoriteOnly = parsed.favoriteOnly;

  if (viewMode !== "grid" && viewMode !== "list") return null;
  if (typeof search !== "string" || search.length > 500) return null;
  if (typeof sortKey !== "string" || !SORT_KEYS.includes(sortKey as PerformersSortKey)) return null;
  if (sortDir !== "asc" && sortDir !== "desc") return null;
  if (typeof gender !== "string" || !ALLOWED_GENDER.has(gender)) return null;
  if (typeof favoriteOnly !== "boolean") return null;

  const minRating = parseRating(parsed.minRating);
  const maxRating = parseRating(parsed.maxRating);
  if (parsed.minRating !== undefined && parsed.minRating !== null && minRating === null) return null;
  if (parsed.maxRating !== undefined && parsed.maxRating !== null && maxRating === null) return null;

  let photoFilter: PerformersPhotoFilter = "all";
  if (parsed.photoFilter === "with" || parsed.photoFilter === "without" || parsed.photoFilter === "all") {
    photoFilter = parsed.photoFilter;
  } else if (parsed.photoFilter !== undefined) {
    return null;
  }

  const minSceneCount = parseSceneCountMin(parsed.minSceneCount);
  if (
    parsed.minSceneCount !== undefined &&
    parsed.minSceneCount !== null &&
    minSceneCount === null
  ) {
    return null;
  }

  return {
    viewMode,
    search,
    sortKey: sortKey as PerformersSortKey,
    sortDir,
    gender,
    favoriteOnly,
    minRating: minRating ?? null,
    maxRating: maxRating ?? null,
    photoFilter,
    minSceneCount: minSceneCount ?? null,
  };
}

export function serializePerformersListPrefs(p: PerformersListPrefs): string {
  return encodeURIComponent(JSON.stringify(p));
}

export function performersListPrefsToFetchParams(
  p: PerformersListPrefs,
  nsfw: string,
): {
  search?: string;
  sort: string;
  order: "asc" | "desc";
  gender?: string;
  favorite?: string;
  ratingMin?: number;
  ratingMax?: number;
  hasImage?: string;
  sceneCountMin?: number;
  limit: number;
  offset: number;
  nsfw: string;
} {
  return {
    search: p.search.trim() || undefined,
    sort: p.sortKey,
    order: p.sortDir,
    gender: p.gender || undefined,
    favorite: p.favoriteOnly ? "true" : undefined,
    ratingMin: p.minRating ?? undefined,
    ratingMax: p.maxRating ?? undefined,
    hasImage:
      p.photoFilter === "with" ? "true" : p.photoFilter === "without" ? "false" : undefined,
    sceneCountMin: p.minSceneCount ?? undefined,
    limit: PAGE_SIZE,
    offset: 0,
    nsfw,
  };
}

export function writePerformersListPrefsCookie(p: PerformersListPrefs): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PERFORMERS_LIST_PREFS_COOKIE}=${serializePerformersListPrefs(p)};path=/;max-age=${PERFORMERS_LIST_PREFS_MAX_AGE};samesite=lax`;
}

export function clearPerformersListPrefsCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PERFORMERS_LIST_PREFS_COOKIE}=;path=/;max-age=0;samesite=lax`;
}
