import { createListPrefs } from "./list-prefs";

export const TAGS_LIST_PREFS_COOKIE = "obscura-tags-list";
export const TAGS_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

export type TagsSortKey = "scenes" | "name";
export type TagsViewMode = "list" | "cloud";

export interface TagsListPrefs {
  search: string;
  sortKey: TagsSortKey;
  sortDir: "asc" | "desc";
  viewMode: TagsViewMode;
  /** Minimum combined scene + image usage; 0 disables. */
  minTotalUsage: number;
  /** Minimum star rating when set (1-5). */
  minRatingStars: number | null;
  favoritesOnly: boolean;
}

const SORT_KEYS: readonly TagsSortKey[] = ["scenes", "name"];

const tagsPrefs = createListPrefs<TagsListPrefs>({
  cookieName: TAGS_LIST_PREFS_COOKIE,
  maxAge: TAGS_LIST_PREFS_MAX_AGE,
  defaults: () => ({
    search: "",
    sortKey: "scenes",
    sortDir: "desc",
    viewMode: "list",
    minTotalUsage: 0,
    minRatingStars: null,
    favoritesOnly: false,
  }),
  validate: (parsed) => {
    const search = parsed.search;
    let sortKey = parsed.sortKey;
    const sortDir = parsed.sortDir;
    const viewMode = parsed.viewMode;

    if (typeof search !== "string" || search.length > 500) return null;
    if (sortKey === "recent") sortKey = "scenes";
    if (typeof sortKey !== "string" || !SORT_KEYS.includes(sortKey as TagsSortKey)) return null;
    if (sortDir !== "asc" && sortDir !== "desc") return null;
    if (viewMode !== "list" && viewMode !== "cloud") return null;

    let minTotalUsage = 0;
    if (parsed.minTotalUsage !== undefined) {
      if (typeof parsed.minTotalUsage !== "number" || !Number.isInteger(parsed.minTotalUsage)) return null;
      if (parsed.minTotalUsage < 0 || parsed.minTotalUsage > 1_000_000) return null;
      minTotalUsage = parsed.minTotalUsage;
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

    return {
      search,
      sortKey: sortKey as TagsSortKey,
      sortDir,
      viewMode,
      minTotalUsage,
      minRatingStars,
      favoritesOnly,
    };
  },
});

// Re-export under original names for backward compatibility
export const defaultTagsListPrefs = tagsPrefs.defaults;
export const isDefaultTagsListPrefs = tagsPrefs.isDefault;
export const parseTagsListPrefs = tagsPrefs.parse;
export const serializeTagsListPrefs = tagsPrefs.serialize;
export const writeTagsListPrefsCookie = tagsPrefs.writeCookie;
export const clearTagsListPrefsCookie = tagsPrefs.clearCookie;
