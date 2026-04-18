import type {
  JobsDashboardDto,
  LibraryRootDto,
  LibrarySettingsDto,
  ScraperPackageDto,
  StashBoxEndpointDto,
  StorageStatsDto,
} from "@obscura/contracts";
import { serverFetch } from "./core";

export async function fetchLibraryConfig() {
  return serverFetch<{
    settings: LibrarySettingsDto;
    roots: LibraryRootDto[];
    storage: StorageStatsDto;
  }>("/settings/library", { revalidate: 0, tags: ["settings"] });
}

export async function fetchInstalledScrapers() {
  return serverFetch<{ packages: ScraperPackageDto[] }>("/scrapers/packages", {
    tags: ["scrapers"],
  });
}

export async function fetchStashBoxEndpointsServer() {
  return serverFetch<{ endpoints: StashBoxEndpointDto[] }>("/stashbox-endpoints", {
    tags: ["stashbox"],
  });
}

export async function fetchJobsDashboard() {
  return serverFetch<JobsDashboardDto>("/jobs", {
    revalidate: 10,
    tags: ["jobs"],
  });
}
