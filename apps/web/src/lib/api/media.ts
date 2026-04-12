import type {
  EntityKind,
  AudioLibraryDetailDto,
  AudioLibraryListItemDto,
  AudioLibraryPatchDto,
  AudioLibraryStatsDto,
  AudioTrackPatchDto,
  GalleryDetailDto,
  GalleryListItemDto,
  GalleryImagesPageDto,
  GalleryStatsDto,
  ImageDetailDto,
  ImageListItemDto,
  SceneFolderDetailDto,
  SceneFolderListItemDto,
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
import type {
  MarkerDto,
  SceneDetail,
  SceneListItem,
  SceneStats,
} from "./types";

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
  sceneFolderId?: string;
  folderScope?: "direct" | "subtree";
  uncategorized?: boolean;
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
      sceneFolderId: params.sceneFolderId,
      folderScope: params.folderScope,
      uncategorized: params.uncategorized ? "true" : undefined,
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

const FETCH_ALL_PAGE_SIZE = 2000;

/** Fetches every matching scene by paging until `total` is reached (Identify / bulk flows). */
export async function fetchAllScenes(
  params: Omit<Parameters<typeof fetchScenes>[0], "limit" | "offset">,
): Promise<{ scenes: SceneListItem[]; total: number }> {
  const scenes: SceneListItem[] = [];
  let offset = 0;
  let total = 0;
  for (;;) {
    const res = await fetchScenes({ ...params, limit: FETCH_ALL_PAGE_SIZE, offset });
    total = res.total;
    scenes.push(...res.scenes);
    if (res.scenes.length < FETCH_ALL_PAGE_SIZE || scenes.length >= total) break;
    offset += FETCH_ALL_PAGE_SIZE;
  }
  return { scenes, total };
}

export async function fetchSceneDetail(id: string): Promise<SceneDetail> {
  return fetchApi(`/scenes/${id}`);
}

export async function fetchSceneSubtitleCues(
  sceneId: string,
  trackId: string,
): Promise<{ cues: import("@obscura/contracts").SubtitleCueDto[] }> {
  return fetchApi(`/scenes/${sceneId}/subtitles/${trackId}/cues`);
}

/**
 * Fetch the raw source file (e.g. .ass) for a subtitle track. Used by the ASS
 * renderer to hand the original file to libass/JASSUB with all styling intact.
 */
export async function fetchSceneSubtitleSource(
  sceneId: string,
  trackId: string,
): Promise<string> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const res = await fetch(`${base}/scenes/${sceneId}/subtitles/${trackId}/source`);
  if (!res.ok) {
    throw new Error(`Failed to load subtitle source: ${res.status}`);
  }
  return res.text();
}

export async function uploadSceneSubtitle(
  sceneId: string,
  file: File,
  language: string,
  label?: string,
): Promise<{ track: import("@obscura/contracts").SceneSubtitleTrackDto }> {
  const form = new FormData();
  form.append("language", language);
  if (label) form.append("label", label);
  form.append("file", file);
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/scenes/${sceneId}/subtitles`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    throw new Error((await res.text()) || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteSceneSubtitle(
  sceneId: string,
  trackId: string,
): Promise<{ ok: true }> {
  return fetchApi(`/scenes/${sceneId}/subtitles/${trackId}`, { method: "DELETE" });
}

export async function updateSceneSubtitle(
  sceneId: string,
  trackId: string,
  patch: { language?: string; label?: string | null },
): Promise<{ track: import("@obscura/contracts").SceneSubtitleTrackDto }> {
  return fetchApi(`/scenes/${sceneId}/subtitles/${trackId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function extractSceneSubtitles(
  sceneId: string,
): Promise<{ enqueued: boolean; jobId: string | null }> {
  return fetchApi(`/scenes/${sceneId}/subtitles/extract`, { method: "POST" });
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

export async function resetSceneMetadata(
  id: string,
): Promise<{ ok: true; id: string; title: string }> {
  return fetchApi(`/scenes/${id}/reset-metadata`, { method: "POST" });
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

export async function createMarker(
  sceneId: string,
  data: { title: string; seconds: number; endSeconds?: number | null },
): Promise<MarkerDto> {
  return fetchApi(`/scenes/${sceneId}/markers`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMarker(
  markerId: string,
  data: { title?: string; seconds?: number; endSeconds?: number | null },
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

export async function fetchSceneFolders(params?: {
  parent?: string;
  root?: string;
  search?: string;
  limit?: number;
  offset?: number;
  nsfw?: string;
  studio?: string;
  tag?: string;
}): Promise<{ items: SceneFolderListItemDto[]; total: number; limit: number; offset: number }> {
  const qs = buildQueryString({
    parent: params?.parent,
    root: params?.root,
    search: params?.search,
    limit: params?.limit,
    offset: params?.offset,
    nsfw: params?.nsfw,
    studio: params?.studio,
    tag: params?.tag,
  });
  return fetchApi(`/scene-folders${qs}`);
}

export async function fetchSceneFolderDetail(
  id: string,
  params?: { nsfw?: string },
): Promise<SceneFolderDetailDto> {
  const qs = buildQueryString({ nsfw: params?.nsfw });
  return fetchApi(`/scene-folders/${id}${qs}`);
}

export async function updateSceneFolder(
  id: string,
  data: {
    isNsfw?: boolean;
    customName?: string | null;
    details?: string | null;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
    rating?: number | null;
    date?: string | null;
  },
): Promise<{ ok: true; id: string }> {
  return fetchApi(`/scene-folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function uploadSceneFolderCover(
  id: string,
  file: File,
): Promise<{ ok: true; coverImagePath: string }> {
  return uploadFile(`/scene-folders/${id}/cover`, file);
}

export async function deleteSceneFolderCover(
  id: string,
): Promise<{ ok: true }> {
  return fetchApi(`/scene-folders/${id}/cover`, { method: "DELETE" });
}

export async function uploadSceneFolderBackdrop(
  id: string,
  file: File,
): Promise<{ ok: true; backdropImagePath: string }> {
  return uploadFile(`/scene-folders/${id}/backdrop`, file);
}

export async function deleteSceneFolderBackdrop(
  id: string,
): Promise<{ ok: true }> {
  return fetchApi(`/scene-folders/${id}/backdrop`, { method: "DELETE" });
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

// ─── Collections ──────────────────────────────────────────────────

export async function fetchCollections(params: {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  mode?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = buildQueryString(params);
  return fetchApi<PaginatedResponse<CollectionListItemDto>>(
    `/collections${qs}`,
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
) {
  const qs = buildQueryString(params);
  return fetchApi<PaginatedResponse<CollectionItemDto>>(
    `/collections/${id}/items${qs}`,
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
