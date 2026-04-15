/**
 * Server-side fetchers for the new /videos route stack.
 *
 * Mirrors the shape of the scene fetchers in ./media.ts so the new
 * videos page can drop-in replace its imports. Return types reuse
 * the existing scene/scene-folder DTO types.
 */
import type {
  SceneFolderDetailDto,
  SceneFolderListItemDto,
} from "@obscura/contracts";
import { buildQueryString, serverFetch } from "./core";
import type {
  VideoDetail,
  SceneListItem,
  SceneStats,
} from "../api/types";

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
  seasonNumber?: string;
  // Accepted for spread-compatibility with videosListPrefsToFetchParams.
  // The /videos backend does not yet filter on these; they are ignored.
  tag?: string[];
  performer?: string[];
  studio?: string[];
  codec?: string[];
  interactive?: string;
}) {
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
      seasonNumber: params.seasonNumber,
    },
    {
      resolution: params.resolution,
    },
  );

  return serverFetch<{ scenes: SceneListItem[]; total: number; limit: number; offset: number }>(
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
  return serverFetch<SceneStats>(`/videos/stats${qs}`, {
    tags: ["videos"],
  });
}

export async function fetchVideoFolders(params?: {
  parent?: string;
  root?: string;
  search?: string;
  limit?: number;
  offset?: number;
  nsfw?: string;
}) {
  const qs = buildQueryString({
    parent: params?.parent,
    root: params?.root,
    search: params?.search,
    limit: params?.limit,
    offset: params?.offset,
    nsfw: params?.nsfw,
  });
  return serverFetch<{
    items: SceneFolderListItemDto[];
    total: number;
    limit: number;
    offset: number;
  }>(`/video-folders${qs}`, {
    revalidate: 0,
    tags: ["video-folders"],
  });
}

export async function fetchVideoFolderDetail(
  id: string,
  params?: { nsfw?: string },
) {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return serverFetch<SceneFolderDetailDto>(`/video-folders/${id}${qs}`, {
    revalidate: 0,
    tags: ["video-folders", `video-folder-${id}`],
  });
}
