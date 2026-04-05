import type {
  JobRunDto,
  JobsDashboardDto,
  LibraryBrowseDto,
  LibraryRootDto,
  LibrarySettingsDto,
  StorageStatsDto,
  ScraperPackageDto,
  CommunityIndexEntryDto,
  ScrapeResultDto,
  GalleryListItemDto,
  GalleryDetailDto,
  GalleryStatsDto,
  ImageListItemDto,
  ImageDetailDto,
} from "@obscura/contracts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────

export interface SceneListItem {
  id: string;
  title: string;
  details: string | null;
  date: string | null;
  rating: number | null;
  organized: boolean;
  duration: number | null;
  durationFormatted: string | null;
  resolution: string | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  container: string | null;
  fileSize: number | null;
  fileSizeFormatted: string | null;
  filePath: string | null;
  hasVideo: boolean;
  streamUrl: string | null;
  directStreamUrl: string | null;
  thumbnailPath: string | null;
  cardThumbnailPath: string | null;
  spritePath: string | null;
  trickplayVttPath: string | null;
  playCount: number;
  orgasmCount: number;
  studioId: string | null;
  performers: { id: string; name: string; gender?: string | null; imagePath?: string | null; favorite?: boolean }[];
  tags: { id: string; name: string }[];
  createdAt: string;
}

export interface SceneDetail extends SceneListItem {
  interactive: boolean;
  frameRate: number | null;
  bitRate: number | null;
  previewPath: string | null;
  playDuration: number | null;
  resumeTime: number | null;
  lastPlayedAt: string | null;
  url: string | null;
  studio: { id: string; name: string; url: string | null } | null;
  markers: {
    id: string;
    title: string;
    seconds: number;
    endSeconds: number | null;
    primaryTag: { id: string; name: string } | null;
  }[];
  updatedAt: string;
}

export type GalleryListItem = GalleryListItemDto;

export interface SceneStats {
  totalScenes: number;
  totalDuration: number;
  totalDurationFormatted: string;
  totalSize: number;
  totalSizeFormatted: string;
  totalPlays: number;
  recentCount: number;
}

export interface StudioItem {
  id: string;
  name: string;
}

export interface PerformerItem {
  id: string;
  name: string;
  disambiguation: string | null;
  gender: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  sceneCount: number;
  country: string | null;
  createdAt: string;
}

export interface TagItem {
  id: string;
  name: string;
  sceneCount: number;
}

export interface PerformerDetail {
  id: string;
  name: string;
  disambiguation: string | null;
  aliases: string | null;
  gender: string | null;
  birthdate: string | null;
  country: string | null;
  ethnicity: string | null;
  eyeColor: string | null;
  hairColor: string | null;
  height: number | null;
  weight: number | null;
  measurements: string | null;
  tattoos: string | null;
  piercings: string | null;
  careerStart: number | null;
  careerEnd: number | null;
  details: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  sceneCount: number;
  tags: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedPerformerScrapeResult {
  name: string | null;
  disambiguation: string | null;
  gender: string | null;
  birthdate: string | null;
  country: string | null;
  ethnicity: string | null;
  eyeColor: string | null;
  hairColor: string | null;
  height: string | null;
  weight: string | null;
  measurements: string | null;
  tattoos: string | null;
  piercings: string | null;
  aliases: string | null;
  details: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  tagNames: string[];
}

export interface StudioDetail {
  id: string;
  name: string;
  url: string | null;
  imageUrl: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LibraryRoot = LibraryRootDto;
export type LibrarySettings = LibrarySettingsDto;
export type StorageStats = StorageStatsDto;
export type JobsDashboard = JobsDashboardDto;
export type JobRun = JobRunDto;
export type LibraryBrowse = LibraryBrowseDto;

// ─── API functions ────────────────────────────────────────────────

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
}): Promise<{ scenes: SceneListItem[]; total: number; limit: number; offset: number }> {
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
  return fetchApi(`/scenes${qs ? `?${qs}` : ""}`);
}

export async function fetchSceneDetail(id: string): Promise<SceneDetail> {
  return fetchApi(`/scenes/${id}`);
}

export async function updateScene(
  id: string,
  data: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    url?: string | null;
    organized?: boolean;
    orgasmCount?: number;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
  }
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/scenes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Marker API functions ────────────────────────────────────

export interface MarkerDto {
  id: string;
  title: string;
  seconds: number;
  endSeconds: number | null;
  primaryTag: { id: string; name: string } | null;
}

