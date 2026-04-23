import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@obscura/app-core";

const {
  db,
  getWebDb,
  acceptMovieScrapeWrite,
  acceptEpisodeScrapeWrite,
  acceptSeriesScrapeWrite,
} = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  acceptMovieScrapeWrite: vi.fn(),
  acceptEpisodeScrapeWrite: vi.fn(),
  acceptSeriesScrapeWrite: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("@obscura/app-core", async () => {
  const actual = await vi.importActual<typeof import("@obscura/app-core")>(
    "@obscura/app-core",
  );
  return {
    ...actual,
    acceptMovieScrapeWrite,
    acceptEpisodeScrapeWrite,
    acceptSeriesScrapeWrite,
  };
});

describe("/api/video/*/accept-scrape routes", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    acceptMovieScrapeWrite.mockReset();
    acceptEpisodeScrapeWrite.mockReset();
    acceptSeriesScrapeWrite.mockReset();
  });

  it("passes movie accept bodies through to app-core", async () => {
    acceptMovieScrapeWrite.mockResolvedValue({ ok: true });

    const { POST } = await import("./movies/[id]/accept-scrape/+server");
    const response = await POST({
      params: { id: "movie-1" },
      request: new Request("http://test/api/video/movies/movie-1/accept-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrapeResultId: "result-1",
          fieldMask: { title: true, cast: false },
          selectedImages: { poster: "https://example.com/poster.jpg" },
        }),
      }),
    } as never);

    expect(acceptMovieScrapeWrite).toHaveBeenCalledWith(db, {
      movieId: "movie-1",
      scrapeResultId: "result-1",
      fieldMask: { title: true, cast: false },
      selectedImages: { poster: "https://example.com/poster.jpg" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("passes episode accept bodies through to app-core", async () => {
    acceptEpisodeScrapeWrite.mockResolvedValue({ ok: true });

    const { POST } = await import("./episodes/[id]/accept-scrape/+server");
    const response = await POST({
      params: { id: "episode-1" },
      request: new Request(
        "http://test/api/video/episodes/episode-1/accept-scrape",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scrapeResultId: "result-2",
            fieldMask: { overview: true },
          }),
        },
      ),
    } as never);

    expect(acceptEpisodeScrapeWrite).toHaveBeenCalledWith(db, {
      episodeId: "episode-1",
      scrapeResultId: "result-2",
      fieldMask: { overview: true },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("passes series accept cascade bodies through to app-core", async () => {
    acceptSeriesScrapeWrite.mockResolvedValue({
      ok: true,
      seasonsUpdated: 2,
      episodesUpdated: 5,
    });

    const { POST } = await import("./series/[id]/accept-scrape/+server");
    const response = await POST({
      params: { id: "series-1" },
      request: new Request("http://test/api/video/series/series-1/accept-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrapeResultId: "result-3",
          fieldMask: { title: true, cast: true },
          selectedImages: { poster: "https://example.com/poster.jpg" },
          cascade: {
            acceptAllSeasons: false,
            seasonOverrides: {
              1: {
                accepted: true,
                fieldMask: { overview: true },
                episodes: {
                  2: {
                    accepted: true,
                    fieldMask: { title: true },
                  },
                },
              },
            },
          },
        }),
      }),
    } as never);

    expect(acceptSeriesScrapeWrite).toHaveBeenCalledWith(db, {
      seriesId: "series-1",
      scrapeResultId: "result-3",
      fieldMask: { title: true, cast: true },
      selectedImages: { poster: "https://example.com/poster.jpg" },
      cascade: {
        acceptAllSeasons: false,
        seasonOverrides: {
          1: {
            accepted: true,
            fieldMask: { overview: true },
            episodes: {
              2: {
                accepted: true,
                fieldMask: { title: true },
              },
            },
          },
        },
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      seasonsUpdated: 2,
      episodesUpdated: 5,
    });
  });

  it("maps shared validation errors to the standard error JSON body", async () => {
    acceptMovieScrapeWrite.mockRejectedValue(
      new ValidationError("scrapeResultId required"),
    );

    const { POST } = await import("./movies/[id]/accept-scrape/+server");
    const response = await POST({
      params: { id: "movie-1" },
      request: new Request("http://test/api/video/movies/movie-1/accept-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "scrapeResultId required" });
  });
});
