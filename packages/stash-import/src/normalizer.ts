import type { StashScrapedScene, StashScrapedPerformer, NormalizedScrapeResult } from "./types";
import type { NormalizedPerformerResult } from "@obscura/contracts";

/**
 * Normalize a raw Stash scraper scene result into Obscura domain types.
 * Trims whitespace, deduplicates names, normalizes dates.
 */
export function normalizeSceneResult(
  raw: StashScrapedScene
): NormalizedScrapeResult {
  const performerNames = deduplicateNames(
    (raw.performers ?? []).map((p) => p.name).filter(Boolean)
  );

  const tagNames = deduplicateNames(
    (raw.tags ?? []).map((t) => t.name).filter(Boolean)
  );

  const url = raw.url ?? raw.urls?.[0] ?? null;

  return {
    title: trimOrNull(raw.title),
    date: normalizeDate(raw.date),
    details: trimOrNull(raw.details),
    url: trimOrNull(url),
    studioName: trimOrNull(raw.studio?.name),
    performerNames,
    tagNames,
    imageUrl: trimToUrl(raw.image),
  };
}

/** Only return the value if it looks like a valid URL, otherwise null */
function trimToUrl(value: string | undefined | null): string | null {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  return null;
}

function trimOrNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    // For data URLs, use first 100 chars as key to avoid huge string comparisons
    const key = url.startsWith("data:") ? url.slice(0, 100) : url;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(url);
  }
  return result;
}

function deduplicateNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(trimmed);
  }

  return result;
}

/**
 * Normalize date strings to YYYY-MM-DD format.
 * Handles common formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc.
 */
function normalizeDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Try parsing as a date
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Return as-is if we can't parse it
  return trimmed;
}

/**
 * Normalize a raw Stash scraper performer result into Obscura domain types.
 */
export function normalizePerformerResult(
  raw: StashScrapedPerformer
): NormalizedPerformerResult {
  return {
    name: trimOrNull(raw.name),
    disambiguation: trimOrNull(raw.disambiguation),
    gender: trimOrNull(raw.gender),
    birthdate: normalizeDate(raw.birthdate),
    country: trimOrNull(raw.country),
    ethnicity: trimOrNull(raw.ethnicity),
    eyeColor: trimOrNull(raw.eye_color),
    hairColor: trimOrNull(raw.hair_color),
    height: trimOrNull(raw.height),
    weight: trimOrNull(raw.weight),
    measurements: trimOrNull(raw.measurements),
    tattoos: trimOrNull(raw.tattoos),
    piercings: trimOrNull(raw.piercings),
    aliases: trimOrNull(raw.aliases),
    details: trimOrNull(raw.details),
    imageUrl: trimToUrl(raw.image) ?? trimToUrl(raw.images?.[0]),
    imageUrls: deduplicateUrls([
      ...(raw.image ? [trimToUrl(raw.image)] : []),
      ...(raw.images ?? []).map((img) => trimToUrl(img)),
    ].filter((u): u is string => u !== null)),
    tagNames: deduplicateNames(
      (raw.tags ?? []).map((t) => t.name).filter(Boolean)
    ),
  };
}
