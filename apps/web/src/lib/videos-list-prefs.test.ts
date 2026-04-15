import { describe, expect, it } from "vitest";
import {
  defaultVideosListPrefs,
  parseVideosListPrefs,
  videosListPrefsToFetchParams,
  serializeVideosListPrefs,
} from "./videos-list-prefs";

describe("scenes list preferences", () => {
  it("serializes and parses valid prefs", () => {
    const prefs = {
      ...defaultVideosListPrefs(),
      search: "cats",
      activeFilters: [{ label: "Studio", type: "studio", value: "studio-1" }],
      activePresetId: "preset-1",
    };

    const raw = serializeVideosListPrefs(prefs);
    expect(parseVideosListPrefs(raw)).toEqual(prefs);
  });

  it("rejects malformed prefs payloads", () => {
    const raw = encodeURIComponent(
      JSON.stringify({
        viewMode: "grid",
        sortBy: "recent",
        sortDir: "desc",
        search: "x",
        activeFilters: [{ label: "x", type: "studio", value: 123 }],
      }),
    );

    expect(parseVideosListPrefs(raw)).toBeNull();
  });

  it("maps UI filters to API params", () => {
    const params = videosListPrefsToFetchParams(
      {
        viewMode: "grid",
        sortBy: "rating",
        sortDir: "asc",
        search: "  title  ",
        activeFilters: [
          { label: "Studio", type: "studio", value: "studio-1" },
          { label: "Codec", type: "codec", value: "HEVC" },
          { label: "Rating", type: "ratingMin", value: "4" },
          { label: "Duration", type: "duration", value: "300-900" },
        ],
      },
      "show",
    );

    expect(params).toMatchObject({
      search: "title",
      sort: "rating",
      order: "asc",
      studio: ["studio-1"],
      codec: ["hevc"],
      ratingMin: 4,
      durationMin: 300,
      durationMax: 900,
      nsfw: "show",
      limit: 50,
    });
  });
});
