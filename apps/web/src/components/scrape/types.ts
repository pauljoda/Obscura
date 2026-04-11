import type {
  SceneListItem,
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
} from "../../lib/api";
import { entityTerms } from "../../lib/terminology";

/* ─── Re-exports for convenience ─────────────────────────────── */

export type {
  SceneListItem,
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

/* ─── Types ────────────────────────────────────────────────────── */

export type Tab = "scenes" | "performers" | "studios" | "tags" | "phashes";

export const SCENE_FIELDS = ["title", "date", "details", "url", "studio", "performers", "tags", "image"] as const;
export type SceneField = typeof SCENE_FIELDS[number];

/** Unified provider that can be either a community scraper or StashBox endpoint */
export interface Provider {
  id: string;
  name: string;
  type: "scraper" | "stashbox";
}

export interface SceneRow {
  scene: SceneListItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<SceneField>;
  excludedPerformers: Set<string>;
  excludedTags: Set<string>;
}

export interface PerformerRow {
  performer: PerformerItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: NormalizedPerformerScrapeResult;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

export interface StudioRow {
  studio: StudioItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: NormalizedStudioScrapeResult;
  remoteId?: string;
  endpointId?: string;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

export interface TagRow {
  tag: TagItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: NormalizedTagScrapeResult;
  remoteId?: string;
  endpointId?: string;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

/* ─── Constants ────────────────────────────────────────────────── */

export const SEEK_TIMEOUT_MS = 5_000;

/* ─── Utility functions ────────────────────────────────────────── */

export function perfFieldsFromResult(result: NormalizedPerformerScrapeResult): Set<string> {
  return new Set(
    Object.entries(result)
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k]) => k)
  );
}

export function tabEntityLabel(t: Tab): string {
  if (t === "scenes") return entityTerms.scenes.toLowerCase();
  if (t === "performers") return entityTerms.performers.toLowerCase();
  if (t === "studios") return "studios";
  return "tags";
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Scraper timeout")), ms)
    ),
  ]);
}

/* ─── Shared props for tab components ─────────────────────────── */

export interface TabSharedProps {
  stashBoxEndpoints: StashBoxEndpoint[];
  selectedScraperId: string;
  autoAccept: boolean;
  running: boolean;
  setRunning: (running: boolean) => void;
  abortRef: React.RefObject<boolean>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
}
