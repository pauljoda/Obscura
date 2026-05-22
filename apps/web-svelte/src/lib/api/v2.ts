import {
  backfillFingerprints,
  browseLibraryPath,
  cancelJobRun,
  cancelJobs,
  clearJobFailures,
  createFileFolder,
  createEntityMarker as createEntityMarkerRequest,
  createJob,
  createLibraryRoot as createLibraryRootRequest,
  deleteFile,
  deleteEntityMarker as deleteEntityMarkerRequest,
  deleteJellyfinUserPlayedItem,
  deleteLibraryRoot as deleteLibraryRootRequest,
  getFileDetail,
  getGetFileContentUrl,
  listEntities,
  listFileChildren,
  listFileRoots,
  listJobs,
  listVideoSeries,
  listVideos,
  moveFile,
  postJellyfinSessionPing,
  postJellyfinSessionPlaying,
  postJellyfinSessionProgress as postJellyfinSessionProgressRequest,
  postJellyfinSessionStopped,
  postJellyfinUserPlayedItem,
  renameFile,
  rebuildPreviews,
  rescanFileRoot,
  updateEntityFlags,
  updateEntityMarker as updateEntityMarkerRequest,
  updateEntityPlayback as updateEntityPlaybackRequest,
  updateEntityRating,
  getSettings,
  uploadFiles,
  getVideoSeries,
  getVideo,
  getImage,
  getGallery,
  getBook,
  getAudioLibrary,
  getAudioTrack,
  getPerson,
  getStudio,
  getTag,
  getCollection,
  getEntityThumbnails,
  getLibraryConfig,
  listPeople,
  listStudios,
  listTags,
  listCollections,
  listAudioLibraries,
  listAudioTracks,
  listBooks,
  listGalleries,
  listImages,
  getVideoSeason,
  updateLibraryRoot as updateLibraryRootRequest,
  updateLibrarySettings,
} from "./generated/obscura-v2";
import type {
  AudioLibraryDetail,
  AudioTrackDetail,
  BookDetail,
  CollectionDetail,
  EntityCapability,
  EntityCard,
  EntityGroup,
  EntityListResponse,
  EntityThumbnail,
  EntityThumbnailBatchResponse,
  FileChildrenResponse,
  FileCreateFolderRequest,
  FileDetail,
  FileEntry,
  FileMoveRequest,
  FileOperationResponse,
  FileRenameRequest,
  FileRescanRequest,
  FileRoot,
  FileRootsResponse,
  GalleryDetail,
  ImageDetail,
  JobListResponse,
  JobRun,
  LibraryBrowseResponse,
  LibraryRoot,
  LibrarySettings,
  PersonDetail,
  PlaybackSessionRequest,
  PlaybackUpdateRequest,
  SettingsResponse,
  StudioDetail,
  TagDetail,
  VideoDetail,
  VideoSeriesDetail,
  VideoSeasonDetail,
} from "./generated/model";
import { fetchV2Api, jellyfinApiPath, v2ApiPath } from "./orval-fetch";

