import {
  listEntities,
  listJobs,
  listSeries,
  listVideos,
  updateEntityFlags,
  updateEntityRating,
  getSettings,
  getSeries,
  getVideo,
  getImage,
  getGallerie,
  getBook,
  getAudioLibrarie,
  getAudioTrack,
  getPeople,
  getStudio,
  getTag,
  getCollection,
  listPeople,
  listStudios,
  listTags,
  listCollections,
  importLegacyMedia,
  importLegacyVideos,
  listAudioLibraries,
  listAudioTracks,
  listBooks,
  listGalleries,
  listImages,
} from "./generated/obscura-v2";
import type {
  AudioLibraryDetail,
  AudioTrackDetail,
  BookDetail,
  CollectionDetail,
  CollectionListResponse,
  EntityCapability,
  EntityCard,
  EntityListResponse,
  EntityReference,
  GalleryDetail,
  ImageDetail,
  JobListResponse,
  JobRun,
  LegacyMediaImportResponse,
  LegacyVideoImportResponse,
  MediaListResponse,
  PersonDetail,
  Rating,
  SettingsResponse,
  StudioDetail,
  TagDetail,
  TaxonomyListResponse,
  VideoDetail,
  VideoListResponse,
  VideoSeriesDetail,
  VideoSeriesListResponse,
} from "./generated/model";
import { jellyfinApiPath, v2ApiPath } from "./orval-fetch";
import type {
  LibraryBrowseDto,
  LibraryRootDto,
  LibrarySettingsDto,
} from "@obscura/contracts";

export type V2EntityReference = EntityReference;
export type V2Rating = Rating;
export type V2EntityCapability = EntityCapability;
export type V2EntityCard = EntityCard;
export type V2EntityListResponse = EntityListResponse;
export type V2VideoListResponse = VideoListResponse;
export type V2VideoDetail = VideoDetail;
export type V2VideoSeriesListResponse = VideoSeriesListResponse;
export type V2VideoSeriesDetail = VideoSeriesDetail;
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
export type V2CollectionListResponse = CollectionListResponse;
export type V2TaxonomyListResponse = TaxonomyListResponse;
export type V2SettingsResponse = SettingsResponse;
export type V2LegacyVideoImportResponse = LegacyVideoImportResponse;
export type V2LegacyMediaImportResponse = LegacyMediaImportResponse;
export type V2MediaListResponse = MediaListResponse;
export type V2LibrarySettings = LibrarySettingsDto & {
  audioPreferredLanguages: string;
};
export type V2LibraryRoot = LibraryRootDto;
export type V2LibraryBrowse = LibraryBrowseDto;
export interface V2LibraryConfigResponse {
  settings: V2LibrarySettings;
  roots: V2LibraryRoot[];
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

export function fetchV2Entities(
  params?: { kind?: string; query?: string; cursor?: string; hideNsfw?: boolean },
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

export function fetchV2Videos(
  options?: V2RequestOptions,
): Promise<V2VideoListResponse> {
  return listVideos({ signal: options?.signal }).then((response) => response.data);
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
  const response = await fetch(jellyfinApiPath(`/Sessions/${path}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: options?.signal,
  });
  if (!response.ok) {
    throw new Error(await response.text() || `Session ${response.status}`);
  }
}

export async function markJellyfinUserPlayedItem(
  itemId: string,
  played: boolean,
  options?: V2RequestOptions,
): Promise<void> {
  const response = await fetch(jellyfinApiPath(`/UserPlayedItems/${itemId}`), {
    method: played ? "POST" : "DELETE",
    signal: options?.signal,
  });
  if (!response.ok) {
    throw new Error(await response.text() || `UserPlayedItems ${response.status}`);
  }
}

export function fetchV2SeriesList(
  options?: V2RequestOptions,
): Promise<V2VideoSeriesListResponse> {
  return listSeries({ signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Series(
  id: string,
  options?: V2RequestOptions,
): Promise<V2VideoSeriesDetail> {
  return getSeries(id, { signal: options?.signal }).then((response) => {
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
  return getGallerie(id, { signal: options?.signal }).then((response) => {
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
  return getAudioLibrarie(id, { signal: options?.signal }).then((response) => {
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
  return getPeople(id, { signal: options?.signal }).then((response) => {
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

export async function updateV2EntityPlayback(
  id: string,
  payload: { resumeSeconds?: number | null; durationSeconds?: number | null; completed?: boolean | null },
  options?: V2RequestOptions,
): Promise<V2EntityCard> {
  const response = await fetch(v2ApiPath(`/entities/${id}/playback`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to update playback for ${id}`);
  }

  return (await response.json()) as V2EntityCard;
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
  const markerPath = markerId ? `/${encodeURIComponent(markerId)}` : "";
  const response = await fetch(v2ApiPath(`/entities/${encodeURIComponent(id)}/markers${markerPath}`), {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    signal: options?.signal,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to ${method.toLowerCase()} marker for ${id}`);
  }

  return (await response.json()) as V2EntityCard;
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
  const response = await fetch(v2ApiPath(`/jobs/${type}`), {
    method: "POST",
    signal: options?.signal,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to queue ${type}`);
  }

  return (await response.json()) as V2JobCreateResponse;
}

async function readV2Json<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || fallback);
  }

  return (await response.json()) as T;
}

