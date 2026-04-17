/**
 * Client-side fetchers for the /videos route stack. Series list/detail
 * and cover/backdrop uploads live in media.ts.
 */
import { buildQueryString, fetchApi } from "./core";
import type { VideoDetail, VideoListItem, VideoStats } from "./types";

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
  videoSeriesId?: string;
  folderScope?: "direct" | "subtree";
  uncategorized?: boolean;
  seasonNumber?: string;
}): Promise<{ scenes: VideoListItem[]; total: number; limit: number; offset: number }> {
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
      videoSeriesId: params.videoSeriesId,
      folderScope: params.folderScope,
      uncategorized: params.uncategorized ? "true" : undefined,
      seasonNumber: params.seasonNumber,
    },
    {
      resolution: params.resolution,
    },
  );
  return fetchApi(`/videos${qs}`);
}

export async function fetchVideoDetail(id: string): Promise<VideoDetail> {
  return fetchApi(`/videos/${id}`);
}

export async function fetchVideoStats(nsfw?: string): Promise<VideoStats> {
  const qs = buildQueryString({ nsfw });
  return fetchApi(`/videos/stats${qs}`);
}

export async function updateVideo(
  id: string,
  data: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    url?: string | null;
    organized?: boolean;
    orgasmCount?: number;
    isNsfw?: boolean;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    absoluteEpisodeNumber?: number | null;
  },
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/videos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function resetVideoMetadata(
  id: string,
): Promise<{ ok: true; id: string; title: string }> {
  return fetchApi(`/videos/${id}/reset-metadata`, { method: "POST" });
}

export async function deleteVideo(
  id: string,
  deleteFile?: boolean,
): Promise<{ ok: true }> {
  const qs = deleteFile ? "?deleteFile=true" : "";
  return fetchApi(`/videos/${id}${qs}`, { method: "DELETE" });
}

/** `GET /video/series/:id` — full series + seasons + episodes (for identify cascade). */
export interface VideoSeriesLibraryDetail {
  id: string;
  title: string;
  overview: string | null;
  seasons: Array<{
    id: string;
    seasonNumber: number;
    title: string | null;
    overview: string | null;
    episodes: Array<{
      id: string;
      seasonNumber: number;
      episodeNumber: number | null;
      title: string | null;
      filePath: string;
    }>;
  }>;
}

export async function fetchVideoSeriesLibraryDetail(
  id: string,
): Promise<VideoSeriesLibraryDetail> {
  return fetchApi(`/video/series/${id}`);
}
