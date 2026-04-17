import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("./core", async () => {
  const actual = await vi.importActual<typeof import("./core")>("./core");
  return {
    ...actual,
    serverFetch: vi.fn(),
  };
});

import { serverFetch } from "./core";
import { fetchVideos } from "./videos";

describe("server fetchVideos", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("matches the client video filter query shape", async () => {
    const serverFetchMock = vi.mocked(serverFetch);
    serverFetchMock.mockResolvedValue({
      videos: [],
      total: 0,
      limit: 0,
      offset: 0,
    });

    await fetchVideos({
      search: "alpha",
      sort: "recent",
      order: "desc",
      resolution: ["1080p"],
      tag: ["tag-a", "tag-b"],
      performer: ["performer-a"],
      studio: ["studio-a"],
      codec: ["h264"],
      interactive: "false",
      ratingMin: 2,
      ratingMax: 5,
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
      durationMin: 60,
      durationMax: 3600,
      organized: "true",
      hasFile: "true",
      played: "false",
      limit: 50,
      offset: 100,
      nsfw: "off",
      videoSeriesId: "series-1",
      seriesScope: "subtree",
      uncategorized: true,
      seasonNumber: "2",
    });

    expect(serverFetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/videos?"),
      { tags: ["videos"] },
    );

    const path = serverFetchMock.mock.calls[0]?.[0] as string;
    expect(path).toContain("search=alpha");
    expect(path).toContain("resolution=1080p");
    expect(path).toContain("tag=tag-a");
    expect(path).toContain("tag=tag-b");
    expect(path).toContain("performer=performer-a");
    expect(path).toContain("studio=studio-a");
    expect(path).toContain("codec=h264");
    expect(path).toContain("interactive=false");
    expect(path).toContain("videoSeriesId=series-1");
    expect(path).toContain("seriesScope=subtree");
    expect(path).toContain("seasonNumber=2");
    expect(path).toContain("uncategorized=true");
  });
});
