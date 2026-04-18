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
  return serverFetch<{
    settings: LibrarySettingsDto;
    roots: LibraryRootDto[];
    storage: StorageStatsDto;
  }>("/settings/library", { fetch: options?.fetch });
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

export async function fetchJobsDashboard(options?: { fetch?: typeof fetch }) {
  return serverFetch<JobsDashboardDto>("/jobs", { fetch: options?.fetch });
}

export async function fetchInstalledPlugins(options?: { fetch?: typeof fetch }) {
  return serverFetch<{ packages: unknown[] }>("/plugins/packages", {
    fetch: options?.fetch,
  });
}
