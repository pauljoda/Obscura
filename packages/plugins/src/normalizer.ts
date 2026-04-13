/**
 * Normalizers for all entity result types.
 *
 * Each normalizer takes a raw result object (from a plugin's stdout or TS return)
 * and produces a validated, trimmed, deduplicated result.
 */

import type {
  NormalizedVideoResult,
  NormalizedFolderResult,
  NormalizedGalleryResult,
  NormalizedImageResult,
  NormalizedAudioTrackResult,
  NormalizedAudioLibraryResult,
  NormalizedSeriesRef,
  EpisodeMapping,
} from "./types";

// ─── Utility helpers ───────────────────────────────────────────────

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toUrlArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(
        (v) =>
          v.startsWith("http://") ||
          v.startsWith("https://") ||
          v.startsWith("data:"),
      );
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:")
    ) {
      return [trimmed];
    }
  }
  return [];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(trimmed);
  }
  return result;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function trimToUrl(value: unknown): string | null {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }
  return null;
}

// ─── Video Result Normalizer ───────────────────────────────────────

export function normalizeVideoResult(
  raw: Record<string, unknown>,
): NormalizedVideoResult {
  let series: NormalizedSeriesRef | null = null;
  if (raw.series && typeof raw.series === "object") {
    const s = raw.series as Record<string, unknown>;
    const name = trimOrNull(s.name);
    if (name) {
      series = {
        name,
        externalId: trimOrNull(s.externalId) ?? undefined,
        season: toNumber(s.season) ?? undefined,
        episode: toNumber(s.episode) ?? undefined,
      };
    }
  }

  return {
    title: trimOrNull(raw.title),
    date: trimOrNull(raw.date),
    details: trimOrNull(raw.details),
    urls: toUrlArray(raw.urls ?? raw.url),
    studioName: trimOrNull(raw.studioName ?? raw.studio),
    performerNames: toStringArray(raw.performerNames ?? raw.performers),
    tagNames: toStringArray(raw.tagNames ?? raw.tags),
    imageUrl: trimToUrl(raw.imageUrl ?? raw.image),
    episodeNumber: toNumber(raw.episodeNumber ?? raw.episode_number),
    series,
    code: trimOrNull(raw.code),
    director: trimOrNull(raw.director),
  };
}

export function hasUsableVideoResult(result: NormalizedVideoResult): boolean {
  return Boolean(
    result.title ||
      result.date ||
      result.details ||
      result.urls.length > 0 ||
      result.studioName ||
      result.imageUrl ||
      result.performerNames.length > 0 ||
      result.tagNames.length > 0 ||
      result.episodeNumber != null,
  );
}

// ─── Folder Result Normalizer ──────────────────────────────────────

export function normalizeFolderResult(
  raw: Record<string, unknown>,
): NormalizedFolderResult {
  let episodeMap: Record<string, EpisodeMapping> | undefined;
  if (raw.episodeMap && typeof raw.episodeMap === "object") {
    episodeMap = {};
    for (const [key, val] of Object.entries(
      raw.episodeMap as Record<string, unknown>,
    )) {
      if (!val || typeof val !== "object") continue;
      const ep = val as Record<string, unknown>;
      episodeMap[key] = {
        episodeNumber: toNumber(ep.episodeNumber) ?? 0,
        seasonNumber: toNumber(ep.seasonNumber) ?? 0,
        title: trimOrNull(ep.title),
        date: trimOrNull(ep.date),
        details: trimOrNull(ep.details),
      };
    }
  }

  return {
    name: trimOrNull(raw.name ?? raw.title),
    details: trimOrNull(raw.details),
    date: trimOrNull(raw.date),
    imageUrl: trimToUrl(raw.imageUrl ?? raw.image),
    backdropUrl: trimToUrl(raw.backdropUrl ?? raw.backdrop),
    studioName: trimOrNull(raw.studioName ?? raw.studio),
    tagNames: toStringArray(raw.tagNames ?? raw.tags),
    urls: toUrlArray(raw.urls ?? raw.url),
    seriesExternalId: trimOrNull(raw.seriesExternalId) ?? undefined,
    seasonNumber: toNumber(raw.seasonNumber) ?? undefined,
    totalEpisodes: toNumber(raw.totalEpisodes) ?? undefined,
    episodeMap,
  };
}

// ─── Gallery Result Normalizer ─────────────────────────────────────

export function normalizeGalleryResult(
  raw: Record<string, unknown>,
): NormalizedGalleryResult {
  return {
    title: trimOrNull(raw.title),
    date: trimOrNull(raw.date),
    details: trimOrNull(raw.details),
    urls: toUrlArray(raw.urls ?? raw.url),
    studioName: trimOrNull(raw.studioName ?? raw.studio),
    performerNames: toStringArray(raw.performerNames ?? raw.performers),
    tagNames: toStringArray(raw.tagNames ?? raw.tags),
    imageUrl: trimToUrl(raw.imageUrl ?? raw.image),
    photographer: trimOrNull(raw.photographer),
  };
}

// ─── Image Result Normalizer ───────────────────────────────────────

export function normalizeImageResult(
  raw: Record<string, unknown>,
): NormalizedImageResult {
  return {
    title: trimOrNull(raw.title),
    date: trimOrNull(raw.date),
    details: trimOrNull(raw.details),
    urls: toUrlArray(raw.urls ?? raw.url),
    tagNames: toStringArray(raw.tagNames ?? raw.tags),
    imageUrl: trimToUrl(raw.imageUrl ?? raw.image),
  };
}

// ─── Audio Track Result Normalizer ─────────────────────────────────

export function normalizeAudioTrackResult(
  raw: Record<string, unknown>,
): NormalizedAudioTrackResult {
  return {
    title: trimOrNull(raw.title),
    artist: trimOrNull(raw.artist),
    album: trimOrNull(raw.album),
    trackNumber: toNumber(raw.trackNumber ?? raw.track_number),
    date: trimOrNull(raw.date),
    details: trimOrNull(raw.details),
    imageUrl: trimToUrl(raw.imageUrl ?? raw.image),
    urls: toUrlArray(raw.urls ?? raw.url),
    tagNames: toStringArray(raw.tagNames ?? raw.tags),
  };
}

// ─── Audio Library Result Normalizer ───────────────────────────────

export function normalizeAudioLibraryResult(
  raw: Record<string, unknown>,
): NormalizedAudioLibraryResult {
  return {
    name: trimOrNull(raw.name ?? raw.title),
    artist: trimOrNull(raw.artist),
    details: trimOrNull(raw.details),
    date: trimOrNull(raw.date),
    imageUrl: trimToUrl(raw.imageUrl ?? raw.image),
    urls: toUrlArray(raw.urls ?? raw.url),
    tagNames: toStringArray(raw.tagNames ?? raw.tags),
    trackCount: toNumber(raw.trackCount) ?? undefined,
  };
}
