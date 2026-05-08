import type {
  GalleryDetailDto,
  GalleryListItemDto,
  GalleryStatsDto,
  ImageDetailDto,
  ImageListItemDto,
  ScrapeResultDto,
  AudioLibraryListItemDto,
  AudioLibraryDetailDto,
  AudioLibraryStatsDto,
  AudioTrackDetailDto,
  VideoSeriesDetailDto,
  VideoSeriesListItemDto,
  CollectionListItemDto,
  CollectionDetailDto,
  CollectionItemDto,
  CollectionRulePreviewDto,
  CollectionRuleGroup,
  PaginatedResponse,
} from "@obscura/contracts";
import { buildQueryString, serverFetch } from "./core";
import type {
  PerformerDetail,
  PerformerItem,
  StudioItem,
  TagItem,
} from "../api/types";

export async function fetchGalleries(
  params?: {
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
    comic?: string;
    nsfw?: string;
    limit?: number;
    offset?: number;
  },
  options?: { fetch?: typeof fetch },
) {
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
      comic: params?.comic,
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
    { fetch: options?.fetch },
  );
}

export async function fetchGalleryDetail(
  id: string,
  options?: { fetch?: typeof fetch; imageLimit?: number; imageOffset?: number },
) {
  const qs = buildQueryString({
    imageLimit: options?.imageLimit,
    imageOffset: options?.imageOffset,
  });
  return serverFetch<GalleryDetailDto>(`/galleries/${id}${qs}`, { fetch: options?.fetch });
}

export async function fetchImageDetail(id: string, options?: { fetch?: typeof fetch }) {
  return serverFetch<ImageDetailDto>(`/images/${id}`, { fetch: options?.fetch });
}

export async function fetchGalleryStats() {
  return serverFetch<GalleryStatsDto>("/galleries/stats", {
    tags: ["galleries"],
  });
}

export async function fetchImages(
  params?: {
    search?: string;
    sort?: string;
    order?: string;
    gallery?: string;
    tag?: string[];
    performer?: string[];
    studio?: string;
    format?: string[];
    animated?: string;
    dimension?: string[];
    nsfw?: string;
    ratingMin?: number;
    ratingMax?: number;
    dateFrom?: string;
    dateTo?: string;
    resolution?: string;
    organized?: string;
    comic?: string;
    limit?: number;
    offset?: number;
  },
  options?: { fetch?: typeof fetch },
) {
  const qs = buildQueryString(
    {
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      gallery: params?.gallery,
      studio: params?.studio,
      animated: params?.animated,
      nsfw: params?.nsfw,
      ratingMin: params?.ratingMin,
      ratingMax: params?.ratingMax,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      resolution: params?.resolution,
      organized: params?.organized,
      comic: params?.comic,
      limit: params?.limit,
      offset: params?.offset,
    },
    {
      tag: params?.tag,
      performer: params?.performer,
      format: params?.format,
      dimension: params?.dimension,
    },
  );

  return serverFetch<{ images: ImageListItemDto[]; total: number; limit: number; offset: number }>(
    `/images${qs}`,
    { fetch: options?.fetch },
  );
}

export async function fetchStudios(
  params?: { nsfw?: string },
  options?: { fetch?: typeof fetch },
) {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return serverFetch<{ studios: StudioItem[] }>(`/studios${qs}`, {
    fetch: options?.fetch,
  });
}

export async function fetchTags(
  params?: { nsfw?: string },
  options?: { fetch?: typeof fetch },
) {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return serverFetch<{ tags: TagItem[] }>(`/tags${qs}`, {
    fetch: options?.fetch,
  });
}

export async function fetchPerformers(
  params?: {
    search?: string;
    sort?: string;
    order?: string;
    gender?: string;
    favorite?: string;
    country?: string;
    ratingMin?: number;
    ratingMax?: number;
    hasImage?: string;
    videoCountMin?: number;
    counts?: string;
    limit?: number;
    offset?: number;
    nsfw?: string;
  },
  options?: { fetch?: typeof fetch },
) {
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
    videoCountMin: params?.videoCountMin,
    counts: params?.counts,
    limit: params?.limit,
    offset: params?.offset,
    nsfw: params?.nsfw,
  });

  return serverFetch<{
    performers: PerformerItem[];
    total: number;
    limit: number;
    offset: number;
  }>(`/performers${qs}`, { fetch: options?.fetch });
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
  videoId?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = buildQueryString({
    status: params?.status,
    videoId: params?.videoId,
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

const SCRAPE_RESULTS_PAGE_SIZE = 500;

export async function fetchAllPendingScrapeResults(): Promise<{
  results: ScrapeResultDto[];
  total: number;
}> {
  const results: ScrapeResultDto[] = [];
  let offset = 0;
  let total = 0;
  for (;;) {
    const res = await fetchScrapeResults({
      status: "pending",
      limit: SCRAPE_RESULTS_PAGE_SIZE,
      offset,
    });
    total = res.total;
    results.push(...res.results);
    if (res.results.length < SCRAPE_RESULTS_PAGE_SIZE || results.length >= total) break;
    offset += SCRAPE_RESULTS_PAGE_SIZE;
  }
  return { results, total };
}

// ─── Audio ────────────────────────────────────────────────────

export async function fetchAudioLibraries(
  params?: {
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
  },
  options?: { fetch?: typeof fetch },
) {
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
    { fetch: options?.fetch },
  );
}

export async function fetchAudioLibraryDetail(id: string, options?: { fetch?: typeof fetch }) {
  return serverFetch<AudioLibraryDetailDto>(`/audio-libraries/${id}`, { fetch: options?.fetch });
}

export async function fetchAudioTrackDetail(id: string, options?: { fetch?: typeof fetch }) {
  return serverFetch<AudioTrackDetailDto>(`/audio-tracks/${id}`, { fetch: options?.fetch });
}

export async function fetchAudioLibraryStats(nsfw?: string) {
  const qs = buildQueryString({ nsfw });
  return serverFetch<AudioLibraryStatsDto>(`/audio-libraries/stats${qs}`, {
    tags: ["audio-libraries"],
  });
}

// ─── Collections ──────────────────────────────────────────────────

export async function fetchCollections(
  params: {
    search?: string;
    sort?: string;
    order?: "asc" | "desc";
    mode?: string;
    limit?: number;
    offset?: number;
    nsfw?: string;
  },
  options?: { fetch?: typeof fetch },
) {
  const qs = buildQueryString(params);
  return serverFetch<PaginatedResponse<CollectionListItemDto>>(
    `/collections${qs}`,
    { fetch: options?.fetch },
  );
}

export async function fetchCollectionDetail(id: string, options?: { fetch?: typeof fetch }) {
  return serverFetch<CollectionDetailDto>(`/collections/${id}`, { fetch: options?.fetch });
}

export async function fetchCollectionItems(
  id: string,
  params: {
    limit?: number;
    offset?: number;
    entityType?: string;
    nsfw?: string;
  } = {},
) {
  const qs = buildQueryString(params);
  return serverFetch<PaginatedResponse<CollectionItemDto>>(
    `/collections/${id}/items${qs}`,
    { revalidate: 0, tags: ["collections", `collection-${id}`] },
  );
}
