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
import { buildQueryString, serverFetch } from "./core-v1";
import {
  buildFetchVideosQuery,
  type FetchVideosParams,
} from "$lib/v1/api/video-query-v1";
import {
  buildVideoSeriesListQuery,
  type VideoSeriesListQueryParams,
} from "$lib/v1/api/query-builders-v1";
import type {
  VideoDetail,
  VideoListItem,
  VideoStats,
} from "$lib/v1/api/types-v1";

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
  params?: VideoSeriesListQueryParams,
  options?: { fetch?: typeof fetch },
) {
  const qs = buildVideoSeriesListQuery(params);
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
