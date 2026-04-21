/**
 * Server-side fetchers for the new /videos route stack.
 *
 * Holds all server-side video and series fetchers so media.ts can stay
 * focused on non-video entities.
 */
import type {
  VideoCardListItemDto,
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

const SHORT_REVALIDATE_SECONDS = 5;

export async function fetchVideos(
  params: FetchVideosParams,
  options?: { fetch?: typeof fetch },
) {
  const qs = buildFetchVideosQuery(params);

  return serverFetch<{ videos: VideoListItem[]; total: number; limit: number; offset: number }>(
    `/videos${qs}`,
    { fetch: options?.fetch },
  );
}

export async function fetchVideoCards(
  params: Omit<FetchVideosParams, "view">,
  options?: { fetch?: typeof fetch },
) {
  const qs = buildFetchVideosQuery({ ...params, view: "card" });

  return serverFetch<{
    videos: VideoCardListItemDto[];
    total: number;
    limit: number;
    offset: number;
  }>(`/videos${qs}`, { fetch: options?.fetch });
}

export async function fetchSeries(
  params?: {
    parent?: string;
    root?: string;
    search?: string;
    limit?: number;
    offset?: number;
    nsfw?: string;
    studio?: string;
    tag?: string;
    performer?: string;
  },
  options?: { fetch?: typeof fetch },
) {
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
    revalidate: SHORT_REVALIDATE_SECONDS,
    tags: ["video-series"],
    fetch: options?.fetch,
  });
}

export async function fetchSeriesDetail(
  id: string,
  params?: { nsfw?: string },
  options?: { fetch?: typeof fetch },
) {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return serverFetch<VideoSeriesDetailDto>(`/video-series/${id}${qs}`, {
    revalidate: SHORT_REVALIDATE_SECONDS,
    tags: ["video-series", `video-series-${id}`],
    fetch: options?.fetch,
  });
}

export async function fetchVideoDetail(
  id: string,
  options?: { fetch?: typeof fetch },
) {
  return serverFetch<VideoDetail>(`/videos/${id}`, { fetch: options?.fetch });
}

export async function fetchVideoStats(nsfw?: string) {
  const qs = buildQueryString({ nsfw });
  return serverFetch<VideoStats>(`/videos/stats${qs}`, {
    tags: ["videos"],
  });
}
