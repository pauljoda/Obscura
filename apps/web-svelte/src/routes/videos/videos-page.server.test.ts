import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchVideoCards, fetchSeries, fetchSeriesDetail } = vi.hoisted(() => ({
  fetchVideoCards: vi.fn(),
  fetchSeries: vi.fn(),
  fetchSeriesDetail: vi.fn(),
}));

const { parseNsfwModeCookie } = vi.hoisted(() => ({
  parseNsfwModeCookie: vi.fn(() => "show"),
}));

vi.mock("$lib/server/videos", () => ({
  fetchVideoCards,
  fetchSeries,
  fetchSeriesDetail,
}));

vi.mock("$lib/nsfw-cookie", () => ({
  parseNsfwModeCookie,
}));

describe("/videos page server load", () => {
  beforeEach(() => {
    fetchVideoCards.mockReset();
    fetchSeries.mockReset();
    fetchSeriesDetail.mockReset();
    parseNsfwModeCookie.mockClear();
  });

  it("redirects legacy series drill-down URLs to /series", async () => {
    const { load } = await import("./+page.server");

    await expect(
      load({
        cookies: { get: vi.fn(() => "show") },
        url: new URL("http://test/videos?series=series-1&season=2&search=signal"),
        depends: vi.fn(),
        fetch: vi.fn(),
      } as never),
    ).rejects.toMatchObject({
      status: 307,
      location: "/series?series=series-1&season=2&search=signal",
    });

    expect(fetchVideoCards).not.toHaveBeenCalled();
    expect(fetchSeries).not.toHaveBeenCalled();
    expect(fetchSeriesDetail).not.toHaveBeenCalled();
  });

  it("redirects the old series view toggle to /series", async () => {
    const { load } = await import("./+page.server");

    await expect(
      load({
        cookies: { get: vi.fn(() => "show") },
        url: new URL("http://test/videos?view=series&search=alpha"),
        depends: vi.fn(),
        fetch: vi.fn(),
      } as never),
    ).rejects.toMatchObject({
      status: 307,
      location: "/series?search=alpha",
    });
  });
});
