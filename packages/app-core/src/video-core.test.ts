import { describe, expect, it } from "vitest";
import { sortMergedVideos } from "./video-core";

describe("sortMergedVideos", () => {
  const rows = [
    {
      id: "episode-1",
      title: "Gamma Episode",
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      rating: 20,
      duration: 120,
      fileSize: 1200,
      playCount: 1,
      date: "2026-04-03",
      seasonNumber: 1,
      episodeNumber: 3,
      absoluteEpisodeNumber: 3,
      kind: "episode",
    },
    {
      id: "movie-1",
      title: "Alpha Movie",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      rating: 80,
      duration: 80,
      fileSize: 800,
      playCount: 5,
      date: "2026-04-01",
      seasonNumber: null,
      episodeNumber: null,
      absoluteEpisodeNumber: null,
      kind: "movie",
    },
    {
      id: "episode-2",
      title: "Beta Episode",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      rating: 60,
      duration: 100,
      fileSize: 1000,
      playCount: 2,
      date: "2026-04-02",
      seasonNumber: 1,
      episodeNumber: 2,
      absoluteEpisodeNumber: 2,
      kind: "episode",
    },
  ];

  it("respects requested title sorting across mixed episodes and movies", () => {
    const sorted = sortMergedVideos(rows, { sort: "title", order: "asc" });

    expect(sorted.map((row) => row.title)).toEqual([
      "Alpha Movie",
      "Beta Episode",
      "Gamma Episode",
    ]);
  });

  it("uses episode order when requested", () => {
    const sorted = sortMergedVideos(rows, { sort: "episode", order: "asc" });

    expect(sorted.map((row) => row.id)).toEqual([
      "movie-1",
      "episode-2",
      "episode-1",
    ]);
  });
});