export async function createMarker(
  sceneId: string,
  data: { title: string; seconds: number; endSeconds?: number | null; primaryTagName?: string | null }
): Promise<MarkerDto> {
  return fetchApi(`/scenes/${sceneId}/markers`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMarker(
  markerId: string,
  data: { title?: string; seconds?: number; endSeconds?: number | null; primaryTagName?: string | null }
): Promise<{ ok: true }> {
  return fetchApi(`/scenes/markers/${markerId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMarker(markerId: string): Promise<{ ok: true }> {
  return fetchApi(`/scenes/markers/${markerId}`, { method: "DELETE" });
}

export async function trackPlay(sceneId: string): Promise<{ ok: true }> {
  return fetchApi(`/scenes/${sceneId}/play`, { method: "POST" });
}

export async function trackOrgasm(
  sceneId: string
): Promise<{ ok: true; orgasmCount: number }> {
  return fetchApi(`/scenes/${sceneId}/orgasm`, { method: "POST" });
}

export async function fetchSceneStats(): Promise<SceneStats> {
  return fetchApi("/scenes/stats");
}

export async function fetchGalleries(params?: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  tag?: string[];
  performer?: string[];
  studio?: string;
  type?: string;
  parent?: string;
  root?: string;
  limit?: number;
  offset?: number;
}): Promise<{ galleries: GalleryListItem[]; total: number; limit: number; offset: number }> {
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
  return fetchApi(`/galleries${qs ? `?${qs}` : ""}`);
}

export async function fetchGalleryDetail(id: string): Promise<GalleryDetailDto> {
  return fetchApi(`/galleries/${id}`);
}

export async function fetchGalleryImages(
  id: string,
  params?: { limit?: number; offset?: number }
): Promise<GalleryDetailDto> {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("imageLimit", String(params.limit));
  if (params?.offset) sp.set("imageOffset", String(params.offset));
  const qs = sp.toString();
  return fetchApi(`/galleries/${id}${qs ? `?${qs}` : ""}`);
}

export async function fetchGalleryStats(): Promise<GalleryStatsDto> {
  return fetchApi("/galleries/stats");
}

export async function updateGallery(
  id: string,
  data: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    organized?: boolean;
    photographer?: string | null;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
  }
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/galleries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function createGallery(data: {
  title: string;
  details?: string | null;
  date?: string | null;
}): Promise<{ ok: true; id: string }> {
  return fetchApi("/galleries", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteGallery(id: string): Promise<{ ok: true }> {
  return fetchApi(`/galleries/${id}`, { method: "DELETE" });
}

export async function fetchImages(params?: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  gallery?: string;
  tag?: string[];
  performer?: string[];
  studio?: string;
  limit?: number;
  offset?: number;
}): Promise<{ images: ImageListItemDto[]; total: number; limit: number; offset: number }> {
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
  return fetchApi(`/images${qs ? `?${qs}` : ""}`);
}

export async function fetchImageDetail(id: string): Promise<ImageDetailDto> {
  return fetchApi(`/images/${id}`);
}

export async function updateImage(
  id: string,
  data: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    organized?: boolean;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
  }
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/images/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchStudios(): Promise<{ studios: StudioItem[] }> {
  return fetchApi("/studios");
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
}): Promise<{ performers: PerformerItem[]; total: number; limit: number; offset: number }> {
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
  return fetchApi(`/performers${qs ? `?${qs}` : ""}`);
}

export async function fetchTags(): Promise<{ tags: TagItem[] }> {
  return fetchApi("/tags");
}

export async function fetchPerformerDetail(id: string): Promise<PerformerDetail> {
  return fetchApi(`/performers/${id}`);
}

export async function createPerformer(
  data: Partial<PerformerDetail> & { name: string; tagNames?: string[] }
): Promise<{ ok: true; id: string }> {
  return fetchApi("/performers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePerformer(
  id: string,
  data: Record<string, unknown>
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/performers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deletePerformer(id: string): Promise<{ ok: true }> {
  return fetchApi(`/performers/${id}`, { method: "DELETE" });
}

export async function togglePerformerFavorite(
  id: string,
  favorite: boolean
): Promise<{ ok: true; favorite: boolean }> {
  return fetchApi(`/performers/${id}/favorite`, {
    method: "PATCH",
    body: JSON.stringify({ favorite }),
  });
}

export async function setPerformerRating(
  id: string,
  rating: number | null
): Promise<{ ok: true; rating: number | null }> {
  return fetchApi(`/performers/${id}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
}

export async function uploadPerformerImage(
  id: string,
  file: File
): Promise<{ ok: true; imagePath: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/performers/${id}/image`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function uploadPerformerImageFromUrl(
  id: string,
  imageUrl: string
): Promise<{ ok: true; imagePath: string }> {
  return fetchApi(`/performers/${id}/image/from-url`, {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
  });
}

export async function deletePerformerImage(id: string): Promise<{ ok: true }> {
  return fetchApi(`/performers/${id}/image`, { method: "DELETE" });
}

export async function scrapePerformerApi(
  scraperId: string,
  performerId: string,
  options?: { action?: string; url?: string; query?: string }
): Promise<{
  result?: NormalizedPerformerScrapeResult;
  results?: NormalizedPerformerScrapeResult[];
  message?: string;
  action?: string;
  triedActions?: string[];
}> {
  return fetchApi(`/scrapers/${scraperId}/scrape-performer`, {
    method: "POST",
    body: JSON.stringify({
      performerId,
      action: options?.action || "auto",
      url: options?.url,
      query: options?.query,
    }),
  });
}

export async function applyPerformerScrape(
  id: string,
  fields: Record<string, unknown>,
  selectedFields: string[]
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/performers/${id}/apply-scrape`, {
    method: "POST",
    body: JSON.stringify({ fields, selectedFields }),
  });
}

export async function fetchStudioDetail(id: string): Promise<StudioDetail> {
  return fetchApi(`/studios/${id}`);
}

export async function fetchLibraryConfig(): Promise<{
  settings: LibrarySettings;
  roots: LibraryRoot[];
  storage: StorageStats;
}> {
  return fetchApi("/settings/library");
}

export async function updateLibrarySettings(
  payload: Partial<LibrarySettings>
): Promise<LibrarySettings> {
  return fetchApi("/settings/library", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function browseLibraryPath(targetPath?: string): Promise<LibraryBrowse> {
  const qs = targetPath ? `?path=${encodeURIComponent(targetPath)}` : "";
  return fetchApi(`/libraries/browse${qs}`);
}

export async function createLibraryRoot(payload: {
  path: string;
  label?: string;
  enabled?: boolean;
  recursive?: boolean;
  scanVideos?: boolean;
  scanImages?: boolean;
}): Promise<LibraryRoot> {
  return fetchApi("/libraries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLibraryRoot(
  id: string,
  payload: Partial<Pick<LibraryRoot, "path" | "label" | "enabled" | "recursive" | "scanVideos" | "scanImages">>
): Promise<LibraryRoot> {
  return fetchApi(`/libraries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteLibraryRoot(id: string): Promise<{ ok: true }> {
  return fetchApi(`/libraries/${id}`, {
    method: "DELETE",
  });
}

export async function fetchJobsDashboard(): Promise<JobsDashboard> {
  return fetchApi("/jobs");
}

export async function runQueue(queueName: string): Promise<{
  ok: boolean;
  queueName: string;
  enqueued: number;
  jobIds: string[];
}> {
  return fetchApi(`/jobs/queues/${queueName}/run`, {
    method: "POST",
  });
}

// ─── Scraper types ───────────────────────────────────────────────

export type ScraperPackage = ScraperPackageDto;
export type CommunityIndexEntry = CommunityIndexEntryDto;
export type ScrapeResult = ScrapeResultDto;

export interface NormalizedScrapeResult {
  title: string | null;
  date: string | null;
  details: string | null;
  url: string | null;
  studioName: string | null;
  performerNames: string[];
  tagNames: string[];
  imageUrl: string | null;
}

// ─── Scraper API functions ───────────────────────────────────────

export async function fetchCommunityIndex(
  force = false
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
  enabled: boolean
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
  options?: { url?: string; query?: string }
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
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.sceneId) sp.set("sceneId", params.sceneId);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return fetchApi(`/scrapers/results${qs ? `?${qs}` : ""}`);
}

export async function acceptScrapeResult(
  id: string,
  fields?: string[],
  options?: { excludePerformers?: string[]; excludeTags?: string[] }
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

export async function rejectScrapeResult(
  id: string
): Promise<{ ok: true }> {
  return fetchApi(`/scrapers/results/${id}/reject`, {
    method: "POST",
  });
}

export async function uploadThumbnail(
  sceneId: string,
  file: File
): Promise<{ ok: true; thumbnailPath: string }> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/scenes/${sceneId}/thumbnail`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function deleteThumbnail(
  sceneId: string
): Promise<{ ok: true; thumbnailPath: string }> {
  return fetchApi(`/scenes/${sceneId}/thumbnail`, {
    method: "DELETE",
  });
}

export async function uploadThumbnailFromUrl(
  sceneId: string,
  imageUrl: string
): Promise<{ ok: true; thumbnailPath: string }> {
  return fetchApi(`/scenes/${sceneId}/thumbnail/from-url`, {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
  });
}

export async function generateThumbnailFromFrame(
  sceneId: string,
  seconds: number
): Promise<{ ok: true; thumbnailPath: string; seconds: number }> {
  return fetchApi(`/scenes/${sceneId}/thumbnail/from-frame`, {
    method: "POST",
    body: JSON.stringify({ seconds }),
  });
}

export function toApiUrl(assetPath: string | null | undefined) {
  if (!assetPath) {
    return undefined;
  }

  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    return assetPath;
  }

  return `${API_BASE}${assetPath}`;
}
