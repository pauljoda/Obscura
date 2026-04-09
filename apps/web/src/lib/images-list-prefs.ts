export const IMAGES_LIST_PREFS_COOKIE = "obscura-images-list";
export const IMAGES_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

const PAGE_SIZE = 80;

export type ImageListSortKey = "recent" | "title" | "date" | "rating";

export interface ImagesListPrefsActiveFilter {
  label: string;
  type: string;
  value: string;
}

export interface ImagesListPrefs {
  sortBy: ImageListSortKey;
  sortDir: "asc" | "desc";
  search: string;
  activeFilters: ImagesListPrefsActiveFilter[];
}

const SORT_KEYS: readonly ImageListSortKey[] = ["recent", "title", "date", "rating"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseActiveFilters(raw: unknown): ImagesListPrefsActiveFilter[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ImagesListPrefsActiveFilter[] = [];
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

export function defaultImagesListPrefs(): ImagesListPrefs {
  return {
    sortBy: "recent",
    sortDir: "desc",
    search: "",
    activeFilters: [],
  };
}

export function isDefaultImagesListPrefs(p: ImagesListPrefs): boolean {
  const d = defaultImagesListPrefs();
  if (p.sortBy !== d.sortBy || p.sortDir !== d.sortDir || p.search !== d.search) return false;
  if (p.activeFilters.length !== d.activeFilters.length) return false;
  return p.activeFilters.every(
    (f, i) =>
      f.label === d.activeFilters[i]?.label &&
      f.type === d.activeFilters[i]?.type &&
      f.value === d.activeFilters[i]?.value,
  );
}

export function parseImagesListPrefs(raw: string | undefined): ImagesListPrefs | null {
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
  const sortBy = parsed.sortBy;
  const sortDir = parsed.sortDir;
  const search = parsed.search;
  const activeFilters = parseActiveFilters(parsed.activeFilters);
  if (typeof sortBy !== "string" || !SORT_KEYS.includes(sortBy as ImageListSortKey)) return null;
  if (sortDir !== "asc" && sortDir !== "desc") return null;
  if (typeof search !== "string" || search.length > 500) return null;
  if (activeFilters === null) return null;
  return {
    sortBy: sortBy as ImageListSortKey,
    sortDir,
    search,
    activeFilters,
  };
}

export function serializeImagesListPrefs(p: ImagesListPrefs): string {
  return encodeURIComponent(
    JSON.stringify({
      sortBy: p.sortBy,
      sortDir: p.sortDir,
      search: p.search,
      activeFilters: p.activeFilters,
    }),
  );
}

export function imagesListPrefsToFetchParams(
  p: ImagesListPrefs,
  nsfw: string,
): {
  search?: string;
  sort: string;
  order: "asc" | "desc";
  tag?: string[];
  performer?: string[];
  studio?: string;
  nsfw: string;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  resolution?: string;
  organized?: string;
  limit: number;
} {
  const tagFilters = p.activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
  const performerFilters = p.activeFilters.filter((f) => f.type === "performer").map((f) => f.value);
  const studioFilter = p.activeFilters.find((f) => f.type === "studio")?.value;
  const ratingMin = p.activeFilters.find((f) => f.type === "ratingMin")?.value;
  const ratingMax = p.activeFilters.find((f) => f.type === "ratingMax")?.value;
  const dateFrom = p.activeFilters.find((f) => f.type === "dateFrom")?.value;
  const dateTo = p.activeFilters.find((f) => f.type === "dateTo")?.value;
  const resolution = p.activeFilters.find((f) => f.type === "resolution")?.value;
  const organized = p.activeFilters.find((f) => f.type === "organized")?.value;

  const rm = ratingMin !== undefined ? Number(ratingMin) : NaN;
  const rmax = ratingMax !== undefined ? Number(ratingMax) : NaN;

  return {
    search: p.search.trim() || undefined,
    sort: p.sortBy,
    order: p.sortDir,
    tag: tagFilters.length > 0 ? tagFilters : undefined,
    performer: performerFilters.length > 0 ? performerFilters : undefined,
    studio: studioFilter,
    nsfw,
    ratingMin: Number.isInteger(rm) && rm >= 1 && rm <= 5 ? rm : undefined,
    ratingMax: Number.isInteger(rmax) && rmax >= 1 && rmax <= 5 ? rmax : undefined,
    dateFrom: dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : undefined,
    dateTo: dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : undefined,
    resolution: resolution && ["4K", "1080p", "720p", "480p"].includes(resolution) ? resolution : undefined,
    organized: organized === "true" || organized === "false" ? organized : undefined,
    limit: PAGE_SIZE,
  };
}

export function writeImagesListPrefsCookie(p: ImagesListPrefs): void {
  if (typeof document === "undefined") return;
  document.cookie = `${IMAGES_LIST_PREFS_COOKIE}=${serializeImagesListPrefs(p)};path=/;max-age=${IMAGES_LIST_PREFS_MAX_AGE};samesite=lax`;
}

export function clearImagesListPrefsCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${IMAGES_LIST_PREFS_COOKIE}=;path=/;max-age=0;samesite=lax`;
}