export type V2EntityCapability = EntityCapability;
export type V2EntityCard = EntityThumbnail;
export type V2EntityDetailCard = EntityCard;
export type V2EntityChildGroup = EntityGroup;
export type V2EntityRelationshipGroup = EntityGroup;
export type V2EntityThumbnail = EntityThumbnail;
export type V2EntityListResponse = EntityListResponse;
export type V2VideoListResponse = EntityListResponse;
export type V2VideoDetail = VideoDetail;
export type V2VideoSeriesListResponse = EntityListResponse;
export type V2VideoSeriesDetail = VideoSeriesDetail;
export type V2VideoSeasonDetail = VideoSeasonDetail;
export type V2JobRun = JobRun & {
  targetKind?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
};
export type V2JobListResponse = JobListResponse;
export interface V2JobCreateResponse {
  job: V2JobRun;
}
export interface V2JobCancelResponse {
  cancelled: number;
}
export interface V2JobFailureClearResponse {
  cleared: number;
}
export interface V2BulkJobResponse {
  enqueued: number;
  skipped: number;
}
export type V2ImageDetail = ImageDetail;
export type V2GalleryDetail = GalleryDetail;
export type V2BookDetail = BookDetail;
export type V2AudioLibraryDetail = AudioLibraryDetail;
export type V2AudioTrackDetail = AudioTrackDetail;
export type V2PersonDetail = PersonDetail;
export type V2StudioDetail = StudioDetail;
export type V2TagDetail = TagDetail;
export type V2CollectionDetail = CollectionDetail;
export type V2CollectionListResponse = EntityListResponse;
export type V2TaxonomyListResponse = EntityListResponse;
export type V2SettingsResponse = SettingsResponse;
export type V2MediaListResponse = EntityListResponse;
export interface V2EntityReference {
  id: string;
  kind: string;
  title: string;
  thumbnailUrl?: string | null;
}
type NumericLibrarySettingsFields =
  | "scanIntervalMinutes"
  | "trickplayIntervalSeconds"
  | "previewClipDurationSeconds"
  | "thumbnailQuality"
  | "trickplayQuality"
  | "backgroundWorkerConcurrency"
  | "subtitleFontScale"
  | "subtitlePositionPercent"
  | "subtitleOpacity";

export type V2LibrarySettings = Omit<LibrarySettings, NumericLibrarySettingsFields> & {
  [K in NumericLibrarySettingsFields]: number;
};
export type V2LibraryRoot = LibraryRoot;
export type V2LibraryBrowse = LibraryBrowseResponse;
export type V2FileRoot = FileRoot;
export type V2FileEntry = FileEntry;
export type V2FileDetail = FileDetail;
export type V2FileChildrenResponse = FileChildrenResponse;
export type V2FileOperationResponse = FileOperationResponse;
export interface V2LibraryConfigResponse {
  settings: V2LibrarySettings;
  roots: V2LibraryRoot[];
}

export interface V2FileUploadItem {
  file: File;
  relativePath: string;
}

export interface JellyfinPlaybackInfoRequest {
  UserId?: string | null;
  StartTimeTicks?: number | null;
  AudioStreamIndex?: number | null;
  SubtitleStreamIndex?: number | null;
  MaxStreamingBitrate?: number | null;
  EnableDirectPlay?: boolean | null;
  EnableDirectStream?: boolean | null;
  EnableTranscoding?: boolean | null;
  MediaSourceId?: string | null;
  PlaySessionId?: string | null;
}

export interface JellyfinMediaStreamInfo {
  Index: number;
  Type: string;
  Codec?: string | null;
  Language?: string | null;
  DisplayTitle?: string | null;
  Width?: number | null;
  Height?: number | null;
  AverageFrameRate?: number | null;
  BitRate?: number | null;
  SampleRate?: number | null;
  Channels?: number | null;
  IsDefault?: boolean | null;
  IsForced?: boolean | null;
}

export interface JellyfinMediaSourceInfo {
  Id: string;
  Path: string;
  Protocol: string;
  Container?: string | null;
  Size?: number | null;
  Name?: string | null;
  RunTimeTicks?: number | null;
  SupportsDirectPlay: boolean;
  SupportsDirectStream: boolean;
  SupportsTranscoding: boolean;
  TranscodingUrl?: string | null;
  TranscodingSubProtocol?: string | null;
  TranscodingContainer?: string | null;
  MediaStreams: JellyfinMediaStreamInfo[];
}

export interface JellyfinPlaybackInfoResponse {
  PlaySessionId: string;
  MediaSources: JellyfinMediaSourceInfo[];
  ErrorCode?: string | null;
}

