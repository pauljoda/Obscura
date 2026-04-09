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

export function defaultGalleriesListPrefs(): GalleriesListPrefs {
  return {
    viewMode: "grid",
    sortBy: "recent",
    sortDir: "desc",
    search: "",
    activeFilters: [],
  };
}

export function isDefaultGalleriesListPrefs(p: GalleriesListPrefs): boolean {
  const d = defaultGalleriesListPrefs();
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

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

/** Parse cookie payload; returns `null` if missing or invalid. */
export function parseGalleriesListPrefs(raw: string | undefined): GalleriesListPrefs | null {
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
}

export function serializeGalleriesListPrefs(p: GalleriesListPrefs): string {
  return encodeURIComponent(
    JSON.stringify({
      viewMode: p.viewMode,
      sortBy: p.sortBy,
      sortDir: p.sortDir,
      search: p.search,
      activeFilters: p.activeFilters,
    }),
  );
}

/** Params for `fetchGalleries` (server or client) matching list prefs. */
export function galleriesListPrefsToFetchParams(p: GalleriesListPrefs): {
  search?: string;
  sort: string;
  order: "asc" | "desc";
  tag?: string[];
  studio?: string;
  type?: string;
  root?: string;
  limit: number;
} {
  const tagFilters = p.activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
  const studioFilter = p.activeFilters.find((f) => f.type === "studio")?.value;
  const typeFilter = p.activeFilters.find((f) => f.type === "type")?.value;

  return {
    search: p.search.trim() || undefined,
    sort: p.sortBy,
    order: p.sortDir,
    tag: tagFilters.length > 0 ? tagFilters : undefined,
    studio: studioFilter,
    type: typeFilter,
    root: p.viewMode === "browser" ? "all" : undefined,
    limit: p.viewMode === "browser" ? BROWSER_LIMIT : PAGE_SIZE,
  };
}

export function writeGalleriesListPrefsCookie(p: GalleriesListPrefs): void {
  if (typeof document === "undefined") return;
  document.cookie = `${GALLERIES_LIST_PREFS_COOKIE}=${serializeGalleriesListPrefs(p)};path=/;max-age=${GALLERIES_LIST_PREFS_MAX_AGE};samesite=lax`;
}

export function clearGalleriesListPrefsCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${GALLERIES_LIST_PREFS_COOKIE}=;path=/;max-age=0;samesite=lax`;
}
