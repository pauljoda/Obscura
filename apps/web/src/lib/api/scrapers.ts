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
