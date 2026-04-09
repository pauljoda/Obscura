export const TAGS_LIST_PREFS_COOKIE = "obscura-tags-list";
export const TAGS_LIST_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

export type TagsSortKey = "scenes" | "name";
export type TagsViewMode = "list" | "cloud";

export interface TagsListPrefs {
  search: string;
  sortKey: TagsSortKey;
  sortDir: "asc" | "desc";
  viewMode: TagsViewMode;
}

const SORT_KEYS: readonly TagsSortKey[] = ["scenes", "name"];

export function defaultTagsListPrefs(): TagsListPrefs {
  return {
    search: "",
    sortKey: "scenes",
    sortDir: "desc",
    viewMode: "list",
  };
}

export function isDefaultTagsListPrefs(p: TagsListPrefs): boolean {
  const d = defaultTagsListPrefs();
  return (
    p.search === d.search &&
    p.sortKey === d.sortKey &&
    p.sortDir === d.sortDir &&
    p.viewMode === d.viewMode
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseTagsListPrefs(raw: string | undefined): TagsListPrefs | null {
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
  let sortKey = parsed.sortKey;
  const sortDir = parsed.sortDir;
  const viewMode = parsed.viewMode;

  if (typeof search !== "string" || search.length > 500) return null;
  if (sortKey === "recent") sortKey = "scenes";
  if (typeof sortKey !== "string" || !SORT_KEYS.includes(sortKey as TagsSortKey)) return null;
  if (sortDir !== "asc" && sortDir !== "desc") return null;
  if (viewMode !== "list" && viewMode !== "cloud") return null;

  return {
    search,
    sortKey: sortKey as TagsSortKey,
    sortDir,
    viewMode,
  };
}

export function serializeTagsListPrefs(p: TagsListPrefs): string {
  return encodeURIComponent(JSON.stringify(p));
}

export function writeTagsListPrefsCookie(p: TagsListPrefs): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TAGS_LIST_PREFS_COOKIE}=${serializeTagsListPrefs(p)};path=/;max-age=${TAGS_LIST_PREFS_MAX_AGE};samesite=lax`;
}

export function clearTagsListPrefsCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TAGS_LIST_PREFS_COOKIE}=;path=/;max-age=0;samesite=lax`;
}
