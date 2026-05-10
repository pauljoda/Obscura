import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchVideoDetail } = vi.hoisted(() => ({
  fetchVideoDetail: vi.fn(),
}));

const { parseNsfwModeCookie } = vi.hoisted(() => ({
  parseNsfwModeCookie: vi.fn(() => "show"),
}));

vi.mock("$lib/server/videos", () => ({
  fetchVideoDetail,
}));

vi.mock("$lib/nsfw/cookie", () => ({
  parseNsfwModeCookie,
}));

describe("/videos/[id] page server load", () => {
  beforeEach(() => {
    fetchVideoDetail.mockReset();
    parseNsfwModeCookie.mockReset();

    fetchVideoDetail.mockResolvedValue({
      id: "video-1",
      title: "Hidden Video",
      isNsfw: true,
    });
    parseNsfwModeCookie.mockReturnValue("off");
  });

  it("redirects NSFW video detail back home in SFW mode", async () => {
    const eventFetch = vi.fn();
    const { load } = await import("./+page.server");

    await expect(
      load({
        params: { id: "video-1" },
        cookies: { get: vi.fn(() => "off") },
        depends: vi.fn(),
        fetch: eventFetch,
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/",
    });

    expect(fetchVideoDetail).toHaveBeenCalledWith("video-1", { fetch: eventFetch });
  });
});
