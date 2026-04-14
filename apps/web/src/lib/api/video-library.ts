import { fetchApi } from "./core";

export interface VideoLibraryCounts {
  movies: number;
  series: number;
  episodes: number;
}

export interface VideoMovieRow {
  id: string;
  title: string;
  releaseDate: string | null;
  runtime: number | null;
  rating: number | null;
  posterPath: string | null;
  isNsfw: boolean;
  organized: boolean;
  duration: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface VideoSeriesRow {
  id: string;
  title: string;
  overview: string | null;
  firstAirDate: string | null;
  endAirDate: string | null;
  status: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  isNsfw: boolean;
  organized: boolean;
  createdAt: string;
  seasonCount: number;
  episodeCount: number;
}

export interface VideoSeriesDetail extends VideoSeriesRow {
  rating: number | null;
  seasons: Array<{
    id: string;
    seasonNumber: number;
    title: string | null;
    overview: string | null;
    episodes: Array<{
      id: string;
      seasonNumber: number;
      episodeNumber: number | null;
      title: string | null;
      overview: string | null;
      runtime: number | null;
      duration: number | null;
      isNsfw: boolean;
      organized: boolean;
    }>;
  }>;
}

export async function fetchVideoLibraryCounts(): Promise<VideoLibraryCounts> {
  return fetchApi<VideoLibraryCounts>("/video/library/counts");
}

export async function fetchVideoMovies(
  params: {
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ items: VideoMovieRow[]; total: number }> {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const qs = search.size ? `?${search}` : "";
  return fetchApi<{ items: VideoMovieRow[]; total: number }>(
    `/video/movies${qs}`,
  );
}

export async function fetchVideoSeriesList(
  params: {
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ items: VideoSeriesRow[]; total: number }> {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const qs = search.size ? `?${search}` : "";
  return fetchApi<{ items: VideoSeriesRow[]; total: number }>(
    `/video/series${qs}`,
  );
}

export async function fetchVideoSeriesDetail(
  id: string,
): Promise<VideoSeriesDetail> {
  return fetchApi<VideoSeriesDetail>(`/video/series/${id}`);
}
