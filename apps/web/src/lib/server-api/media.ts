import type {
  GalleryDetailDto,
  GalleryListItemDto,
  GalleryStatsDto,
  ImageListItemDto,
  ScrapeResultDto,
} from "@obscura/contracts";
import { buildQueryString, serverFetch } from "./core";
import type {
  PerformerDetail,
  PerformerItem,
  SceneDetail,
  SceneListItem,
  SceneStats,
  StudioItem,
  TagItem,
} from "../api/types";

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
}) {
  const qs = buildQueryString(
    {
      search: params.search,
      sort: params.sort,
      order: params.order,
      resolution: params.resolution,
      studio: params.studio,
      limit: params.limit,
      offset: params.offset,
    },
    {
      tag: params.tag,
      performer: params.performer,
    },
  );

  return serverFetch<{ scenes: SceneListItem[]; total: number; limit: number; offset: number }>(
    `/scenes${qs}`,
    { tags: ["scenes"] },
  );
}

export async function fetchSceneDetail(id: string) {
  return serverFetch<SceneDetail>(`/scenes/${id}`, {
    revalidate: 15,
    tags: ["scenes", `scene-${id}`],
  });
}

export async function fetchSceneStats() {
  return serverFetch<SceneStats>("/scenes/stats", {
    tags: ["scenes"],
  });
}

export async function fetchGalleries(params?: {
  search?: string;
  sort?: string;
  order?: string;
  tag?: string[];
  performer?: string[];
  studio?: string;
  type?: string;
  parent?: string;
  root?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = buildQueryString(
    {
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      studio: params?.studio,
      type: params?.type,
      parent: params?.parent,
      root: params?.root,
      limit: params?.limit,
      offset: params?.offset,
    },
    {
      tag: params?.tag,
      performer: params?.performer,
    },
  );

  return serverFetch<{ galleries: GalleryListItemDto[]; total: number; limit: number; offset: number }>(
    `/galleries${qs}`,
    { tags: ["galleries"] },
  );
}

export async function fetchGalleryDetail(id: string) {
  return serverFetch<GalleryDetailDto>(`/galleries/${id}`, {
    revalidate: 15,
    tags: ["galleries", `gallery-${id}`],
  });
}

export async function fetchGalleryStats() {
  return serverFetch<GalleryStatsDto>("/galleries/stats", {
    tags: ["galleries"],
  });
}

export async function fetchImages(params?: {
  search?: string;
  sort?: string;
  order?: string;
  gallery?: string;
  tag?: string[];
  performer?: string[];
  studio?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = buildQueryString(
    {
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      gallery: params?.gallery,
      studio: params?.studio,
      limit: params?.limit,
      offset: params?.offset,
    },
    {
      tag: params?.tag,
      performer: params?.performer,
    },
  );

  return serverFetch<{ images: ImageListItemDto[]; total: number; limit: number; offset: number }>(
    `/images${qs}`,
    { tags: ["images"] },
  );
}

export async function fetchStudios() {
  return serverFetch<{ studios: StudioItem[] }>("/studios", {
    tags: ["studios"],
  });
}

export async function fetchTags() {
  return serverFetch<{ tags: TagItem[] }>("/tags", {
    tags: ["tags"],
  });
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
}) {
  const qs = buildQueryString({
    search: params?.search,
    sort: params?.sort,
    order: params?.order,
    gender: params?.gender,
    favorite: params?.favorite,
    country: params?.country,
    limit: params?.limit,
    offset: params?.offset,
  });

  return serverFetch<{
    performers: PerformerItem[];
    total: number;
    limit: number;
    offset: number;
  }>(`/performers${qs}`, { tags: ["performers"] });
}

export async function fetchPerformerDetail(id: string) {
  return serverFetch<PerformerDetail>(`/performers/${id}`, {
    revalidate: 15,
    tags: ["performers", `performer-${id}`],
  });
}

export async function fetchScrapeResults(params?: {
  status?: string;
  sceneId?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = buildQueryString({
    status: params?.status,
    sceneId: params?.sceneId,
    limit: params?.limit,
    offset: params?.offset,
  });

  return serverFetch<{
    results: ScrapeResultDto[];
    total: number;
    limit: number;
    offset: number;
  }>(`/scrapers/results${qs}`, {
    revalidate: 15,
    tags: ["scrape-results"],
  });
}
