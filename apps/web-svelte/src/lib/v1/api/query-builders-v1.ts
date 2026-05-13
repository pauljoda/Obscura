import { buildQueryString } from "$lib/query-string";

type SortDir = "asc" | "desc";
type MaybeList = string | string[] | undefined;

export interface GalleryListQueryParams {
  search?: string;
  sort?: string;
  order?: SortDir | string;
  randomSeed?: string;
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
  isNsfw?: string;
  nsfw?: string;
  limit?: number;
  offset?: number;
}

export interface BookListQueryParams {
  search?: string;
  sort?: string;
  order?: SortDir | string;
  randomSeed?: string;
  tag?: string[];
  performer?: string[];
  studio?: string;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  organized?: string;
  isNsfw?: string;
  read?: string;
  nsfw?: string;
  limit?: number;
  offset?: number;
}

export interface ImageListQueryParams {
  search?: string;
  sort?: string;
  order?: SortDir | string;
  randomSeed?: string;
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
  isNsfw?: string;
  limit?: number;
  offset?: number;
}

export interface AudioLibraryListQueryParams {
  search?: string;
  sort?: string;
  order?: SortDir | string;
  randomSeed?: string;
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
  isNsfw?: string;
  nsfw?: string;
  limit?: number;
  offset?: number;
}

export interface VideoSeriesListQueryParams {
  parent?: string;
  root?: string;
  search?: string;
  sort?: string;
  order?: SortDir | string;
  randomSeed?: string;
  limit?: number;
  offset?: number;
  nsfw?: string;
  studio?: MaybeList;
  tag?: MaybeList;
  performer?: MaybeList;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  organized?: string;
}

export interface TagStudioListQueryParams {
  search?: string;
  sort?: string;
  order?: SortDir | string;
  randomSeed?: string;
  favorite?: string;
  hasImage?: string;
  ratingMin?: number;
  limit?: number;
  offset?: number;
  nsfw?: string;
}

function toList(value: MaybeList): string[] | undefined {
  return Array.isArray(value) ? value : value ? [value] : undefined;
}

export function buildGalleryListQuery(params?: GalleryListQueryParams): string {
  return buildQueryString(
    {
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      randomSeed: params?.randomSeed,
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
      isNsfw: params?.isNsfw,
      nsfw: params?.nsfw,
      limit: params?.limit,
      offset: params?.offset,
    },
    {
      tag: params?.tag,
      performer: params?.performer,
    },
  );
}

export function buildBookListQuery(params?: BookListQueryParams): string {
  return buildQueryString(
    {
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      randomSeed: params?.randomSeed,
      studio: params?.studio,
      ratingMin: params?.ratingMin,
      ratingMax: params?.ratingMax,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      organized: params?.organized,
      isNsfw: params?.isNsfw,
      read: params?.read,
      nsfw: params?.nsfw,
      limit: params?.limit,
      offset: params?.offset,
    },
    {
      tag: params?.tag,
      performer: params?.performer,
    },
  );
}

export function buildImageListQuery(params?: ImageListQueryParams): string {
  return buildQueryString(
    {
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      randomSeed: params?.randomSeed,
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
      isNsfw: params?.isNsfw,
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
}

export function buildAudioLibraryListQuery(params?: AudioLibraryListQueryParams): string {
  return buildQueryString(
    {
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      randomSeed: params?.randomSeed,
      studio: params?.studio,
      parent: params?.parent,
      root: params?.root,
      ratingMin: params?.ratingMin,
      ratingMax: params?.ratingMax,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      trackCountMin: params?.trackCountMin,
      organized: params?.organized,
      isNsfw: params?.isNsfw,
      nsfw: params?.nsfw,
      limit: params?.limit,
      offset: params?.offset,
    },
    {
      tag: params?.tag,
      performer: params?.performer,
    },
  );
}

export function buildVideoSeriesListQuery(params?: VideoSeriesListQueryParams): string {
  return buildQueryString(
    {
      parent: params?.parent,
      root: params?.root,
      search: params?.search,
      sort: params?.sort,
      order: params?.order,
      randomSeed: params?.randomSeed,
      limit: params?.limit,
      offset: params?.offset,
      nsfw: params?.nsfw,
      ratingMin: params?.ratingMin,
      ratingMax: params?.ratingMax,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      organized: params?.organized,
    },
    {
      studio: toList(params?.studio),
      tag: toList(params?.tag),
      performer: toList(params?.performer),
    },
  );
}

export function buildTagListQuery(params?: TagStudioListQueryParams): string {
  return buildTagStudioListQuery(params);
}

export function buildStudioListQuery(params?: TagStudioListQueryParams): string {
  return buildTagStudioListQuery(params);
}

function buildTagStudioListQuery(params?: TagStudioListQueryParams): string {
  return buildQueryString({
    search: params?.search,
    sort: params?.sort,
    order: params?.order,
    randomSeed: params?.randomSeed,
    favorite: params?.favorite,
    hasImage: params?.hasImage,
    ratingMin: params?.ratingMin,
    limit: params?.limit,
    offset: params?.offset,
    nsfw: params?.nsfw,
  });
}
