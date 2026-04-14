/**
 * Client-side fetchers for the new /videos route stack.
 *
 * Return types deliberately reuse the scene types (`SceneListItem`,
 * `SceneDetail`, `SceneStats`, `SceneFolderListItemDto`,
 * `SceneFolderDetailDto`) so downstream components can consume both
 * data sources interchangeably.
 */
import type {
  SceneFolderDetailDto,
  SceneFolderListItemDto,
} from "@obscura/contracts";
import { buildQueryString, fetchApi } from "./core";
import type { SceneDetail, SceneListItem, SceneStats } from "./types";

export async function fetchVideos(params: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  resolution?: string[];
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  durationMin?: number;
  durationMax?: number;
  organized?: string;
  hasFile?: string;
  played?: string;
  limit?: number;
  offset?: number;
  nsfw?: string;
  sceneFolderId?: string;
  folderScope?: "direct" | "subtree";
  uncategorized?: boolean;
}): Promise<{ scenes: SceneListItem[]; total: number; limit: number; offset: number }> {
  const qs = buildQueryString(
    {
      search: params.search,
      sort: params.sort,
      order: params.order,
      ratingMin: params.ratingMin,
      ratingMax: params.ratingMax,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      durationMin: params.durationMin,
      durationMax: params.durationMax,
      organized: params.organized,
      hasFile: params.hasFile,
      played: params.played,
      limit: params.limit,
      offset: params.offset,
      nsfw: params.nsfw,
      sceneFolderId: params.sceneFolderId,
      folderScope: params.folderScope,
      uncategorized: params.uncategorized ? "true" : undefined,
    },
    {
      resolution: params.resolution,
    },
  );
  return fetchApi(`/videos${qs}`);
}

export async function fetchVideoDetail(id: string): Promise<SceneDetail> {
  return fetchApi(`/videos/${id}`);
}

export async function fetchVideoStats(nsfw?: string): Promise<SceneStats> {
  const qs = buildQueryString({ nsfw });
  return fetchApi(`/videos/stats${qs}`);
}

export async function fetchVideoFolders(params?: {
  parent?: string;
  root?: string;
  search?: string;
  limit?: number;
  offset?: number;
  nsfw?: string;
  studio?: string;
  tag?: string;
}): Promise<{
  items: SceneFolderListItemDto[];
  total: number;
  limit: number;
  offset: number;
}> {
  const qs = buildQueryString({
    parent: params?.parent,
    root: params?.root,
    search: params?.search,
    limit: params?.limit,
    offset: params?.offset,
    nsfw: params?.nsfw,
    studio: params?.studio,
    tag: params?.tag,
  });
  return fetchApi(`/video-folders${qs}`);
}

export async function fetchVideoFolderDetail(
  id: string,
  params?: { nsfw?: string },
): Promise<SceneFolderDetailDto> {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return fetchApi(`/video-folders/${id}${qs}`);
}

export async function updateVideo(
  id: string,
  data: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    organized?: boolean;
    isNsfw?: boolean;
    orgasmCount?: number;
  },
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/videos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateVideoFolder(
  id: string,
  data: {
    isNsfw?: boolean;
    customName?: string | null;
    details?: string | null;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
    rating?: number | null;
    date?: string | null;
  },
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/video-folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteVideo(
  id: string,
  deleteFile?: boolean,
): Promise<{ ok: true }> {
  const qs = deleteFile ? "?deleteFile=true" : "";
  return fetchApi(`/videos/${id}${qs}`, { method: "DELETE" });
}
