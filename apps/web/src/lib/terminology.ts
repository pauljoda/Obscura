/**
 * User-facing names for library entities. Single source of truth for
 * UI copy so the same labels can be shifted centrally if we ever
 * rename again.
 */
export const entityTerms = {
  videos: "Videos",
  video: "Video",
  /** Grouped videos with seasons + episodes (video_series rows). */
  series: "Series",
  seriesSingular: "Series",
  /** Sub-grouping of episodes under a series (video_seasons rows). */
  seasons: "Seasons",
  season: "Season",
  /** Videos that live outside a series (the video_movies rows). */
  movies: "Movies",
  movie: "Movie",
  performers: "Actors",
  performer: "Actor",
  studios: "Studios",
  studio: "Studio",
  tags: "Tags",
  tag: "Tag",
} as const;

export type EntityTerms = typeof entityTerms;

/** e.g. "1 video" / "3 videos" for cards and stats. */
export function formatVideoCount(count: number): string {
  const w =
    count === 1
      ? entityTerms.video.toLowerCase()
      : entityTerms.videos.toLowerCase();
  return `${count} ${w}`;
}

/** Stable hook for client components; values are constant. */
export function useTerms(): EntityTerms {
  return entityTerms;
}
