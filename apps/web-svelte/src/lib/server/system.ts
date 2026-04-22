import type {
  JobsDashboardDto,
  LibraryRootDto,
  LibrarySettingsDto,
  ScraperPackageDto,
  StashBoxEndpointDto,
  StorageStatsDto,
} from "@obscura/contracts";
import { serverFetch } from "./core";

export async function fetchLibraryConfig(options?: { fetch?: typeof fetch }) {
  const f = options?.fetch ?? fetch;
  const res = await f("/api/settings/library");
  if (!res.ok) throw new Error(`settings library ${res.status}`);
  return res.json() as Promise<{
    settings: LibrarySettingsDto;
    roots: LibraryRootDto[];
    storage: StorageStatsDto;
  }>;
}

export async function fetchInstalledScrapers(options?: { fetch?: typeof fetch }) {
  return serverFetch<{ packages: ScraperPackageDto[] }>("/scrapers/packages", {
    fetch: options?.fetch,
  });
}

export async function fetchStashBoxEndpointsServer(options?: { fetch?: typeof fetch }) {
  return serverFetch<{ endpoints: StashBoxEndpointDto[] }>("/stashbox-endpoints", {
    fetch: options?.fetch,
  });
}

export async function fetchJobsDashboard(options?: { fetch?: typeof fetch; nsfwMode?: string }) {
  const qs = options?.nsfwMode ? `?nsfw=${encodeURIComponent(options.nsfwMode)}` : "";
  return serverFetch<JobsDashboardDto>(`/jobs${qs}`, { fetch: options?.fetch });
}

export async function fetchInstalledPlugins(options?: { fetch?: typeof fetch }) {
  return serverFetch<{ packages: unknown[] }>("/plugins/packages", {
    fetch: options?.fetch,
  });
}