export async function cancelV2Jobs(
  type?: string | null,
  options?: V2RequestOptions,
): Promise<V2JobCancelResponse> {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  const response = await fetch(v2ApiPath(`/jobs${query}`), {
    method: "DELETE",
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to cancel v2 jobs");
}

export async function cancelV2JobRun(
  id: string,
  options?: V2RequestOptions,
): Promise<V2JobCancelResponse> {
  const response = await fetch(v2ApiPath(`/jobs/${id}`), {
    method: "DELETE",
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to cancel v2 job");
}

export async function clearV2JobFailures(
  type?: string | null,
  options?: V2RequestOptions,
): Promise<V2JobFailureClearResponse> {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  const response = await fetch(v2ApiPath(`/jobs/failures/clear${query}`), {
    method: "POST",
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to clear v2 job failures");
}

export function fetchV2Settings(options?: V2RequestOptions): Promise<V2SettingsResponse> {
  return getSettings({ signal: options?.signal }).then((response) => response.data);
}

export async function fetchV2LibraryConfig(
  options?: V2RequestOptions,
): Promise<V2LibraryConfigResponse> {
  const response = await fetch(v2ApiPath("/settings/library"), {
    method: "GET",
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to load v2 settings");
}

export async function updateV2LibrarySettings(
  payload: Partial<V2LibrarySettings>,
  options?: V2RequestOptions,
): Promise<V2LibrarySettings> {
  const response = await fetch(v2ApiPath("/settings/library"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to save v2 settings");
}

export async function browseV2LibraryPath(
  targetPath?: string,
  options?: V2RequestOptions,
): Promise<V2LibraryBrowse> {
  const query = targetPath ? `?path=${encodeURIComponent(targetPath)}` : "";
  const response = await fetch(v2ApiPath(`/libraries/browse${query}`), {
    method: "GET",
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to browse folders");
}

export async function createV2LibraryRoot(
  payload: Partial<V2LibraryRoot> & { path: string },
  options?: V2RequestOptions,
): Promise<V2LibraryRoot> {
  const response = await fetch(v2ApiPath("/libraries"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to add library root");
}

export async function updateV2LibraryRoot(
  id: string,
  payload: Partial<V2LibraryRoot>,
  options?: V2RequestOptions,
): Promise<V2LibraryRoot> {
  const response = await fetch(v2ApiPath(`/libraries/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to update library root");
}

export async function deleteV2LibraryRoot(
  id: string,
  options?: V2RequestOptions,
): Promise<{ ok: true }> {
  const response = await fetch(v2ApiPath(`/libraries/${id}`), {
    method: "DELETE",
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to remove library root");
}

export async function rebuildV2Previews(
  options?: V2RequestOptions,
): Promise<V2BulkJobResponse> {
  const response = await fetch(v2ApiPath("/jobs/rebuild-previews"), {
    method: "POST",
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to queue preview rebuild");
}

export async function backfillV2Fingerprints(
  options?: V2RequestOptions,
): Promise<V2BulkJobResponse> {
  const response = await fetch(v2ApiPath("/jobs/backfill-fingerprints"), {
    method: "POST",
    signal: options?.signal,
  });

  return readV2Json(response, "Failed to queue fingerprint backfill");
}

export function importV2LegacyVideos(
  options?: V2RequestOptions,
): Promise<V2LegacyVideoImportResponse> {
  return importLegacyVideos({ signal: options?.signal }).then((response) => response.data);
}

export function importV2LegacyMedia(
  options?: V2RequestOptions,
): Promise<V2LegacyMediaImportResponse> {
  return importLegacyMedia({ signal: options?.signal }).then((response) => response.data);
}
