/**
 * Server-side fetchers for the new /videos route stack.
 *
 * Mirrors the shape of the scene fetchers in ./media.ts so the new
 * videos page can drop-in replace its imports. Return types reuse
 * the existing scene/scene-folder DTO types.
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

  return serverFetch<{ scenes: VideoListItem[]; total: number; limit: number; offset: number }>(
    `/videos${qs}`,
    { tags: ["videos"] },
  );
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
