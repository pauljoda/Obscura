import type {
  EntityKind,
  AudioLibraryDetailDto,
  AudioLibraryListItemDto,
  AudioLibraryPatchDto,
  AudioTrackPatchDto,
  GalleryDetailDto,
  GalleryListItemDto,
  GalleryImagesPageDto,
  GalleryStatsDto,
  ImageDetailDto,
  ImageListItemDto,
  SearchResponseDto,
} from "@obscura/contracts";
import { buildQueryString, fetchApi, uploadFile } from "./core";
import type { MarkerDto, SceneDetail, SceneListItem, SceneStats } from "./types";

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
  nsfw?: string;
}): Promise<{ scenes: SceneListItem[]; total: number; limit: number; offset: number }> {
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

  return fetchApi(`/scenes${qs}`);
}

export async function fetchSceneDetail(id: string): Promise<SceneDetail> {
  return fetchApi(`/scenes/${id}`);
}

export async function updateScene(
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
  },
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/scenes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteScene(
  id: string,
  deleteFile?: boolean,
): Promise<{ ok: true }> {
  const qs = deleteFile ? "?deleteFile=true" : "";
  return fetchApi(`/scenes/${id}${qs}`, { method: "DELETE" });
}

export async function createMarker(
  sceneId: string,
  data: { title: string; seconds: number; endSeconds?: number | null; primaryTagName?: string | null },
): Promise<MarkerDto> {
  return fetchApi(`/scenes/${sceneId}/markers`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMarker(
  markerId: string,
  data: { title?: string; seconds?: number; endSeconds?: number | null; primaryTagName?: string | null },
): Promise<{ ok: true }> {
  return fetchApi(`/scenes/markers/${markerId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMarker(markerId: string): Promise<{ ok: true }> {
  return fetchApi(`/scenes/markers/${markerId}`, { method: "DELETE" });
}

export async function trackPlay(sceneId: string): Promise<{ ok: true }> {
  return fetchApi(`/scenes/${sceneId}/play`, { method: "POST" });
}

export async function trackOrgasm(sceneId: string): Promise<{ ok: true; orgasmCount: number }> {
  return fetchApi(`/scenes/${sceneId}/orgasm`, { method: "POST" });
}

export async function fetchSceneStats(nsfw?: string): Promise<SceneStats> {
  const qs = buildQueryString({ nsfw });
  return fetchApi(`/scenes/stats${qs}`);
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
}): Promise<{ galleries: GalleryListItemDto[]; total: number; limit: number; offset: number }> {
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

  return fetchApi(`/galleries${qs}`);
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
}): Promise<{ items: AudioLibraryListItemDto[]; total: number }> {
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

  return fetchApi(`/audio-libraries${qs}`);
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
): Promise<GalleryImagesPageDto> {
  const qs = buildQueryString({
    limit: params?.limit,
    offset: params?.offset,
  });

  return fetchApi(`/galleries/${id}/images${qs}`);
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

export async function deleteGallery(id: string): Promise<{ ok: true }> {
  return fetchApi(`/galleries/${id}`, { method: "DELETE" });
}

export async function fetchImages(params?: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
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
}): Promise<{ images: ImageListItemDto[]; total: number; limit: number; offset: number }> {
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

  return fetchApi(`/images${qs}`);
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

export async function uploadAudioLibraryCover(
  id: string,
  file: File,
): Promise<{ ok: true; coverImagePath: string }> {
  return uploadFile(`/audio-libraries/${id}/cover`, file);
}

export async function deleteAudioLibraryCover(id: string): Promise<{ ok: true }> {
  return fetchApi(`/audio-libraries/${id}/cover`, { method: "DELETE" });
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

export async function uploadThumbnail(
  sceneId: string,
  file: File,
): Promise<{ ok: true; thumbnailPath: string }> {
  return uploadFile(`/scenes/${sceneId}/thumbnail`, file);
}

export async function deleteThumbnail(
  sceneId: string,
): Promise<{ ok: true; thumbnailPath: string }> {
  return fetchApi(`/scenes/${sceneId}/thumbnail`, {
    method: "DELETE",
  });
}

export async function uploadThumbnailFromUrl(
  sceneId: string,
  imageUrl: string,
): Promise<{ ok: true; thumbnailPath: string }> {
  return fetchApi(`/scenes/${sceneId}/thumbnail/from-url`, {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
  });
}

export async function generateThumbnailFromFrame(
  sceneId: string,
  seconds: number,
): Promise<{ ok: true; thumbnailPath: string; seconds: number }> {
  return fetchApi(`/scenes/${sceneId}/thumbnail/from-frame`, {
    method: "POST",
    body: JSON.stringify({ seconds }),
  });
}
