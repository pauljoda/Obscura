import { buildQueryString } from "../query-string";

export interface FetchVideosParams {
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
  videoSeriesId?: string;
  seriesScope?: "direct" | "subtree";
  uncategorized?: boolean;
  seasonNumber?: string;
}

export function buildFetchVideosQuery(params: FetchVideosParams): string {
  return buildQueryString(
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
      videoSeriesId: params.videoSeriesId,
      seriesScope: params.seriesScope,
      uncategorized: params.uncategorized ? "true" : undefined,
      seasonNumber: params.seasonNumber,
    },
    {
      tag: params.tag,
      performer: params.performer,
      resolution: params.resolution,
      studio: params.studio,
      codec: params.codec,
    },
  );
}
