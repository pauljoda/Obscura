import "server-only";

import type {
  JobsDashboardDto,
  LibrarySettingsDto,
  LibraryRootDto,
  StorageStatsDto,
  ScraperPackageDto,
  StashBoxEndpointDto,
  GalleryListItemDto,
  GalleryDetailDto,
  GalleryStatsDto,
  ImageListItemDto,
  ScrapeResultDto,
} from "@obscura/contracts";

const API_BASE = process.env.INTERNAL_API_URL ?? "http://localhost:4000";

/**
 * Server-side fetch with explicit Next.js caching semantics.
 * Revalidates on a short interval by default so server pages always
 * get reasonably fresh data without blocking on every request.
 */
async function serverFetch<T>(
  path: string,
  options?: { revalidate?: number | false; tags?: string[] },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    next: {
      revalidate: options?.revalidate ?? 30,
      tags: options?.tags,
    },
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

// Re-export shared types so server pages can import from one module
export type {
  SceneListItem,
  SceneDetail,
  SceneStats,
  GalleryListItem,
  TagItem,
  StudioItem,
  PerformerItem,
  PerformerDetail,
  JobsDashboard,
  LibrarySettings,
  LibraryRoot,
  StorageStats,
  ScrapeResult,
} from "./api";

// ─── Server-side read functions ──────────────────────────────────

export async function fetchScenes(params: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  tag?: string[];
  performer?: string[];
  studio?: string;
  resolution?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.sort) sp.set("sort", params.sort);
  if (params.order) sp.set("order", params.order);
  if (params.resolution) sp.set("resolution", params.resolution);
  if (params.studio) sp.set("studio", params.studio);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));
  params.tag?.forEach((t) => sp.append("tag", t));
  params.performer?.forEach((p) => sp.append("performer", p));
  const qs = sp.toString();

  return serverFetch<{
    scenes: import("./api").SceneListItem[];
    total: number;
    limit: number;
    offset: number;
  }>(`/scenes${qs ? `?${qs}` : ""}`, { tags: ["scenes"] });
}

export async function fetchSceneDetail(id: string) {
  return serverFetch<import("./api").SceneDetail>(`/scenes/${id}`, {
    revalidate: 15,
    tags: ["scenes", `scene-${id}`],
  });
}

export async function fetchSceneStats() {
  return serverFetch<import("./api").SceneStats>("/scenes/stats", {
    tags: ["scenes"],
  });
}

export async function fetchGalleries(params?: {
  search?: string;
  sort?: string;
  order?: string;
  tag?: string[];
  performer?: string[];
  studio?: string;
  type?: string;
  parent?: string;
  root?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.sort) sp.set("sort", params.sort);
  if (params?.order) sp.set("order", params.order);
  if (params?.studio) sp.set("studio", params.studio);
  if (params?.type) sp.set("type", params.type);
  if (params?.parent) sp.set("parent", params.parent);
  if (params?.root) sp.set("root", params.root);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  params?.tag?.forEach((t) => sp.append("tag", t));
  params?.performer?.forEach((p) => sp.append("performer", p));
  const qs = sp.toString();
  return serverFetch<{ galleries: GalleryListItemDto[]; total: number; limit: number; offset: number }>(
    `/galleries${qs ? `?${qs}` : ""}`,
    { tags: ["galleries"] },
  );
}

export async function fetchGalleryDetail(id: string) {
  return serverFetch<GalleryDetailDto>(`/galleries/${id}`, {
    revalidate: 15,
    tags: ["galleries", `gallery-${id}`],
  });
}

export async function fetchGalleryStats() {
  return serverFetch<GalleryStatsDto>("/galleries/stats", {
    tags: ["galleries"],
  });
}

export async function fetchImages(params?: {
  search?: string;
  sort?: string;
  order?: string;
  gallery?: string;
  tag?: string[];
  performer?: string[];
  studio?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.sort) sp.set("sort", params.sort);
  if (params?.order) sp.set("order", params.order);
  if (params?.gallery) sp.set("gallery", params.gallery);
  if (params?.studio) sp.set("studio", params.studio);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  params?.tag?.forEach((t) => sp.append("tag", t));
  params?.performer?.forEach((p) => sp.append("performer", p));
  const qs = sp.toString();
  return serverFetch<{ images: ImageListItemDto[]; total: number; limit: number; offset: number }>(
    `/images${qs ? `?${qs}` : ""}`,
    { tags: ["images"] },
  );
}

export async function fetchStudios() {
  return serverFetch<{ studios: import("./api").StudioItem[] }>("/studios", {
    tags: ["studios"],
  });
}

export async function fetchTags() {
  return serverFetch<{ tags: import("./api").TagItem[] }>("/tags", {
    tags: ["tags"],
  });
}

export async function fetchPerformers(params?: {
  search?: string;
  sort?: string;
  order?: string;
  gender?: string;
  favorite?: string;
  country?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.sort) sp.set("sort", params.sort);
  if (params?.order) sp.set("order", params.order);
  if (params?.gender) sp.set("gender", params.gender);
  if (params?.favorite) sp.set("favorite", params.favorite);
  if (params?.country) sp.set("country", params.country);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return serverFetch<{
    performers: import("./api").PerformerItem[];
    total: number;
    limit: number;
    offset: number;
  }>(`/performers${qs ? `?${qs}` : ""}`, { tags: ["performers"] });
}

export async function fetchPerformerDetail(id: string) {
  return serverFetch<import("./api").PerformerDetail>(`/performers/${id}`, {
    revalidate: 15,
    tags: ["performers", `performer-${id}`],
  });
}

export async function fetchLibraryConfig() {
  return serverFetch<{
    settings: LibrarySettingsDto;
    roots: LibraryRootDto[];
    storage: StorageStatsDto;
  }>("/settings/library", { revalidate: 60, tags: ["settings"] });
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

export async function fetchScrapeResults(params?: {
  status?: string;
  sceneId?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.sceneId) sp.set("sceneId", params.sceneId);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return serverFetch<{
    results: ScrapeResultDto[];
    total: number;
    limit: number;
    offset: number;
  }>(`/scrapers/results${qs ? `?${qs}` : ""}`, {
    revalidate: 15,
    tags: ["scrape-results"],
  });
}
