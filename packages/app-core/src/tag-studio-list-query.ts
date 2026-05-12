import type { StudioListEntry } from "./studio-reads";
import type { TagListEntry } from "./tag-reads";

export interface TagStudioListQuery {
  search?: string | null;
  sort?: string | null;
  order?: string | null;
  favorite?: string | null;
  hasImage?: string | null;
  ratingMin?: string | null;
  limit?: string | null;
  offset?: string | null;
  nsfw?: string | null;
  randomSeed?: string | null;
}

interface PageMeta {
  total: number;
  limit: number;
  offset: number;
}

const MAX_LIMIT = 2_000;

function totalTagUsage(row: TagListEntry): number {
  return (
    (row.videoCount ?? 0) +
    (row.galleryCount ?? 0) +
    (row.imageCount ?? 0) +
    (row.audioTrackCount ?? 0)
  );
}

function textMatches(query: string, values: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((value) => value?.toLowerCase().includes(q));
}

function parseBool(value: string | null | undefined): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseRatingMin(value: string | null | undefined): number | null {
  const parsed = value != null ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function page<T>(rows: T[], query: TagStudioListQuery): { rows: T[] } & PageMeta {
  const total = rows.length;
  const requestedLimit = query.limit != null ? Number(query.limit) : total;
  const requestedOffset = query.offset != null ? Number(query.offset) : 0;
  const limit = Math.max(
    0,
    Math.min(
      Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : total,
      MAX_LIMIT,
    ),
  );
  const offset = Math.max(
    0,
    Number.isFinite(requestedOffset) ? Math.trunc(requestedOffset) : 0,
  );
  return { rows: rows.slice(offset, offset + limit), total, limit, offset };
}

function hashSortValue(value: string, seed = ""): number {
  let hash = 2166136261;
  const input = `${seed}:${value}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sortDir(query: TagStudioListQuery, fallback: "asc" | "desc") {
  return query.order === "asc" || query.order === "desc" ? query.order : fallback;
}

export function applyTagListQuery(
  rows: TagListEntry[],
  query: TagStudioListQuery = {},
): { tags: TagListEntry[] } & PageMeta {
  const favorite = parseBool(query.favorite);
  const hasImage = parseBool(query.hasImage);
  const ratingMin = parseRatingMin(query.ratingMin);

  const filtered = rows.filter((row) => {
    if (query.nsfw === "off" && row.isNsfw) return false;
    if (!textMatches(query.search ?? "", [row.name, row.description, row.aliases])) return false;
    if (favorite != null && row.favorite !== favorite) return false;
    if (hasImage != null && Boolean(row.imagePath) !== hasImage) return false;
    if (ratingMin != null && (row.rating ?? 0) < ratingMin) return false;
    return true;
  });

  const sort = query.sort ?? "videos";
  const dir = sortDir(query, sort === "name" ? "asc" : "desc");
  const sign = dir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "name":
        return sign * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      case "rating":
        return sign * ((a.rating ?? 0) - (b.rating ?? 0));
      case "randomized":
        return (
          hashSortValue(a.id, query.randomSeed ?? "") -
          hashSortValue(b.id, query.randomSeed ?? "")
        );
      case "usage":
      case "videos":
      default: {
        const usage = sign * (totalTagUsage(a) - totalTagUsage(b));
        return usage === 0
          ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          : usage;
      }
    }
  });

  const result = page(sorted, query);
  return { tags: result.rows, total: result.total, limit: result.limit, offset: result.offset };
}

export function applyStudioListQuery(
  rows: StudioListEntry[],
  query: TagStudioListQuery = {},
): { studios: StudioListEntry[] } & PageMeta {
  const favorite = parseBool(query.favorite);
  const hasImage = parseBool(query.hasImage);
  const ratingMin = parseRatingMin(query.ratingMin);

  const filtered = rows.filter((row) => {
    if (query.nsfw === "off" && row.isNsfw) return false;
    if (!textMatches(query.search ?? "", [row.name, row.description, row.aliases])) return false;
    if (favorite != null && row.favorite !== favorite) return false;
    if (hasImage != null && Boolean(row.imagePath || row.imageUrl) !== hasImage) return false;
    if (ratingMin != null && (row.rating ?? 0) < ratingMin) return false;
    return true;
  });

  const sort = query.sort ?? "name";
  const dir = sortDir(query, sort === "name" ? "asc" : "desc");
  const sign = dir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "videoCount":
      case "videos":
        return sign * ((a.videoCount ?? 0) - (b.videoCount ?? 0));
      case "rating":
        return sign * ((a.rating ?? 0) - (b.rating ?? 0));
      case "randomized":
        return (
          hashSortValue(a.id, query.randomSeed ?? "") -
          hashSortValue(b.id, query.randomSeed ?? "")
        );
      case "name":
      default:
        return sign * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
  });

  const result = page(sorted, query);
  return {
    studios: result.rows,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}
