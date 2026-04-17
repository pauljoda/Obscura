/**
 * Server-side fetchers for the new /videos route stack.
 *
 * Holds all server-side video and series fetchers so media.ts can stay
 * focused on non-video entities.
 */
import type {
  VideoSeriesDetailDto,
  VideoSeriesListItemDto,
} from "@obscura/contracts";
import { buildQueryString, serverFetch } from "./core";
import {
  buildFetchVideosQuery,
  type FetchVideosParams,
} from "../api/video-query";
import type {
  VideoDetail,
  VideoListItem,
  VideoStats,
} from "../api/types";

export async function fetchVideos(params: FetchVideosParams) {
  const qs = buildFetchVideosQuery(params);

  return serverFetch<{ videos: VideoListItem[]; total: number; limit: number; offset: number }>(
    `/videos${qs}`,
    { tags: ["videos"] },
  );
}

export async function fetchSeries(params?: {
  parent?: string;
  root?: string;
  search?: string;
  limit?: number;
  offset?: number;
  nsfw?: string;
  studio?: string;
  tag?: string;
  performer?: string;
}) {
  const qs = buildQueryString({
    parent: params?.parent,
    root: params?.root,
    search: params?.search,
    limit: params?.limit,
    offset: params?.offset,
    nsfw: params?.nsfw,
    studio: params?.studio,
    tag: params?.tag,
    performer: params?.performer,
  });
  return serverFetch<{
    items: VideoSeriesListItemDto[];
    total: number;
    limit: number;
    offset: number;
  }>(`/video-series${qs}`, {
    revalidate: 0,
    tags: ["video-series"],
  });
}

export async function fetchSeriesDetail(id: string, params?: { nsfw?: string }) {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return serverFetch<VideoSeriesDetailDto>(`/video-series/${id}${qs}`, {
    revalidate: 0,
    tags: ["video-series", `video-series-${id}`],
  });
}

export async function fetchVideoDetail(id: string) {
  return serverFetch<VideoDetail>(`/videos/${id}`, {
    revalidate: 15,
    tags: ["videos", `video-${id}`],
  });
}

export async function fetchVideoStats(nsfw?: string) {
  const qs = buildQueryString({ nsfw });
  return serverFetch<VideoStats>(`/videos/stats${qs}`, {
    tags: ["videos"],
  });
}
