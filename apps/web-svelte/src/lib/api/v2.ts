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
  importLegacyMedia,
  importLegacyVideos,
  listAudioLibraries,
  listAudioTracks,
  listBooks,
  listGalleries,
  listImages,
} from "./generated/obscura-v2";
import type {
  EntityCapability,
  EntityCard,
  EntityListResponse,
  EntityReference,
  JobListResponse,
  JobRun,
  LegacyMediaImportResponse,
  LegacyVideoImportResponse,
  MediaListResponse,
  Rating,
  SettingsResponse,
  VideoDetail,
  VideoListResponse,
  VideoSeriesDetail,
  VideoSeriesListResponse,
} from "./generated/model";
import { v2ApiPath } from "./orval-fetch";
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
export type V2SettingsResponse = SettingsResponse;
export type V2LegacyVideoImportResponse = LegacyVideoImportResponse;
export type V2LegacyMediaImportResponse = LegacyMediaImportResponse;
export type V2MediaListResponse = MediaListResponse;
export type V2LibrarySettings = LibrarySettingsDto;
export type V2LibraryRoot = LibraryRootDto;
export type V2LibraryBrowse = LibraryBrowseDto;
export interface V2LibraryConfigResponse {
  settings: V2LibrarySettings;
  roots: V2LibraryRoot[];
}

export interface V2RequestOptions {
  signal?: AbortSignal;
}

export function fetchV2Entities(
  params?: { kind?: string; query?: string; cursor?: string },
  options?: V2RequestOptions,
): Promise<V2EntityListResponse> {
  return listEntities(params, { signal: options?.signal }).then((response) => {
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
