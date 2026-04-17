import { buildQueryString, fetchApi } from "./core";
import type {
  CommunityIndexEntry,
  MetadataProvider,
  NormalizedPerformerScrapeResult,
  NormalizedScrapeResult,
  NormalizedStudioScrapeResult,
  NormalizedTagScrapeResult,
  ScrapeResult,
  ScraperPackage,
  StashBoxEndpoint,
  StashBoxStudioResult,
  StashBoxTagResult,
  StashIdEntry,
} from "./types";

export async function fetchCommunityIndex(
  force = false,
): Promise<{ entries: CommunityIndexEntry[] }> {
  const qs = force ? "?force=true" : "";
  return fetchApi(`/scrapers/index${qs}`);
}

export async function fetchInstalledScrapers(): Promise<{
  packages: ScraperPackage[];
}> {
  return fetchApi("/scrapers/packages");
}

export async function installScraper(packageId: string): Promise<ScraperPackage> {
  return fetchApi("/scrapers/packages", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
}

export async function uninstallScraper(id: string): Promise<{ ok: true }> {
  return fetchApi(`/scrapers/packages/${id}`, {
    method: "DELETE",
  });
}

export async function toggleScraper(
  id: string,
  enabled: boolean,
): Promise<ScraperPackage> {
  return fetchApi(`/scrapers/packages/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export async function scrapeScene(
  scraperId: string,
  sceneId: string,
  action?: string,
  options?: { url?: string; query?: string },
): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  results?: NormalizedScrapeResult[];
  message?: string;
  action?: string;
  triedActions?: string[];
}> {
  return fetchApi(`/scrapers/${scraperId}/scrape`, {
    method: "POST",
    body: JSON.stringify({
      sceneId,
      action: action || "auto",
      url: options?.url,
      query: options?.query,
    }),
  });
}

export async function fetchScrapeResults(params?: {
  status?: string;
  sceneId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: ScrapeResult[]; total: number; limit: number; offset: number }> {
  const qs = buildQueryString({
    status: params?.status,
    sceneId: params?.sceneId,
    limit: params?.limit,
    offset: params?.offset,
  });

  return fetchApi(`/scrapers/results${qs}`);
}

const SCRAPE_RESULTS_PAGE_SIZE = 500;

/** Loads all scrape results for the given filters (e.g. full pending queue). */
export async function fetchAllScrapeResults(params?: {
  status?: string;
  sceneId?: string;
}): Promise<{ results: ScrapeResult[]; total: number }> {
  const results: ScrapeResult[] = [];
  let offset = 0;
  let total = 0;
  for (;;) {
    const res = await fetchScrapeResults({
      ...params,
      limit: SCRAPE_RESULTS_PAGE_SIZE,
      offset,
    });
    total = res.total;
    results.push(...res.results);
    if (res.results.length < SCRAPE_RESULTS_PAGE_SIZE || results.length >= total) break;
    offset += SCRAPE_RESULTS_PAGE_SIZE;
  }
  return { results, total };
}

/**
 * Fetch a single scrape_result row by id. The cascade review drawer
 * uses this to hydrate the typed `proposedResult` payload that the
 * list endpoint would normally also include, but without burning the
 * 500-row page for one row.
 */
export async function fetchScrapeResult(id: string): Promise<ScrapeResult> {
  return fetchApi(`/scrapers/results/${id}`);
}

export async function acceptScrapeResult(
  id: string,
  fields?: string[],
  options?: { excludePerformers?: string[]; excludeTags?: string[] },
): Promise<{ ok: true; sceneId: string }> {
  return fetchApi(`/scrapers/results/${id}/accept`, {
    method: "POST",
    body: JSON.stringify({
      fields,
      excludePerformers: options?.excludePerformers,
      excludeTags: options?.excludeTags,
    }),
  });
}

export async function rejectScrapeResult(id: string): Promise<{ ok: true }> {
  return fetchApi(`/scrapers/results/${id}/reject`, {
    method: "POST",
  });
}

export async function fetchStashBoxEndpoints(): Promise<{
  endpoints: StashBoxEndpoint[];
}> {
  return fetchApi("/stashbox-endpoints");
}

export async function createStashBoxEndpoint(data: {
  name: string;
  endpoint: string;
  apiKey: string;
}): Promise<StashBoxEndpoint> {
  return fetchApi("/stashbox-endpoints", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateStashBoxEndpoint(
  id: string,
  data: { name?: string; endpoint?: string; apiKey?: string; enabled?: boolean },
): Promise<StashBoxEndpoint> {
  return fetchApi(`/stashbox-endpoints/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteStashBoxEndpoint(id: string): Promise<{ ok: true }> {
  return fetchApi(`/stashbox-endpoints/${id}`, {
    method: "DELETE",
  });
}

export async function testStashBoxEndpoint(
  id: string,
): Promise<{ valid: boolean; error?: string }> {
  return fetchApi(`/stashbox-endpoints/${id}/test`, {
    method: "POST",
  });
}

export async function identifyViaStashBox(
  endpointId: string,
  sceneId: string,
): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  matchType?: string;
  message?: string;
  triedMethods?: string[];
}> {
  return fetchApi(`/stashbox-endpoints/${endpointId}/identify`, {
    method: "POST",
    body: JSON.stringify({ sceneId }),
  });
}

export async function identifyPerformerViaStashBox(
  endpointId: string,
  performerId: string,
): Promise<{
  results?: NormalizedPerformerScrapeResult[];
  result?: null;
  message?: string;
}> {
  return fetchApi(`/stashbox-endpoints/${endpointId}/identify-performer`, {
    method: "POST",
    body: JSON.stringify({ performerId }),
  });
}

export async function fetchMetadataProviders(): Promise<{
  providers: MetadataProvider[];
}> {
  return fetchApi("/metadata-providers");
}

export async function fetchStashIds(
  entityType: string,
  entityId: string,
): Promise<{ stashIds: StashIdEntry[] }> {
  const qs = buildQueryString({
    entityType,
    entityId,
  });

  return fetchApi(`/stash-ids${qs}`);
}

export async function createStashId(data: {
  entityType: string;
  entityId: string;
  stashBoxEndpointId: string;
  stashId: string;
}): Promise<StashIdEntry> {
  return fetchApi("/stash-ids", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteStashId(id: string): Promise<{ ok: true }> {
  return fetchApi(`/stash-ids/${id}`, { method: "DELETE" });
}

export async function lookupStudioViaStashBox(
  endpointId: string,
  query: string,
): Promise<{ studio: StashBoxStudioResult | null }> {
  return fetchApi(`/stashbox-endpoints/${endpointId}/lookup/studio`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function lookupTagViaStashBox(
  endpointId: string,
  query: string,
): Promise<{ tags: StashBoxTagResult[] }> {
  return fetchApi(`/stashbox-endpoints/${endpointId}/lookup/tag`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export type { NormalizedStudioScrapeResult, NormalizedTagScrapeResult };

/* ─── Obscura Community Plugins ─────────────────────────────── */

export interface ObscuraPluginIndexEntry {
  id: string;
  name: string;
  version: string;
  date: string;
  path: string;
  sha256: string;
  runtime: string;
  isNsfw: boolean;
  description?: string;
  author?: string;
  capabilities: Record<string, boolean>;
  requires?: string[];
  installed?: boolean;
  installedVersion?: string | null;
  updateAvailable?: boolean;
  localPath?: string;
}

export async function fetchObscuraPluginIndex(
  options: { refresh?: boolean } = {},
): Promise<ObscuraPluginIndexEntry[]> {
  const qs = options.refresh ? "?refresh=1" : "";
  return fetchApi(`/plugins/obscura-index${qs}`);
}

export interface PluginUpdateStatus {
  pluginId: string;
  installedVersion: string;
  availableVersion: string | null;
  updateAvailable: boolean;
  zipUrl: string | null;
  sha256: string | null;
}

export async function fetchPluginUpdates(
  options: { refresh?: boolean } = {},
): Promise<PluginUpdateStatus[]> {
  const qs = options.refresh ? "?refresh=1" : "";
  return fetchApi(`/plugins/check-updates${qs}`);
}

export async function installObscuraPlugin(
  pluginId: string,
  options: { localPath?: string; zipUrl?: string; sha256?: string },
): Promise<{ ok: boolean; pluginId: string }> {
  return fetchApi("/plugins/packages", {
    method: "POST",
    body: JSON.stringify({ pluginId, ...options }),
  });
}

export interface PluginExecuteResult {
  ok: boolean;
  result: unknown;
  normalized?: NormalizedScrapeResult;
  pluginId: string;
  action: string;
}

export async function executePlugin(
  pluginDbId: string,
  action: string,
  input?: Record<string, unknown>,
  options?: { saveResult?: boolean; entityId?: string },
): Promise<PluginExecuteResult> {
  return fetchApi(`/plugins/${pluginDbId}/execute`, {
    method: "POST",
    body: JSON.stringify({ action, input, ...options }),
  });
}

/* ─── Plugin management ─────────────────────────────────────── */

export interface InstalledPlugin {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  runtime: string;
  installPath: string;
  sha256: string | null;
  isNsfw: boolean;
  capabilities: Record<string, boolean> | null;
  enabled: boolean;
  sourceIndex: string | null;
  authStatus: "ok" | "missing" | null;
  authFields?: Array<{ key: string; label: string; required: boolean; url?: string }>;
  createdAt: string;
  updatedAt: string;
}

export async function fetchInstalledPlugins(): Promise<InstalledPlugin[]> {
  return fetchApi("/plugins/packages");
}

export async function togglePlugin(id: string, enabled: boolean): Promise<{ ok: boolean }> {
  return fetchApi(`/plugins/packages/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export async function uninstallPlugin(id: string): Promise<{ ok: boolean }> {
  return fetchApi(`/plugins/packages/${id}`, { method: "DELETE" });
}

export async function acceptPluginResult(
  resultId: string,
  fields?: string[],
): Promise<{ ok: boolean }> {
  return fetchApi(`/plugins/results/${resultId}/accept`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}

// ─── Typed cascade / movie / episode accept endpoints ───────────────
//
// These target the new `scrape-accept.service.ts` handlers added in
// Plan D1. Unlike `acceptPluginResult` (legacy field-list), they take
// a structured field mask, optional per-slot image selections, and
// — for series — a cascade spec with per-season and per-episode
// overrides assembled by the cascade review drawer.
//
// The helpers are deliberately thin; the drawer owns spec assembly.

/**
 * Per-field acceptance mask — one boolean per text field the user
 * toggled in the review screen. Fields not present in the mask are
 * left as-is on the target row. Mirrors `AcceptFieldMask` in
 * `scrape-accept.service.ts`.
 */
export interface AcceptFieldMask {
  title?: boolean;
  overview?: boolean;
  tagline?: boolean;
  releaseDate?: boolean;
  airDate?: boolean;
  runtime?: boolean;
  genres?: boolean;
  studio?: boolean;
  cast?: boolean;
  rating?: boolean;
  contentRating?: boolean;
  externalIds?: boolean;
}

/**
 * Per-slot image URL choices assembled by the ImagePicker for each
 * review screen. The server fetches only the selected URLs during
 * accept.
 */
export interface SelectedImages {
  poster?: string;
  backdrop?: string;
  logo?: string;
  still?: string;
}

/**
 * Cascade accept spec — collapses the drawer's per-season and
 * per-episode checkbox state into the shape the API expects.
 */
export interface CascadeAcceptSpec {
  acceptAllSeasons?: boolean;
  seasonOverrides?: Record<
    number,
    {
      accepted: boolean;
      fieldMask?: AcceptFieldMask;
      selectedImages?: SelectedImages;
      episodes?: Record<
        number,
        {
          accepted: boolean;
          fieldMask?: AcceptFieldMask;
          selectedImages?: SelectedImages;
        }
      >;
    }
  >;
}

export async function acceptVideoMovieScrape(
  movieId: string,
  body: {
    scrapeResultId: string;
    fieldMask?: AcceptFieldMask;
    selectedImages?: SelectedImages;
  },
): Promise<{ ok: boolean }> {
  return fetchApi(`/video/movies/${movieId}/accept-scrape`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function acceptVideoEpisodeScrape(
  episodeId: string,
  body: {
    scrapeResultId: string;
    fieldMask?: AcceptFieldMask;
    selectedImages?: SelectedImages;
  },
): Promise<{ ok: boolean }> {
  return fetchApi(`/video/episodes/${episodeId}/accept-scrape`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function acceptVideoSeriesScrape(
  seriesId: string,
  body: {
    scrapeResultId: string;
    fieldMask?: AcceptFieldMask;
    selectedImages?: SelectedImages;
    cascade?: CascadeAcceptSpec;
  },
): Promise<{ ok: boolean; seasonsUpdated: number; episodesUpdated: number }> {
  return fetchApi(`/video/series/${seriesId}/accept-scrape`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function savePluginAuthKey(
  pluginDbId: string,
  authKey: string,
  value: string,
): Promise<{ ok: boolean }> {
  return fetchApi(`/plugins/packages/${pluginDbId}/auth/${authKey}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}
