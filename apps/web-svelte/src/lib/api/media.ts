import type {
  EntityKind,
  AudioLibraryDetailDto,
  AudioLibraryListItemDto,
  AudioLibraryPatchDto,
  AudioLibraryStatsDto,
  AudioTrackListItemDto,
  AudioTrackPatchDto,
  GalleryDetailDto,
  GalleryListItemDto,
  GalleryImagesPageDto,
  GalleryStatsDto,
  ImageDetailDto,
  ImageListItemDto,
  SearchResponseDto,
  CollectionListItemDto,
  CollectionDetailDto,
  CollectionItemDto,
  CollectionCreateDto,
  CollectionPatchDto,
  CollectionAddItemsDto,
  CollectionRemoveItemsDto,
  CollectionReorderDto,
  CollectionRuleGroup,
  CollectionRulePreviewDto,
  PaginatedResponse,
} from "@obscura/contracts";
import { buildQueryString, fetchApi, uploadFile } from "./core";

export interface RequestOptions {
  signal?: AbortSignal;
}

export async function deleteImage(
  id: string,
  deleteFile?: boolean,
): Promise<{ ok: true }> {
  const qs = deleteFile ? "?deleteFile=true" : "";
  return fetchApi(`/images/${id}${qs}`, { method: "DELETE" });
}

export async function deleteAudioTrack(
  id: string,
  deleteFile?: boolean,
): Promise<{ ok: true }> {
  const qs = deleteFile ? "?deleteFile=true" : "";
  return fetchApi(`/audio-tracks/${id}${qs}`, { method: "DELETE" });
}

export async function fetchGalleries(params?: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
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
}, options?: RequestOptions): Promise<{ galleries: GalleryListItemDto[]; total: number; limit: number; offset: number }> {
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

  return fetchApi(`/galleries${qs}`, { signal: options?.signal });
}

export async function fetchAudioLibraries(params?: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
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
}, options?: RequestOptions): Promise<{ items: AudioLibraryListItemDto[]; total: number }> {
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

  return fetchApi(`/audio-libraries${qs}`, { signal: options?.signal });
}

export async function fetchAudioTracks(params?: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  library?: string;
  tag?: string | string[];
  performer?: string | string[];
  studio?: string;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  organized?: string;
  nsfw?: string;
  limit?: number;
  offset?: number;
}, options?: RequestOptions): Promise<{ items: AudioTrackListItemDto[]; total: number }> {
  const toList = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value : value ? [value] : undefined;
  const qs = buildQueryString(
    {
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      library: params?.library,
      studio: params?.studio,
      ratingMin: params?.ratingMin,
      ratingMax: params?.ratingMax,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      organized: params?.organized,
      nsfw: params?.nsfw,
      limit: params?.limit,
      offset: params?.offset,
    },
    {
      tag: toList(params?.tag),
      performer: toList(params?.performer),
    },
  );

  return fetchApi(`/audio-tracks${qs}`, { signal: options?.signal });
}

export async function fetchAudioLibraryStats(
  nsfw?: string,
): Promise<AudioLibraryStatsDto> {
  const qs = buildQueryString({ nsfw });
  return fetchApi(`/audio-libraries/stats${qs}`);
}

export async function fetchGalleryDetail(
  id: string,
  params?: { imageLimit?: number; imageOffset?: number },
): Promise<GalleryDetailDto> {
  const qs = buildQueryString({
    imageLimit: params?.imageLimit,
    imageOffset: params?.imageOffset,
  });
  return fetchApi(`/galleries/${id}${qs}`);
}

export async function fetchGalleryImages(
  id: string,
  params?: { limit?: number; offset?: number },
  options?: RequestOptions,
): Promise<GalleryImagesPageDto> {
  const qs = buildQueryString({
    limit: params?.limit,
    offset: params?.offset,
  });

  return fetchApi(`/galleries/${id}/images${qs}`, { signal: options?.signal });
}

export async function fetchGalleryStats(): Promise<GalleryStatsDto> {
  return fetchApi("/galleries/stats");
}

