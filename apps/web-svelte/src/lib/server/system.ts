import type {
  JobsDashboardDto,
  LibraryRootDto,
  LibrarySettingsDto,
  ScraperPackageDto,
  StashBoxEndpointDto,
} from "@obscura/contracts";
export async function fetchLibraryConfig(options?: { fetch?: typeof fetch }) {
  const f = options?.fetch ?? fetch;
  const res = await f("/api/settings/library");
  if (!res.ok) throw new Error(`settings library ${res.status}`);
  return res.json() as Promise<{
    settings: LibrarySettingsDto;
    roots: LibraryRootDto[];
  }>;
}

export async function fetchInstalledScrapers(options?: { fetch?: typeof fetch }) {
  const f = options?.fetch ?? fetch;
  const res = await f("/api/scrapers/packages");
  if (!res.ok) throw new Error(`scrapers packages ${res.status}`);
  return res.json() as Promise<{ packages: ScraperPackageDto[] }>;
}

export async function fetchStashBoxEndpointsServer(options?: { fetch?: typeof fetch }) {
  const f = options?.fetch ?? fetch;
  const res = await f("/api/stashbox-endpoints");
  if (!res.ok) throw new Error(`stashbox endpoints ${res.status}`);
  return res.json() as Promise<{ endpoints: StashBoxEndpointDto[] }>;
}

export async function fetchJobsDashboard(options?: {
  fetch?: typeof fetch;
  nsfwMode?: string;
}) {
  const f = options?.fetch ?? fetch;
  const qs = options?.nsfwMode
    ? `?nsfw=${encodeURIComponent(options.nsfwMode)}`
    : "";
  const res = await f(`/api/jobs${qs}`);
  if (!res.ok) throw new Error(`jobs dashboard ${res.status}`);
  return res.json() as Promise<JobsDashboardDto>;
}

export async function fetchInstalledPlugins(options?: { fetch?: typeof fetch }) {
  const f = options?.fetch ?? fetch;
  const res = await f("/api/plugins/packages");
  if (!res.ok) throw new Error(`plugins packages ${res.status}`);
  return res.json() as Promise<unknown[]>;
}
