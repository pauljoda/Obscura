export const STUDIOS_LIST_PREFS_COOKIE = "obscura-studios-list";
export const STUDIOS_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

export type StudiosViewMode = "grid" | "list";

export interface StudiosListPrefs {
  search: string;
  sortDir: "asc" | "desc";
  viewMode: StudiosViewMode;
}

export function defaultStudiosListPrefs(): StudiosListPrefs {
  return {
    search: "",
    sortDir: "asc",
    viewMode: "grid",
  };
}

export function isDefaultStudiosListPrefs(p: StudiosListPrefs): boolean {
  const d = defaultStudiosListPrefs();
  return p.search === d.search && p.sortDir === d.sortDir && p.viewMode === d.viewMode;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseStudiosListPrefs(raw: string | undefined): StudiosListPrefs | null {
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
  const search = parsed.search;
  const sortDir = parsed.sortDir;
  const viewMode = parsed.viewMode;
  if (typeof search !== "string" || search.length > 500) return null;
  if (sortDir !== "asc" && sortDir !== "desc") return null;
  if (viewMode !== "grid" && viewMode !== "list") return null;
  return { search, sortDir, viewMode };
}

export function serializeStudiosListPrefs(p: StudiosListPrefs): string {
  return encodeURIComponent(JSON.stringify(p));
}

export function writeStudiosListPrefsCookie(p: StudiosListPrefs): void {
  if (typeof document === "undefined") return;
  document.cookie = `${STUDIOS_LIST_PREFS_COOKIE}=${serializeStudiosListPrefs(p)};path=/;max-age=${STUDIOS_LIST_PREFS_MAX_AGE};samesite=lax`;
}

export function clearStudiosListPrefsCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${STUDIOS_LIST_PREFS_COOKIE}=;path=/;max-age=0;samesite=lax`;
}
