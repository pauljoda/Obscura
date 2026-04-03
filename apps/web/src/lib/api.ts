const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
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
  playCount: number;
  studioId: string | null;
  performers: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  createdAt: string;
}

export interface SceneDetail extends SceneListItem {
  interactive: boolean;
  frameRate: number | null;
  bitRate: number | null;
  thumbnailPath: string | null;
  previewPath: string | null;
  playDuration: number | null;
  resumeTime: number | null;
  lastPlayedAt: string | null;
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
  sceneCount: number;
  favorite: boolean;
}

export interface TagItem {
  id: string;
  name: string;
  sceneCount: number;
}

// ─── API functions ────────────────────────────────────────────────

export async function fetchScenes(params: {
  search?: string;
  sort?: string;
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

export async function fetchSceneStats(): Promise<SceneStats> {
  return fetchApi("/scenes/stats");
}

export async function fetchStudios(): Promise<{ studios: StudioItem[] }> {
  return fetchApi("/studios");
}

export async function fetchPerformers(): Promise<{ performers: PerformerItem[] }> {
  return fetchApi("/performers");
}

export async function fetchTags(): Promise<{ tags: TagItem[] }> {
  return fetchApi("/tags");
}
