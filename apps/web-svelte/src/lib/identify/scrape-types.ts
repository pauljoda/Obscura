import type {
  VideoListItem,
  PerformerItem,
  StudioItem,
  TagItem,
  ScraperPackage,
  StashBoxEndpoint,
  ScrapeResult,
  NormalizedScrapeResult,
  NormalizedPerformerScrapeResult,
  NormalizedStudioScrapeResult,
  NormalizedTagScrapeResult,
} from "$lib/api/types";
import { entityTerms } from "$lib/terminology";

export type {
  VideoListItem,
  PerformerItem,
  StudioItem,
  TagItem,
  ScraperPackage,
  StashBoxEndpoint,
  ScrapeResult,
  NormalizedScrapeResult,
  NormalizedPerformerScrapeResult,
  NormalizedStudioScrapeResult,
  NormalizedTagScrapeResult,
};

export type Tab =
  | "videos"
  | "video-series"
  | "galleries"
  | "images"
  | "audio-libraries"
  | "audio-tracks"
  | "performers"
  | "studios"
  | "tags"
  | "phashes";

export const VIDEO_FIELDS = [
  "title",
  "date",
  "details",
  "url",
  "studio",
  "performers",
  "tags",
  "image",
  "episodeNumber",
] as const;
export type VideoField = (typeof VIDEO_FIELDS)[number];

export interface Provider {
  id: string;
  name: string;
  type: "scraper" | "stashbox";
}

export type RowStatus =
  | "pending"
  | "scraping"
  | "found"
  | "no-result"
  | "error"
  | "accepted"
  | "rejected";

export interface VideoRow {
  video: VideoListItem;
  status: RowStatus;
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<VideoField>;
  excludedPerformers: Set<string>;
  excludedTags: Set<string>;
}

export interface PerformerRow {
  performer: PerformerItem;
  status: RowStatus;
  result?: NormalizedPerformerScrapeResult;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

export interface StudioRow {
  studio: StudioItem;
  status: RowStatus;
  result?: NormalizedStudioScrapeResult;
  remoteId?: string;
  endpointId?: string;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

export interface TagRow {
  tag: TagItem;
  status: RowStatus;
  result?: NormalizedTagScrapeResult;
  remoteId?: string;
  endpointId?: string;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

export const SEEK_TIMEOUT_MS = 5_000;

export function perfFieldsFromResult(result: NormalizedPerformerScrapeResult): Set<string> {
  return new Set(
    Object.entries(result)
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k]) => k),
  );
}

export function tabEntityLabel(t: Tab): string {
  if (t === "videos") return entityTerms.videos.toLowerCase();
  if (t === "performers") return entityTerms.performers.toLowerCase();
  if (t === "studios") return "studios";
  return "tags";
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Scraper timeout")), ms),
    ),
  ]);
}
