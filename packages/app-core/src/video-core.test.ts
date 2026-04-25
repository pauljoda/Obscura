import { describe, expect, it } from "vitest";
import { paginateMergedVideos, sortMergedVideos } from "./video-core";

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
      kind: "episode" as const,
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
      kind: "movie" as const,
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
      kind: "episode" as const,
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

describe("paginateMergedVideos", () => {
  // Mirror the SQL contract: with mixedFetch the caller has fetched
  // `limit + offset` rows starting at offset 0; without mixedFetch the
  // caller has already applied limit/offset in SQL.
  const overFetched = Array.from({ length: 120 }, (_, index) => ({
    id: `row-${index}`,
  }));
  const singlePage = Array.from({ length: 60 }, (_, index) => ({
    id: `page-${index}`,
  }));

  it("slices at the requested offset when both kinds were over-fetched", () => {
    const page = paginateMergedVideos(overFetched, {
      mixedFetch: true,
      limit: 60,
      offset: 60,
    });

    expect(page).toHaveLength(60);
    expect(page[0]?.id).toBe("row-60");
    expect(page[page.length - 1]?.id).toBe("row-119");
  });

  // Regression for the "library shows 7942 videos then collapses to 60"
  // bug. Single-kind libraries (only episodes or only movies) used to fall
  // through to slice(0, limit), which made every load-more request return
  // the same first page. The frontend's duplicate-detection guard then
  // clamped total to the already-loaded count, so users saw the list jump
  // from 7942 to 60.
  it("still honors offset when one kind happens to be empty in a mixed fetch", () => {
    const episodesOnly = Array.from({ length: 120 }, (_, index) => ({
      id: `episode-${index}`,
    }));

    const page = paginateMergedVideos(episodesOnly, {
      mixedFetch: true,
      limit: 60,
      offset: 60,
    });

    expect(page).toHaveLength(60);
    expect(page[0]?.id).toBe("episode-60");
    expect(page[page.length - 1]?.id).toBe("episode-119");
  });

  it("returns an empty page when the offset is past the merged window", () => {
    const page = paginateMergedVideos(overFetched, {
      mixedFetch: true,
      limit: 60,
      offset: 200,
    });

    expect(page).toEqual([]);
  });

  it("ignores offset on single-kind fetches because SQL already paginated", () => {
    const page = paginateMergedVideos(singlePage, {
      mixedFetch: false,
      limit: 60,
      offset: 60,
    });

    expect(page).toHaveLength(60);
    expect(page[0]?.id).toBe("page-0");
    expect(page[page.length - 1]?.id).toBe("page-59");
  });
});
