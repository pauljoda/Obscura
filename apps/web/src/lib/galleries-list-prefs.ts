import { createListPrefs, isRecord } from "./list-prefs";
import type { GallerySortOption, GalleryViewMode, SortDir } from "./gallery-browse-types";

export const GALLERIES_LIST_PREFS_COOKIE = "obscura-galleries-list";
export const GALLERIES_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const PAGE_SIZE = 60;
const BROWSER_LIMIT = 2000;

export interface GalleryListPrefsActiveFilter {
  label: string;
  type: string;
  value: string;
}

export interface GalleriesListPrefs {
  viewMode: GalleryViewMode;
  sortBy: GallerySortOption;
  sortDir: SortDir;
  search: string;
  activeFilters: GalleryListPrefsActiveFilter[];
}

const SORT_OPTIONS: readonly GallerySortOption[] = [
  "recent",
  "title",
  "date",
  "rating",
  "imageCount",
  "created",
];

const VIEW_MODES: readonly GalleryViewMode[] = ["grid", "list", "browser", "timeline"];

function parseActiveFilters(raw: unknown): GalleryListPrefsActiveFilter[] | null {
  if (!Array.isArray(raw)) return null;
  const out: GalleryListPrefsActiveFilter[] = [];
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

const galleriesPrefs = createListPrefs<GalleriesListPrefs>({
  cookieName: GALLERIES_LIST_PREFS_COOKIE,
  maxAge: GALLERIES_LIST_PREFS_MAX_AGE,
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

    if (typeof viewMode !== "string" || !VIEW_MODES.includes(viewMode as GalleryViewMode)) return null;
    if (typeof sortBy !== "string" || !SORT_OPTIONS.includes(sortBy as GallerySortOption)) return null;
    if (sortDir !== "asc" && sortDir !== "desc") return null;
    if (typeof search !== "string" || search.length > 500) return null;
    if (activeFilters === null) return null;

    return {
      viewMode: viewMode as GalleryViewMode,
      sortBy: sortBy as GallerySortOption,
      sortDir,
      search,
      activeFilters,
    };
  },
});

// Re-export under original names for backward compatibility
export const defaultGalleriesListPrefs = galleriesPrefs.defaults;
export const isDefaultGalleriesListPrefs = galleriesPrefs.isDefault;
export const parseGalleriesListPrefs = galleriesPrefs.parse;
export const serializeGalleriesListPrefs = galleriesPrefs.serialize;
export const writeGalleriesListPrefsCookie = galleriesPrefs.writeCookie;
export const clearGalleriesListPrefsCookie = galleriesPrefs.clearCookie;

/** Params for `fetchGalleries` (server or client) matching list prefs. */
export function galleriesListPrefsToFetchParams(p: GalleriesListPrefs): {
  search?: string;
  sort: string;
  order: "asc" | "desc";
  tag?: string[];
  studio?: string;
  type?: string;
  root?: string;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  imageCountMin?: number;
  organized?: string;
  limit: number;
} {
  const tagFilters = p.activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
  const studioFilter = p.activeFilters.find((f) => f.type === "studio")?.value;
  const typeFilter = p.activeFilters.find((f) => f.type === "type")?.value;
  const ratingMin = p.activeFilters.find((f) => f.type === "ratingMin")?.value;
  const ratingMax = p.activeFilters.find((f) => f.type === "ratingMax")?.value;
  const dateFrom = p.activeFilters.find((f) => f.type === "dateFrom")?.value;
  const dateTo = p.activeFilters.find((f) => f.type === "dateTo")?.value;
  const imageCountMin = p.activeFilters.find((f) => f.type === "imageCountMin")?.value;
  const organized = p.activeFilters.find((f) => f.type === "organized")?.value;

  const rm = ratingMin !== undefined ? Number(ratingMin) : NaN;
  const rmax = ratingMax !== undefined ? Number(ratingMax) : NaN;
  const icm = imageCountMin !== undefined ? Number(imageCountMin) : NaN;

  return {
    search: p.search.trim() || undefined,
    sort: p.sortBy,
    order: p.sortDir,
    tag: tagFilters.length > 0 ? tagFilters : undefined,
    studio: studioFilter,
    type: typeFilter,
    root: p.viewMode === "browser" ? "all" : undefined,
    ratingMin: Number.isInteger(rm) && rm >= 1 && rm <= 5 ? rm : undefined,
    ratingMax: Number.isInteger(rmax) && rmax >= 1 && rmax <= 5 ? rmax : undefined,
    dateFrom: dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : undefined,
    dateTo: dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : undefined,
    imageCountMin: Number.isInteger(icm) && icm >= 1 ? icm : undefined,
    organized: organized === "true" || organized === "false" ? organized : undefined,
    limit: p.viewMode === "browser" ? BROWSER_LIMIT : PAGE_SIZE,
  };
}
