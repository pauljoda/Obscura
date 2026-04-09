export const PERFORMERS_LIST_PREFS_COOKIE = "obscura-performers-list";
export const PERFORMERS_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

const PAGE_SIZE = 50;

export type PerformersViewMode = "grid" | "list";
export type PerformersSortKey = "name" | "scenes" | "rating" | "recent";

export interface PerformersListPrefs {
  viewMode: PerformersViewMode;
  search: string;
  sortKey: PerformersSortKey;
  sortDir: "asc" | "desc";
  gender: string;
  favoriteOnly: boolean;
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

export function defaultPerformersListPrefs(): PerformersListPrefs {
  return {
    viewMode: "grid",
    search: "",
    sortKey: "scenes",
    sortDir: "desc",
    gender: "",
    favoriteOnly: false,
  };
}

export function isDefaultPerformersListPrefs(p: PerformersListPrefs): boolean {
  return JSON.stringify(p) === JSON.stringify(defaultPerformersListPrefs());
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

  return {
    viewMode,
    search,
    sortKey: sortKey as PerformersSortKey,
    sortDir,
    gender,
    favoriteOnly,
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
