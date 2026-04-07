"use client";

import { useNsfw } from "../components/nsfw/nsfw-context";

/**
 * Returns localized entity terms based on the current NSFW mode.
 * In SFW mode (off): adult-oriented terms are replaced with neutral equivalents.
 * In NSFW mode (blur/show): original terms are used.
 */
export function useTerms() {
  const { mode } = useNsfw();
  const sfw = mode === "off";

  return {
    scenes: sfw ? "Videos" : "Scenes",
    scene: sfw ? "Video" : "Scene",
    performers: sfw ? "Actors" : "Performers",
    performer: sfw ? "Actor" : "Performer",
    // Studios and Tags keep their names in both modes
    studios: "Studios",
    studio: "Studio",
    tags: "Tags",
    tag: "Tag",
  };
}
