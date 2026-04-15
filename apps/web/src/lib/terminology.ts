/**
 * User-facing names for library entities. URLs and API types still use
 * scene/performer; this module is the single source for UI copy.
 */
export const entityTerms = {
  scenes: "Videos",
  scene: "Video",
  /** Containers of videos. In the new model, these are series rows. */
  sceneFolders: "Series",
  sceneFolder: "Series",
  /** Videos that live outside a series (the video_movies rows). */
  uncategorizedScenes: "Movies",
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
      ? entityTerms.scene.toLowerCase()
      : entityTerms.scenes.toLowerCase();
  return `${count} ${w}`;
}

/** Stable hook for client components; values are constant. */
export function useTerms(): EntityTerms {
  return entityTerms;
}