export interface JellyfinPlaybackSessionRequest {
  ItemId: string;
  MediaSourceId?: string | null;
  PlaySessionId?: string | null;
  PositionTicks?: number | null;
  IsPaused?: boolean | null;
  IsMuted?: boolean | null;
}

export interface V2RequestOptions {
  signal?: AbortSignal;
}

export interface V2EntityMetadataUpdateOptions extends V2RequestOptions {
  kind?: string | null;
}

export interface V2EntityMetadataFlagsPatch {
  isFavorite?: boolean | null;
  isNsfw?: boolean | null;
  isOrganized?: boolean | null;
}

export interface V2EntityMetadataPatch {
  title?: string | null;
  description?: string | null;
  externalIds: Record<string, string>;
  urls: string[];
  tags: string[];
  studio?: string | null;
  credits: unknown[];
  dates: Record<string, string>;
  stats: Record<string, number>;
  positions: Record<string, number>;
  classification?: string | null;
  rating?: number | null;
  flags?: V2EntityMetadataFlagsPatch | null;
}

export interface V2EntityMetadataUpdateRequest {
  fields: string[];
  patch: V2EntityMetadataPatch;
}

type GeneratedResponse<T> = {
  data: T;
  status: number;
};

function problemMessage(data: unknown): string | null {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
    if (typeof record.detail === "string") return record.detail;
    if (typeof record.title === "string") return record.title;
  }

  if (typeof data === "string" && data.trim()) return data;
  return null;
}

function unwrapGenerated<T>(
  response: GeneratedResponse<T>,
  fallback: string,
  okStatuses: readonly number[] = [200],
): T {
  if (!okStatuses.includes(response.status)) {
    throw new Error(problemMessage(response.data) ?? fallback);
  }

  return response.data;
}

export function fetchV2Entities(
  params?: { kind?: string; query?: string; cursor?: string; hideNsfw?: boolean; limit?: number },
  options?: V2RequestOptions,
): Promise<V2EntityListResponse> {
  // Cast: hideNsfw is accepted by the backend but not yet in the generated OpenAPI type.
  return listEntities(params as Record<string, string | boolean | undefined>, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) {
      throw new Error(response.data.message);
    }

    return response.data;
  });
}

export async function fetchV2EntityThumbnails(
  ids: string[],
  options?: V2RequestOptions,
): Promise<EntityThumbnail[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const response = await getEntityThumbnails({ ids: uniqueIds }, { signal: options?.signal });
  return (response.data as EntityThumbnailBatchResponse).items;
}

export function fetchV2Videos(
  options?: V2RequestOptions,
): Promise<V2VideoListResponse> {
  return listVideos(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Video(
  id: string,
  options?: V2RequestOptions,
): Promise<V2VideoDetail> {
  return getVideo(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) {
      throw new Error(response.data.message);
    }

    return response.data;
  });
}

export async function fetchJellyfinPlaybackInfo(
  itemId: string,
  request: JellyfinPlaybackInfoRequest = {},
  options?: V2RequestOptions,
): Promise<JellyfinPlaybackInfoResponse> {
  const response = await fetch(jellyfinApiPath(`/Items/${itemId}/PlaybackInfo`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: options?.signal,
  });
  if (!response.ok) {
    throw new Error(await response.text() || `PlaybackInfo ${response.status}`);
  }
  return await response.json() as JellyfinPlaybackInfoResponse;
}

export async function postJellyfinSessionProgress(
  path: "Playing" | "Playing/Progress" | "Playing/Ping" | "Playing/Stopped",
  request: JellyfinPlaybackSessionRequest,
  options?: V2RequestOptions,
): Promise<void> {
  const payload = request as PlaybackSessionRequest;
  switch (path) {
    case "Playing":
      await postJellyfinSessionPlaying(payload, { signal: options?.signal });
      return;
    case "Playing/Progress":
      await postJellyfinSessionProgressRequest(payload, { signal: options?.signal });
      return;
    case "Playing/Ping":
      await postJellyfinSessionPing(payload, { signal: options?.signal });
      return;
    case "Playing/Stopped":
      await postJellyfinSessionStopped(payload, { signal: options?.signal });
  }
}

