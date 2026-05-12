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
  EntityCapabilities,
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

export type V2EntityReference = EntityReference;
export type V2Rating = Rating;
export type V2EntityCapabilities = EntityCapabilities;
export type V2EntityCard = EntityCard;
export type V2EntityListResponse = EntityListResponse;
export type V2VideoListResponse = VideoListResponse;
export type V2VideoDetail = VideoDetail;
export type V2VideoSeriesListResponse = VideoSeriesListResponse;
export type V2VideoSeriesDetail = VideoSeriesDetail;
export type V2JobRun = JobRun;
export type V2JobListResponse = JobListResponse;
export type V2SettingsResponse = SettingsResponse;
export type V2LegacyVideoImportResponse = LegacyVideoImportResponse;
export type V2LegacyMediaImportResponse = LegacyMediaImportResponse;
export type V2MediaListResponse = MediaListResponse;

export interface V2RequestOptions {
  signal?: AbortSignal;
}

export function fetchV2Entities(
  params?: { kind?: string; query?: string; cursor?: string },
  options?: V2RequestOptions,
): Promise<V2EntityListResponse> {
  return listEntities(params, { signal: options?.signal }).then((response) => response.data);
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

export function fetchV2Settings(options?: V2RequestOptions): Promise<V2SettingsResponse> {
  return getSettings({ signal: options?.signal }).then((response) => response.data);
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
