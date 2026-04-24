/**
 * Client-side fetchers for the /videos and /video-series route stacks.
 */
import type {
  VideoSeriesDetailDto,
  VideoSeriesListItemDto,
  VideoSubtitleTrackDto,
  SubtitleCueDto,
  VideoMarkerDto,
} from "@obscura/contracts";
import { buildQueryString, fetchApi, toApiUrl, uploadFile } from "./core";
import {
  buildFetchVideosQuery,
  type FetchVideosParams,
} from "./video-query";
import type {
  VideoCardListItem,
  VideoDetail,
  VideoListItem,
  VideoStats,
} from "./types";

export interface FetchVideosResponse {
  videos: VideoListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface FetchVideoCardsResponse {
  videos: VideoCardListItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchVideos(
  params: FetchVideosParams,
): Promise<FetchVideosResponse> {
  const qs = buildFetchVideosQuery(params);
  return fetchApi(`/videos${qs}`);
}

export async function fetchVideoCards(
  params: Omit<FetchVideosParams, "view">,
): Promise<FetchVideoCardsResponse> {
  const qs = buildFetchVideosQuery({ ...params, view: "card" });
  return fetchApi(`/videos${qs}`);
}

const FETCH_ALL_PAGE_SIZE = 2000;

export async function fetchAllVideos(
  params: Omit<FetchVideosParams, "limit" | "offset">,
): Promise<{ videos: VideoListItem[]; total: number }> {
  const videos: VideoListItem[] = [];
  let offset = 0;
  let total = 0;
  for (;;) {
    const res = await fetchVideos({ ...params, limit: FETCH_ALL_PAGE_SIZE, offset });
    total = res.total;
    videos.push(...res.videos);
    if (res.videos.length < FETCH_ALL_PAGE_SIZE || videos.length >= total) break;
    offset += FETCH_ALL_PAGE_SIZE;
  }
  return { videos, total };
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

export async function fetchVideoSubtitleCues(
  videoId: string,
  trackId: string,
): Promise<{ cues: SubtitleCueDto[] }> {
  return fetchApi(`/videos/${videoId}/subtitles/${trackId}/cues`);
}

export async function fetchVideoSubtitleSource(
  videoId: string,
  trackId: string,
): Promise<string> {
  const res = await fetch(
    toApiUrl(`/videos/${videoId}/subtitles/${trackId}/source`) ?? "",
  );
  if (!res.ok) {
    throw new Error(`Failed to load subtitle source: ${res.status}`);
  }
  return res.text();
}

export async function uploadVideoSubtitle(
  videoId: string,
  file: File,
  language: string,
  label?: string,
): Promise<{ track: VideoSubtitleTrackDto }> {
  return uploadFile(`/videos/${videoId}/subtitles`, file, {
    language,
    ...(label ? { label } : {}),
  });
}

export async function deleteVideoSubtitle(
  videoId: string,
  trackId: string,
): Promise<{ ok: true }> {
  return fetchApi(`/videos/${videoId}/subtitles/${trackId}`, { method: "DELETE" });
}

export async function updateVideoSubtitle(
  videoId: string,
  trackId: string,
  patch: { language?: string; label?: string | null },
): Promise<{ track: VideoSubtitleTrackDto }> {
  return fetchApi(`/videos/${videoId}/subtitles/${trackId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function extractVideoSubtitles(
  videoId: string,
): Promise<{ enqueued: boolean; jobId: string | null }> {
  return fetchApi(`/videos/${videoId}/subtitles/extract`, { method: "POST" });
}

export async function createVideoMarker(
  videoId: string,
  data: { title: string; seconds: number; endSeconds?: number | null },
): Promise<VideoMarkerDto> {
  return fetchApi(`/videos/${videoId}/markers`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateVideoMarker(
  markerId: string,
  data: { title?: string; seconds?: number; endSeconds?: number | null },
): Promise<{ ok: true }> {
  return fetchApi(`/videos/markers/${markerId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteVideoMarker(markerId: string): Promise<{ ok: true }> {
  return fetchApi(`/videos/markers/${markerId}`, { method: "DELETE" });
}

export async function recordVideoPlay(id: string): Promise<{ ok: true }> {
  return fetchApi(`/videos/${id}/play`, { method: "POST" });
}

export async function recordVideoOrgasm(
  id: string,
): Promise<{ ok: true; orgasmCount: number }> {
  return fetchApi(`/videos/${id}/orgasm`, { method: "POST" });
}

export async function uploadVideoThumbnail(
  videoId: string,
  file: File,
): Promise<{ ok: true; thumbnailPath: string }> {
  return uploadFile(`/videos/${videoId}/thumbnail`, file);
}

export async function deleteVideoThumbnail(
  videoId: string,
): Promise<{ ok: true; thumbnailPath: string }> {
  return fetchApi(`/videos/${videoId}/thumbnail`, {
    method: "DELETE",
  });
}

export async function uploadVideoThumbnailFromUrl(
  videoId: string,
  imageUrl: string,
): Promise<{ ok: true; thumbnailPath: string }> {
  return fetchApi(`/videos/${videoId}/thumbnail/from-url`, {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
  });
}

export async function generateVideoThumbnailFromFrame(
  videoId: string,
  seconds: number,
): Promise<{ ok: true; thumbnailPath: string; seconds: number }> {
  return fetchApi(`/videos/${videoId}/thumbnail/from-frame`, {
    method: "POST",
    body: JSON.stringify({ seconds }),
  });
}

export async function fetchSeries(params?: {
  parent?: string;
  root?: string;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  nsfw?: string;
  studio?: string | string[];
  tag?: string | string[];
  performer?: string | string[];
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  organized?: string;
}): Promise<{ items: VideoSeriesListItemDto[]; total: number; limit: number; offset: number }> {
  const toList = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value : value ? [value] : undefined;
  const qs = buildQueryString(
    {
      parent: params?.parent,
      root: params?.root,
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      limit: params?.limit,
      offset: params?.offset,
      nsfw: params?.nsfw,
      ratingMin: params?.ratingMin,
      ratingMax: params?.ratingMax,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      organized: params?.organized,
    },
    {
      studio: toList(params?.studio),
      tag: toList(params?.tag),
      performer: toList(params?.performer),
    },
  );
  return fetchApi(`/video-series${qs}`);
}

export async function fetchSeriesDetail(
  id: string,
  params?: { nsfw?: string },
): Promise<VideoSeriesDetailDto> {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return fetchApi(`/video-series/${id}${qs}`);
}

export async function updateSeries(
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
  return fetchApi(`/video-series/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function uploadSeriesCover(
  id: string,
  file: File,
): Promise<{ ok: true; coverImagePath: string }> {
  return uploadFile(`/video-series/${id}/cover`, file);
}

export async function deleteSeriesCover(
  id: string,
): Promise<{ ok: true }> {
  return fetchApi(`/video-series/${id}/cover`, { method: "DELETE" });
}

export async function uploadSeriesBackdrop(
  id: string,
  file: File,
): Promise<{ ok: true; backdropImagePath: string }> {
  return uploadFile(`/video-series/${id}/backdrop`, file);
}

export async function deleteSeriesBackdrop(
  id: string,
): Promise<{ ok: true }> {
  return fetchApi(`/video-series/${id}/backdrop`, { method: "DELETE" });
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
