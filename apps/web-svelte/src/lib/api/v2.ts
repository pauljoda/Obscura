import {
  listEntities,
  listJobs,
  listVideos,
  updateEntityFlags,
  updateEntityRating,
  getSettings,
  getVideo,
} from "./generated/obscura-v2";
import type {
  EntityCapabilitiesDto,
  EntityCardDto,
  EntityListResponseDto,
  EntityReferenceDto,
  JobListResponseDto,
  JobRunDto,
  RatingDto,
  SettingsDto,
  VideoDetailDto,
  VideoListResponseDto,
} from "./generated/model";

export type V2EntityReferenceDto = EntityReferenceDto;
export type V2RatingDto = RatingDto;
export type V2EntityCapabilitiesDto = EntityCapabilitiesDto;
export type V2EntityCardDto = EntityCardDto;
export type V2EntityListResponseDto = EntityListResponseDto;
export type V2VideoListResponseDto = VideoListResponseDto;
export type V2VideoDetailDto = VideoDetailDto;
export type V2JobRunDto = JobRunDto;
export type V2JobListResponseDto = JobListResponseDto;
export type V2SettingsDto = SettingsDto;

export interface V2RequestOptions {
  signal?: AbortSignal;
}

export function fetchV2Entities(
  params?: { kind?: string; query?: string; cursor?: string },
  options?: V2RequestOptions,
): Promise<V2EntityListResponseDto> {
  return listEntities(params, { signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Videos(
  options?: V2RequestOptions,
): Promise<V2VideoListResponseDto> {
  return listVideos({ signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Video(
  id: string,
  options?: V2RequestOptions,
): Promise<V2VideoDetailDto> {
  return getVideo(id, { signal: options?.signal }).then((response) => {
    if (response.status !== 200) {
      throw new Error(response.data.message);
    }

    return response.data;
  });
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

export function fetchV2Jobs(options?: V2RequestOptions): Promise<V2JobListResponseDto> {
  return listJobs({ signal: options?.signal }).then((response) => response.data);
}

export function fetchV2Settings(options?: V2RequestOptions): Promise<V2SettingsDto> {
  return getSettings({ signal: options?.signal }).then((response) => response.data);
}