export async function updateGallery(
  id: string,
  data: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    organized?: boolean;
    isNsfw?: boolean;
    photographer?: string | null;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
  },
): Promise<{ ok: true; id: string; affectedGalleryIds?: string[] }> {
  return fetchApi(`/galleries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function createGallery(data: {
  title: string;
  details?: string | null;
  date?: string | null;
}): Promise<{ ok: true; id: string }> {
  return fetchApi("/galleries", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteGallery(
  id: string,
  deleteFile?: boolean,
): Promise<{ ok: true }> {
  const qs = deleteFile ? "?deleteFile=true" : "";
  return fetchApi(`/galleries/${id}${qs}`, { method: "DELETE" });
}

export async function fetchImages(params?: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
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
  limit?: number;
  offset?: number;
}, options?: RequestOptions): Promise<{ images: ImageListItemDto[]; total: number; limit: number; offset: number }> {
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

  return fetchApi(`/images${qs}`, { signal: options?.signal });
}

export async function fetchImageDetail(id: string): Promise<ImageDetailDto> {
  return fetchApi(`/images/${id}`);
}

export async function updateImage(
  id: string,
  data: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    organized?: boolean;
    isNsfw?: boolean;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
  },
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/images/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchAudioLibraryDetail(
  id: string,
  params?: { trackLimit?: number; trackOffset?: number },
): Promise<AudioLibraryDetailDto> {
  const qs = buildQueryString({
    trackLimit: params?.trackLimit,
    trackOffset: params?.trackOffset,
  });
  return fetchApi(`/audio-libraries/${id}${qs}`);
}

export async function updateAudioLibrary(
  id: string,
  data: AudioLibraryPatchDto,
): Promise<{ ok: true }> {
  return fetchApi(`/audio-libraries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAudioLibrary(
  id: string,
  deleteFile?: boolean,
): Promise<{ ok: true }> {
  const qs = deleteFile ? "?deleteFile=true" : "";
  return fetchApi(`/audio-libraries/${id}${qs}`, { method: "DELETE" });
}

export async function uploadAudioLibraryCover(
  id: string,
  file: File,
): Promise<{ ok: true; coverImagePath: string }> {
  return uploadFile(`/audio-libraries/${id}/cover`, file);
}

export async function deleteAudioLibraryCover(id: string): Promise<{ ok: true }> {
  return fetchApi(`/audio-libraries/${id}/cover`, { method: "DELETE" });
}

export async function setGalleryCoverFromImage(
  galleryId: string,
  imageId: string,
): Promise<{ ok: true }> {
  return fetchApi(`/galleries/${galleryId}/cover`, {
    method: "POST",
    body: JSON.stringify({ imageId }),
  });
}

export async function uploadGalleryCover(
  galleryId: string,
  file: File,
): Promise<{ ok: true; coverImagePath: string }> {
  return uploadFile(`/galleries/${galleryId}/cover/upload`, file);
}

export async function deleteGalleryCover(galleryId: string): Promise<{ ok: true }> {
  return fetchApi(`/galleries/${galleryId}/cover`, { method: "DELETE" });
}

export async function uploadImageThumbnail(
  imageId: string,
  file: File,
): Promise<{ ok: true; thumbnailPath: string }> {
  return uploadFile(`/images/${imageId}/thumbnail`, file);
}

export async function resetImageThumbnail(
  imageId: string,
): Promise<{ ok: true; thumbnailPath: string }> {
  return fetchApi(`/images/${imageId}/thumbnail`, { method: "DELETE" });
}

export async function updateAudioTrack(
  id: string,
  data: AudioTrackPatchDto,
): Promise<{ ok: true }> {
  return fetchApi(`/audio-tracks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchSearch(
  params: {
    q: string;
    kinds?: EntityKind[];
    kind?: EntityKind;
    limit?: number;
    offset?: number;
    rating?: number;
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
    nsfw?: string;
  },
  signal?: AbortSignal,
): Promise<SearchResponseDto> {
  const qs = buildQueryString(
    {
      q: params.q,
      kinds: params.kinds?.length ? params.kinds.join(",") : undefined,
      kind: params.kind,
      limit: params.limit,
      offset: params.offset,
      rating: params.rating,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      tags: params.tags?.length ? params.tags.join(",") : undefined,
      nsfw: params.nsfw,
    },
  );

  return fetchApi(`/search${qs}`, { signal });
}

// ─── Collections ──────────────────────────────────────────────────

export async function fetchCollections(params: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  mode?: string;
  limit?: number;
  offset?: number;
}, options?: RequestOptions) {
  const qs = buildQueryString(params);
  return fetchApi<PaginatedResponse<CollectionListItemDto>>(
    `/collections${qs}`,
    { signal: options?.signal },
  );
}

export async function fetchCollectionDetail(id: string) {
  return fetchApi<CollectionDetailDto>(`/collections/${id}`);
}

export async function fetchCollectionItems(
  id: string,
  params: {
    limit?: number;
    offset?: number;
    entityType?: string;
  } = {},
  options?: RequestOptions,
) {
  const qs = buildQueryString(params);
  return fetchApi<PaginatedResponse<CollectionItemDto>>(
    `/collections/${id}/items${qs}`,
    { signal: options?.signal },
  );
}

export async function createCollection(dto: CollectionCreateDto) {
  return fetchApi<CollectionDetailDto>("/collections", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function updateCollection(id: string, dto: CollectionPatchDto) {
  return fetchApi<CollectionDetailDto>(`/collections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export async function uploadCollectionCover(
  id: string,
  file: File,
): Promise<{ ok: true; coverImagePath: string }> {
  return uploadFile(`/collections/${id}/cover`, file);
}

export async function deleteCollectionCover(id: string): Promise<{ ok: true }> {
  return fetchApi(`/collections/${id}/cover`, { method: "DELETE" });
}

export async function deleteCollection(id: string) {
  return fetchApi<{ id: string }>(`/collections/${id}`, {
    method: "DELETE",
  });
}

export async function addCollectionItems(
  id: string,
  dto: CollectionAddItemsDto,
) {
  return fetchApi<{ added: number }>(`/collections/${id}/items`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function removeCollectionItems(
  id: string,
  dto: CollectionRemoveItemsDto,
) {
  return fetchApi<{ removed: number }>(`/collections/${id}/items/remove`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function reorderCollectionItems(
  id: string,
  dto: CollectionReorderDto,
) {
  return fetchApi<{ reordered: number }>(
    `/collections/${id}/items/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify(dto),
    },
  );
}

export async function refreshCollection(id: string) {
  return fetchApi<{ refreshed: boolean; itemCount?: number }>(
    `/collections/${id}/refresh`,
    { method: "POST" },
  );
}

export async function previewCollectionRules(ruleTree: CollectionRuleGroup) {
  return fetchApi<CollectionRulePreviewDto>("/collections/preview-rules", {
    method: "POST",
    body: JSON.stringify({ ruleTree }),
  });
}
