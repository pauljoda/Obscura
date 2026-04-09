import { createListPrefs } from "./list-prefs";

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

const performersPrefs = createListPrefs<PerformersListPrefs>({
  cookieName: PERFORMERS_LIST_PREFS_COOKIE,
  maxAge: PERFORMERS_LIST_PREFS_MAX_AGE,
  defaults: () => ({
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
  }),
  validate: (parsed) => {
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
  },
});

// Re-export under original names for backward compatibility
export const defaultPerformersListPrefs = performersPrefs.defaults;
export const isDefaultPerformersListPrefs = performersPrefs.isDefault;
export const parsePerformersListPrefs = performersPrefs.parse;
export const serializePerformersListPrefs = performersPrefs.serialize;
export const writePerformersListPrefsCookie = performersPrefs.writeCookie;
export const clearPerformersListPrefsCookie = performersPrefs.clearCookie;

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
