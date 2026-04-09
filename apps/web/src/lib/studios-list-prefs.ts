import { createListPrefs } from "./list-prefs";

export const STUDIOS_LIST_PREFS_COOKIE = "obscura-studios-list";
export const STUDIOS_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

export type StudiosViewMode = "grid" | "list";

export interface StudiosListPrefs {
  search: string;
  sortDir: "asc" | "desc";
  viewMode: StudiosViewMode;
  minSceneCount: number;
  minRatingStars: number | null;
  favoritesOnly: boolean;
}

const studiosPrefs = createListPrefs<StudiosListPrefs>({
  cookieName: STUDIOS_LIST_PREFS_COOKIE,
  maxAge: STUDIOS_LIST_PREFS_MAX_AGE,
  defaults: () => ({
    search: "",
    sortDir: "asc",
    viewMode: "grid",
    minSceneCount: 0,
    minRatingStars: null,
    favoritesOnly: false,
  }),
  validate: (parsed) => {
    const search = parsed.search;
    const sortDir = parsed.sortDir;
    const viewMode = parsed.viewMode;
    if (typeof search !== "string" || search.length > 500) return null;
    if (sortDir !== "asc" && sortDir !== "desc") return null;
    if (viewMode !== "grid" && viewMode !== "list") return null;

    let minSceneCount = 0;
    if (parsed.minSceneCount !== undefined) {
      if (typeof parsed.minSceneCount !== "number" || !Number.isInteger(parsed.minSceneCount)) return null;
      if (parsed.minSceneCount < 0 || parsed.minSceneCount > 1_000_000) return null;
      minSceneCount = parsed.minSceneCount;
    }

    let minRatingStars: number | null = null;
    if (parsed.minRatingStars !== undefined && parsed.minRatingStars !== null) {
      if (typeof parsed.minRatingStars !== "number" || !Number.isInteger(parsed.minRatingStars)) return null;
      if (parsed.minRatingStars < 1 || parsed.minRatingStars > 5) return null;
      minRatingStars = parsed.minRatingStars;
    }

    let favoritesOnly = false;
    if (parsed.favoritesOnly !== undefined) {
      if (typeof parsed.favoritesOnly !== "boolean") return null;
      favoritesOnly = parsed.favoritesOnly;
    }

    return { search, sortDir, viewMode, minSceneCount, minRatingStars, favoritesOnly };
  },
});

// Re-export under original names for backward compatibility
export const defaultStudiosListPrefs = studiosPrefs.defaults;
export const isDefaultStudiosListPrefs = studiosPrefs.isDefault;
export const parseStudiosListPrefs = studiosPrefs.parse;
export const serializeStudiosListPrefs = studiosPrefs.serialize;
export const writeStudiosListPrefsCookie = studiosPrefs.writeCookie;
export const clearStudiosListPrefsCookie = studiosPrefs.clearCookie;
