// Types
export type {
  ScraperYamlDef,
  ScraperScriptDef,
  ScraperCapabilities,
  ScraperSceneFragment,
  ScraperPerformerFragment,
  ScraperSearchInput,
  StashScrapedScene,
  StashScrapedPerformer,
  StashScrapedStudio,
  StashScrapedTag,
  NormalizedScrapeResult,
} from "./types";
export { capabilityKeys } from "./types";

// YAML Parser
export {
  parseScraperYaml,
  resolveScriptDef,
  resolveActionDef,
  ScraperParseError,
} from "./yaml-parser";

// XPath Scraper Engine
export { runXPathScraper } from "./xpath-scraper";

// Executor
export {
  runScraperScript,
  scrapeScene,
  scrapePerformer,
  ScraperExecutionError,
  type ExecutorOptions,
} from "./executor";

// Normalizer
export {
  normalizeSceneResult,
  normalizePerformerResult,
  hasUsableNormalizedSceneResult,
} from "./normalizer";

// StashBox Client
export {
  StashBoxClient,
  StashBoxError,
  normalizeStashBoxScene,
  normalizeStashBoxPerformer,
  stashBoxSceneToRawResult,
} from "./stashbox";
export type {
  StashBoxFingerprint,
  StashBoxScene,
  StashBoxPerformer,
  StashBoxStudio,
  StashBoxTag,
  FingerprintAlgorithm,
  FingerprintSubmissionInput,
} from "./stashbox";

// Legacy types (kept for compatibility)
import type { FingerprintKind } from "@obscura/media-core";

export interface ImportedFingerprint {
  source: "stash";
  kind: FingerprintKind | string;
  value: string;
}

export interface BootstrapImportSummary {
  source: "stash";
  fingerprints: number;
  metadataEntities: number;
}
