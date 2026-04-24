import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchVideoCards, fetchSeries, fetchSeriesDetail } = vi.hoisted(() => ({
  fetchVideoCards: vi.fn(),
  fetchSeries: vi.fn(),
  fetchSeriesDetail: vi.fn(),
}));

const { parseNsfwModeCookie } = vi.hoisted(() => ({
  parseNsfwModeCookie: vi.fn(() => "show"),
}));
const { getUiPrefRead } = vi.hoisted(() => ({
  getUiPrefRead: vi.fn(() => Promise.resolve(null)),
}));
const { getWebDb } = vi.hoisted(() => ({
  getWebDb: vi.fn(() => Promise.resolve({})),
}));

vi.mock("$lib/server/videos", () => ({
  fetchVideoCards,
  fetchSeries,
  fetchSeriesDetail,
}));

vi.mock("$lib/nsfw/cookie", () => ({
  parseNsfwModeCookie,
}));

vi.mock("@obscura/app-core", () => ({
  getUiPrefRead,
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

function makeSeries(overrides: Record<string, unknown> = {}) {
  return {
    id: "series-1",
    title: "Signal Station",
    displayTitle: "Signal Station",
    customName: null,
    folderPath: "/media/videos/Signal Station",
    relativePath: "Signal Station",
    libraryRootId: "root-1",
    libraryRootLabel: "Videos",
    coverImagePath: null,
    backdropImagePath: null,
    previewThumbnailPaths: [],
    date: null,
    rating: null,
    organized: true,
    isNsfw: false,
    containsNsfwDescendants: false,
    studioId: null,
    studioName: null,
    visibleSfwVideoCount: 0,
    directVideoCount: 0,
    totalVideoCount: 0,
    childSeasonCount: 0,
    parentId: null,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    details: null,
    urls: [],
    externalSeriesId: null,
    studio: null,
    performers: [],
    tags: [],
    breadcrumbs: [],
    children: [],
    seasons: [],
    renderingMode: "flat",
    ...overrides,
  };
}

describe("/series page server load", () => {
  beforeEach(() => {
    fetchVideoCards.mockReset();
    fetchSeries.mockReset();
    fetchSeriesDetail.mockReset();
    parseNsfwModeCookie.mockClear();
    getUiPrefRead.mockReset();
    getUiPrefRead.mockResolvedValue(null);
    getWebDb.mockClear();

    fetchSeries.mockResolvedValue({ items: [], total: 0, limit: 200, offset: 0 });
  });

  it("shows only the root series grid on the root route", async () => {
    fetchSeries.mockResolvedValueOnce({
      items: [{ id: "series-1", displayTitle: "Signal Station" }],
      total: 1,
      limit: 200,
      offset: 0,
    });

    const { load } = await import("./+page.server");
    const result = (await load({
      cookies: { get: vi.fn(() => "show") },
      url: new URL("http://test/series"),
      depends: vi.fn(),
      fetch: vi.fn(),
    } as never)) as Exclude<Awaited<ReturnType<typeof load>>, void>;

    expect(fetchVideoCards).not.toHaveBeenCalled();
    expect(result.videos).toEqual([]);
    expect(result.series).toHaveLength(1);
  });

  it("does not fetch videos for a seasonized series until a season is selected", async () => {
    fetchSeriesDetail.mockResolvedValue(
      makeSeries({
        renderingMode: "seasons",
        childSeasonCount: 2,
        seasons: [
          {
            id: "season-1",
            seasonNumber: 1,
            title: "Season 1",
            posterPath: null,
            episodeCount: 8,
            previewThumbnailPath: null,
          },
        ],
      }),
    );

    const { load } = await import("./+page.server");
    const result = (await load({
      cookies: { get: vi.fn(() => "show") },
      url: new URL("http://test/series?series=series-1"),
      depends: vi.fn(),
      fetch: vi.fn(),
    } as never)) as Exclude<Awaited<ReturnType<typeof load>>, void>;

    expect(fetchSeriesDetail).toHaveBeenCalledWith(
      "series-1",
      { nsfw: "show" },
      expect.anything(),
    );
    expect(fetchVideoCards).not.toHaveBeenCalled();
    expect(result.videos).toEqual([]);
    expect(result.activeSeries?.renderingMode).toBe("seasons");
  });

  it("fetches only the selected season videos in a season subview", async () => {
    fetchSeriesDetail.mockResolvedValue(
      makeSeries({
        renderingMode: "seasons",
        childSeasonCount: 2,
        seasons: [
          {
            id: "season-2",
            seasonNumber: 2,
            title: "Season 2",
            posterPath: null,
            episodeCount: 10,
            previewThumbnailPath: null,
          },
        ],
      }),
    );
    fetchVideoCards.mockResolvedValue({
      videos: [{ id: "episode-1", title: "Into the Dark" }],
      total: 1,
      limit: 60,
      offset: 0,
    });

    const { load } = await import("./+page.server");
    const result = (await load({
      cookies: { get: vi.fn(() => "show") },
      url: new URL("http://test/series?series=series-1&season=2&sort=title&order=asc"),
      depends: vi.fn(),
      fetch: vi.fn(),
    } as never)) as Exclude<Awaited<ReturnType<typeof load>>, void>;

    expect(fetchVideoCards).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: "title",
        order: "asc",
        videoSeriesId: "series-1",
        seasonNumber: "2",
      }),
      expect.anything(),
    );
    expect(result.videos).toEqual([{ id: "episode-1", title: "Into the Dark" }]);
  });
});
