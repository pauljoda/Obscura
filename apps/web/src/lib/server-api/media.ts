import type {
  GalleryDetailDto,
  GalleryListItemDto,
  GalleryStatsDto,
  ImageListItemDto,
  ScrapeResultDto,
  AudioLibraryListItemDto,
  AudioLibraryDetailDto,
  AudioLibraryStatsDto,
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
  studio?: string[];
  resolution?: string[];
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  durationMin?: number;
  durationMax?: number;
  organized?: string;
  interactive?: string;
  hasFile?: string;
  played?: string;
  codec?: string[];
  limit?: number;
  offset?: number;
  /** Pass current mode; API excludes NSFW when `off`. */
  nsfw?: string;
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
      interactive: params.interactive,
      hasFile: params.hasFile,
      played: params.played,
      limit: params.limit,
      offset: params.offset,
      nsfw: params.nsfw,
    },
    {
      tag: params.tag,
      performer: params.performer,
      resolution: params.resolution,
      studio: params.studio,
      codec: params.codec,
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

export async function fetchSceneStats(nsfw?: string) {
  const qs = buildQueryString({ nsfw });
  return serverFetch<SceneStats>(`/scenes/stats${qs}`, {
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
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  imageCountMin?: number;
  organized?: string;
  nsfw?: string;
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
      ratingMin: params?.ratingMin,
      ratingMax: params?.ratingMax,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      imageCountMin: params?.imageCountMin,
      organized: params?.organized,
      nsfw: params?.nsfw,
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
    revalidate: 0,
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
  nsfw?: string;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  resolution?: string;
  organized?: string;
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
      nsfw: params?.nsfw,
      ratingMin: params?.ratingMin,
      ratingMax: params?.ratingMax,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      resolution: params?.resolution,
      organized: params?.organized,
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

export async function fetchStudios(params?: { nsfw?: string }) {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return serverFetch<{ studios: StudioItem[] }>(`/studios${qs}`, {
    tags: ["studios"],
  });
}

export async function fetchTags(params?: { nsfw?: string }) {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return serverFetch<{ tags: TagItem[] }>(`/tags${qs}`, {
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
  ratingMin?: number;
  ratingMax?: number;
  hasImage?: string;
  sceneCountMin?: number;
  limit?: number;
  offset?: number;
  nsfw?: string;
}) {
  const qs = buildQueryString({
    search: params?.search,
    sort: params?.sort,
    order: params?.order,
    gender: params?.gender,
    favorite: params?.favorite,
    country: params?.country,
    ratingMin: params?.ratingMin,
    ratingMax: params?.ratingMax,
    hasImage: params?.hasImage,
    sceneCountMin: params?.sceneCountMin,
    limit: params?.limit,
    offset: params?.offset,
    nsfw: params?.nsfw,
  });

  return serverFetch<{
    performers: PerformerItem[];
    total: number;
    limit: number;
    offset: number;
  }>(`/performers${qs}`, { tags: ["performers"] });
}

export async function fetchPerformerDetail(id: string, params?: { nsfw?: string }) {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return serverFetch<PerformerDetail>(`/performers/${id}${qs}`, {
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

// ─── Audio ────────────────────────────────────────────────────

export async function fetchAudioLibraries(params?: {
  search?: string;
  sort?: string;
  order?: string;
  tag?: string[];
  performer?: string[];
  studio?: string;
  parent?: string;
  root?: string;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  trackCountMin?: number;
  organized?: string;
  nsfw?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = buildQueryString(
    {
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      studio: params?.studio,
      parent: params?.parent,
      root: params?.root,
      ratingMin: params?.ratingMin,
      ratingMax: params?.ratingMax,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      trackCountMin: params?.trackCountMin,
      organized: params?.organized,
      nsfw: params?.nsfw,
      limit: params?.limit,
      offset: params?.offset,
    },
    {
      tag: params?.tag,
      performer: params?.performer,
    },
  );

  return serverFetch<{ items: AudioLibraryListItemDto[]; total: number }>(
    `/audio-libraries${qs}`,
    { tags: ["audio-libraries"] },
  );
}

export async function fetchAudioLibraryDetail(id: string) {
  return serverFetch<AudioLibraryDetailDto>(`/audio-libraries/${id}`, {
    revalidate: 0,
    tags: ["audio-libraries", `audio-library-${id}`],
  });
}

export async function fetchAudioLibraryStats(nsfw?: string) {
  const qs = buildQueryString({ nsfw });
  return serverFetch<AudioLibraryStatsDto>(`/audio-libraries/stats${qs}`, {
    tags: ["audio-libraries"],
  });
}