export async function markJellyfinUserPlayedItem(
  itemId: string,
  played: boolean,
  options?: V2RequestOptions,
): Promise<void> {
  if (played) {
    await postJellyfinUserPlayedItem(itemId, { signal: options?.signal });
  } else {
    await deleteJellyfinUserPlayedItem(itemId, { signal: options?.signal });
  }
}

export function fetchV2SeriesList(
  options?: V2RequestOptions,
): Promise<V2VideoSeriesListResponse> {
  return listVideoSeries(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Series(
  id: string,
  options?: V2RequestOptions,
): Promise<V2VideoSeriesDetail> {
  return getVideoSeries(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) {
      throw new Error(response.data.message);
    }

    return response.data;
  });
}

export function fetchV2Season(
  seriesId: string,
  seasonId: string,
  options?: V2RequestOptions,
): Promise<V2VideoSeasonDetail> {
  return getVideoSeason(seriesId, seasonId, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) {
      throw new Error(response.data.message);
    }

    return response.data;
  });
}

export function fetchV2Images(options?: V2RequestOptions): Promise<V2MediaListResponse> {
  return listImages(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Galleries(options?: V2RequestOptions): Promise<V2MediaListResponse> {
  return listGalleries(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Books(options?: V2RequestOptions): Promise<V2MediaListResponse> {
  return listBooks(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2AudioLibraries(options?: V2RequestOptions): Promise<V2MediaListResponse> {
  return listAudioLibraries(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2AudioTracks(options?: V2RequestOptions): Promise<V2MediaListResponse> {
  return listAudioTracks(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Image(id: string, options?: V2RequestOptions): Promise<V2ImageDetail> {
  return getImage(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) throw new Error(response.data.message);
    return response.data;
  });
}

export function fetchV2Gallery(id: string, options?: V2RequestOptions): Promise<V2GalleryDetail> {
  return getGallery(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) throw new Error(response.data.message);
    return response.data;
  });
}

export function fetchV2Book(id: string, options?: V2RequestOptions): Promise<V2BookDetail> {
  return getBook(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) throw new Error(response.data.message);
    return response.data;
  });
}

export function fetchV2AudioLibrary(id: string, options?: V2RequestOptions): Promise<V2AudioLibraryDetail> {
  return getAudioLibrary(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) throw new Error(response.data.message);
    return response.data;
  });
}

export function fetchV2AudioTrack(id: string, options?: V2RequestOptions): Promise<V2AudioTrackDetail> {
  return getAudioTrack(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) throw new Error(response.data.message);
    return response.data;
  });
}

export function fetchV2Person(id: string, options?: V2RequestOptions): Promise<V2PersonDetail> {
  return getPerson(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) throw new Error(response.data.message);
    return response.data;
  });
}

export function fetchV2Studio(id: string, options?: V2RequestOptions): Promise<V2StudioDetail> {
  return getStudio(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) throw new Error(response.data.message);
    return response.data;
  });
}

export function fetchV2Tag(id: string, options?: V2RequestOptions): Promise<V2TagDetail> {
  return getTag(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) throw new Error(response.data.message);
    return response.data;
  });
}

