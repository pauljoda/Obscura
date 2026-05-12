import { buildQueryString, fetchApi } from "./core";

export interface V2EntityReferenceDto {
  id: string;
  kind: string;
  title: string;
}

export interface V2RatingDto {
  value: number | null;
}

export interface V2EntityCapabilitiesDto {
  rating: V2RatingDto | null;
  tags: string[];
  credits: V2EntityReferenceDto[];
  studio: V2EntityReferenceDto | null;
  thumbnailUrl: string | null;
  coverUrl: string | null;
  isFavorite: boolean | null;
  isNsfw: boolean | null;
  isOrganized: boolean | null;
}

export interface V2EntityCardDto {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  capabilities: V2EntityCapabilitiesDto;
}

export interface V2EntityListResponseDto {
  items: V2EntityCardDto[];
  nextCursor: string | null;
}

export interface V2VideoListResponseDto {
  items: V2EntityCardDto[];
  nextCursor: string | null;
}

export interface V2JobRunDto {
  id: string;
  type: string;
  status: string;
  progress: number;
  message: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface V2JobListResponseDto {
  items: V2JobRunDto[];
}

export interface V2SettingsDto {
  hideNsfw: boolean;
  enableCastControls: boolean;
}

export interface V2RequestOptions {
  signal?: AbortSignal;
}

export function fetchV2Entities(
  params?: { kind?: string; query?: string; cursor?: string },
  options?: V2RequestOptions,
): Promise<V2EntityListResponseDto> {
  const qs = buildQueryString({
    kind: params?.kind,
    query: params?.query,
    cursor: params?.cursor,
  });

  return fetchApi(`/entities${qs}`, { signal: options?.signal });
}

export function fetchV2Videos(
  options?: V2RequestOptions,
): Promise<V2VideoListResponseDto> {
  return fetchApi("/videos", { signal: options?.signal });
}

export function updateV2EntityRating(
  id: string,
  value: number | null,
): Promise<unknown> {
  return fetchApi(`/entities/${id}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ value }),
  });
}

export function updateV2EntityFlags(
  id: string,
  flags: { isFavorite?: boolean | null; isNsfw?: boolean | null; isOrganized?: boolean | null },
): Promise<unknown> {
  return fetchApi(`/entities/${id}/flags`, {
    method: "PATCH",
    body: JSON.stringify(flags),
  });
}

export function fetchV2Jobs(options?: V2RequestOptions): Promise<V2JobListResponseDto> {
  return fetchApi("/jobs", { signal: options?.signal });
}

export function fetchV2Settings(options?: V2RequestOptions): Promise<V2SettingsDto> {
  return fetchApi("/settings", { signal: options?.signal });
}