export function fetchV2People(options?: V2RequestOptions): Promise<V2TaxonomyListResponse> {
  return listPeople(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Studios(options?: V2RequestOptions): Promise<V2TaxonomyListResponse> {
  return listStudios(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Tags(options?: V2RequestOptions): Promise<V2TaxonomyListResponse> {
  return listTags(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Collection(id: string, options?: V2RequestOptions): Promise<V2CollectionDetail> {
  return getCollection(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) throw new Error(response.data.message);
    return response.data;
  });
}

export function fetchV2Collections(options?: V2RequestOptions): Promise<V2CollectionListResponse> {
  return listCollections(undefined, { signal: options?.signal }).then((response) => response.data);
}

export function updateV2EntityRating(
  id: string,
  value: number | null,
): Promise<unknown> {
  return updateEntityRating(id, { value });
}

export function updateV2EntityFlags(
  id: string,
  flags: { isFavorite?: boolean | null; isNsfw?: boolean | null; isOrganized?: boolean | null },
): Promise<unknown> {
  return updateEntityFlags(id, {
    isFavorite: flags.isFavorite ?? null,
    isNsfw: flags.isNsfw ?? null,
    isOrganized: flags.isOrganized ?? null,
  });
}

export function updateV2EntityMetadata(
  id: string,
  request: V2EntityMetadataUpdateRequest,
  options?: V2EntityMetadataUpdateOptions,
): Promise<V2EntityDetailCard> {
  const kindPath = options?.kind ? `/${encodeURIComponent(options.kind)}` : "";
  return fetchV2Api<V2EntityDetailCard>(`/entities${kindPath}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(request),
    signal: options?.signal,
  });
}

export async function updateV2EntityPlayback(
  id: string,
  payload: { resumeSeconds?: number | null; durationSeconds?: number | null; completed?: boolean | null },
  options?: V2RequestOptions,
): Promise<V2EntityCard> {
  const response = await updateEntityPlaybackRequest(
    id,
    payload as PlaybackUpdateRequest,
    { signal: options?.signal },
  );
  return unwrapGenerated(
    response as unknown as GeneratedResponse<EntityCard>,
    `Failed to update playback for ${id}`,
  ) as unknown as V2EntityCard;
}

export interface V2EntityMarkerWriteRequest {
  title: string;
  seconds: number;
  endSeconds?: number | null;
}

async function writeV2EntityMarker(
  id: string,
  method: "POST" | "PATCH" | "DELETE",
  markerId: string | null,
  payload?: V2EntityMarkerWriteRequest,
  options?: V2RequestOptions,
): Promise<V2EntityCard> {
  const requestOptions = { signal: options?.signal };
  const fallback = `Failed to ${method.toLowerCase()} marker for ${id}`;
  const markerPayload = payload
    ? {
        ...payload,
        endSeconds: payload.endSeconds ?? null,
      }
    : undefined;
  if (method === "POST" && payload) {
    return unwrapGenerated(
      await createEntityMarkerRequest(id, markerPayload!, requestOptions) as unknown as GeneratedResponse<EntityCard>,
      fallback,
    ) as unknown as V2EntityCard;
  }
  if (method === "PATCH" && markerId && payload) {
    return unwrapGenerated(
      await updateEntityMarkerRequest(id, markerId, markerPayload!, requestOptions) as unknown as GeneratedResponse<EntityCard>,
      fallback,
    ) as unknown as V2EntityCard;
  }
  if (method === "DELETE" && markerId) {
    return unwrapGenerated(
      await deleteEntityMarkerRequest(id, markerId, requestOptions) as unknown as GeneratedResponse<EntityCard>,
      fallback,
    ) as unknown as V2EntityCard;
  }

  throw new Error(fallback);
}

export function createV2EntityMarker(
  id: string,
  payload: V2EntityMarkerWriteRequest,
  options?: V2RequestOptions,
): Promise<V2EntityCard> {
  return writeV2EntityMarker(id, "POST", null, payload, options);
}

export function updateV2EntityMarker(
  id: string,
  markerId: string,
  payload: V2EntityMarkerWriteRequest,
  options?: V2RequestOptions,
): Promise<V2EntityCard> {
  return writeV2EntityMarker(id, "PATCH", markerId, payload, options);
}

export function deleteV2EntityMarker(
  id: string,
  markerId: string,
  options?: V2RequestOptions,
): Promise<V2EntityCard> {
  return writeV2EntityMarker(id, "DELETE", markerId, undefined, options);
}

export function fetchV2Jobs(options?: V2RequestOptions): Promise<V2JobListResponse> {
  return listJobs({ signal: options?.signal }).then((response) => response.data);
}

export async function createV2Job(
  type: string,
  options?: V2RequestOptions,
): Promise<V2JobCreateResponse> {
  const response = await createJob(type, { signal: options?.signal });
  return unwrapGenerated(
    response as unknown as GeneratedResponse<V2JobCreateResponse>,
    `Failed to queue ${type}`,
    [200, 202],
  );
}

export async function cancelV2Jobs(
  type?: string | null,
  options?: V2RequestOptions,
): Promise<V2JobCancelResponse> {
  const response = await cancelJobs(type ? { type } : undefined, { signal: options?.signal });
  return unwrapGenerated(
    response as unknown as GeneratedResponse<V2JobCancelResponse>,
    "Failed to cancel v2 jobs",
  );
}

export async function cancelV2JobRun(
  id: string,
  options?: V2RequestOptions,
): Promise<V2JobCancelResponse> {
  const response = await cancelJobRun(id, { signal: options?.signal });
  return unwrapGenerated(
    response as unknown as GeneratedResponse<V2JobCancelResponse>,
    "Failed to cancel v2 job",
  );
}

export async function clearV2JobFailures(
  type?: string | null,
  options?: V2RequestOptions,
): Promise<V2JobFailureClearResponse> {
  const response = await clearJobFailures(type ? { type } : undefined, { signal: options?.signal });
  return unwrapGenerated(
    response as unknown as GeneratedResponse<V2JobFailureClearResponse>,
    "Failed to clear v2 job failures",
  );
}

export function fetchV2Settings(options?: V2RequestOptions): Promise<V2SettingsResponse> {
  return getSettings({ signal: options?.signal }).then((response) => response.data);
}

export async function fetchV2LibraryConfig(
  options?: V2RequestOptions,
): Promise<V2LibraryConfigResponse> {
  return unwrapGenerated(
    await getLibraryConfig({ signal: options?.signal }),
    "Failed to load v2 settings",
  ) as unknown as V2LibraryConfigResponse;
}

export async function updateV2LibrarySettings(
  payload: Partial<V2LibrarySettings>,
  options?: V2RequestOptions,
): Promise<V2LibrarySettings> {
  return unwrapGenerated(
    await updateLibrarySettings(
      payload as unknown as Parameters<typeof updateLibrarySettings>[0],
      { signal: options?.signal },
    ),
    "Failed to save v2 settings",
  ) as unknown as V2LibrarySettings;
}

export async function browseV2LibraryPath(
  targetPath?: string,
  options?: V2RequestOptions,
): Promise<V2LibraryBrowse> {
  return unwrapGenerated(
    await browseLibraryPath(targetPath ? { path: targetPath } : undefined, { signal: options?.signal }),
    "Failed to browse folders",
  );
}

export async function createV2LibraryRoot(
  payload: Partial<V2LibraryRoot> & { path: string },
  options?: V2RequestOptions,
): Promise<V2LibraryRoot> {
  return unwrapGenerated(
    await createLibraryRootRequest(payload as unknown as Parameters<typeof createLibraryRootRequest>[0], { signal: options?.signal }),
    "Failed to add library root",
  );
}

export async function updateV2LibraryRoot(
  id: string,
  payload: Partial<V2LibraryRoot>,
  options?: V2RequestOptions,
): Promise<V2LibraryRoot> {
  const response = await updateLibraryRootRequest(
    id,
    payload as unknown as Parameters<typeof updateLibraryRootRequest>[1],
    { signal: options?.signal },
  );
  return unwrapGenerated(
    response as unknown as GeneratedResponse<V2LibraryRoot>,
    "Failed to update library root",
  );
}

export async function deleteV2LibraryRoot(
  id: string,
  options?: V2RequestOptions,
): Promise<{ ok: true }> {
  const response = await deleteLibraryRootRequest(id, { signal: options?.signal });
  return unwrapGenerated(
    response as unknown as GeneratedResponse<{ ok: true }>,
    "Failed to remove library root",
  );
}

export async function fetchV2FileRoots(
  options?: V2RequestOptions,
): Promise<FileRootsResponse> {
  return unwrapGenerated(
    await listFileRoots({ signal: options?.signal }),
    "Failed to load file roots",
  );
}

export async function fetchV2FileChildren(
  rootId: string,
  path = "",
  options?: V2RequestOptions,
): Promise<FileChildrenResponse> {
  return unwrapGenerated(
    await listFileChildren({ rootId, ...(path ? { path } : {}) }, { signal: options?.signal }),
    "Failed to load folder",
  );
}

export async function fetchV2FileDetail(
  rootId: string,
  path = "",
  options?: V2RequestOptions,
): Promise<FileDetail> {
  return unwrapGenerated(
    await getFileDetail({ rootId, ...(path ? { path } : {}) }, { signal: options?.signal }),
    "Failed to load file details",
  );
}

export function v2FileContentUrl(rootId: string, path = ""): string {
  return v2ApiPath(getGetFileContentUrl({ rootId, path }));
}

export async function createV2FileFolder(
  payload: FileCreateFolderRequest,
  options?: V2RequestOptions,
): Promise<FileOperationResponse> {
  return unwrapGenerated(
    await createFileFolder(payload, { signal: options?.signal }),
    "Failed to create folder",
  );
}

export async function uploadV2Files(
  rootId: string,
  targetPath: string,
  items: V2FileUploadItem[],
  options?: V2RequestOptions,
): Promise<FileOperationResponse> {
  const form = new FormData();
  form.append("rootId", rootId);
  form.append("targetPath", targetPath);
  for (const item of items) {
    form.append("relativePaths", item.relativePath);
    form.append("files", item.file);
  }

  return unwrapGenerated(
    await uploadFiles({ body: form, signal: options?.signal }),
    "Failed to upload files",
  );
}

export async function renameV2File(
  payload: FileRenameRequest,
  options?: V2RequestOptions,
): Promise<FileOperationResponse> {
  return unwrapGenerated(
    await renameFile(payload, { signal: options?.signal }),
    "Failed to rename file",
  );
}

export async function moveV2File(
  payload: FileMoveRequest,
  options?: V2RequestOptions,
): Promise<FileOperationResponse> {
  return unwrapGenerated(
    await moveFile(payload, { signal: options?.signal }),
    "Failed to move file",
  );
}

export async function deleteV2File(
  rootId: string,
  path: string,
  options?: V2RequestOptions,
): Promise<FileOperationResponse> {
  return unwrapGenerated(
    await deleteFile({ rootId, path }, { signal: options?.signal }),
    "Failed to delete file",
  );
}

export async function rescanV2FileRoot(
  payload: FileRescanRequest,
  options?: V2RequestOptions,
): Promise<FileOperationResponse> {
  return unwrapGenerated(
    await rescanFileRoot(payload, { signal: options?.signal }),
    "Failed to queue file rescan",
  );
}

export async function rebuildV2Previews(
  options?: V2RequestOptions,
): Promise<V2BulkJobResponse> {
  const response = await rebuildPreviews({ signal: options?.signal });
  return unwrapGenerated(
    response as unknown as GeneratedResponse<V2BulkJobResponse>,
    "Failed to queue preview rebuild",
  );
}

export async function backfillV2Fingerprints(
  options?: V2RequestOptions,
): Promise<V2BulkJobResponse> {
  const response = await backfillFingerprints({ signal: options?.signal });
  return unwrapGenerated(
    response as unknown as GeneratedResponse<V2BulkJobResponse>,
    "Failed to queue fingerprint backfill",
  );
}
