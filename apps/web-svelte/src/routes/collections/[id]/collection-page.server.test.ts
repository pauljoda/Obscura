import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchCollectionDetail, serverFetch, parseNsfwModeCookie } = vi.hoisted(() => ({
  fetchCollectionDetail: vi.fn(),
  serverFetch: vi.fn(),
  parseNsfwModeCookie: vi.fn(() => "show"),
}));

vi.mock("$lib/server/media", () => ({
  fetchCollectionDetail,
}));

vi.mock("$lib/server/core", () => ({
  serverFetch,
}));

vi.mock("$lib/nsfw/cookie", () => ({
  parseNsfwModeCookie,
}));

describe("/collections/[id] page server load", () => {
  beforeEach(() => {
    fetchCollectionDetail.mockReset();
    serverFetch.mockReset();
    parseNsfwModeCookie.mockReset();

    fetchCollectionDetail.mockResolvedValue({
      id: "collection-1",
      name: "Hidden Set",
      isNsfw: true,
    });
    serverFetch.mockResolvedValue({ items: [], total: 0, limit: 120, offset: 0 });
    parseNsfwModeCookie.mockReturnValue("off");
  });

  it("redirects NSFW collection detail back home in SFW mode", async () => {
    const eventFetch = vi.fn();
    const { load } = await import("./+page.server");

    await expect(
      load({
        params: { id: "collection-1" },
        cookies: { get: vi.fn(() => "off") },
        depends: vi.fn(),
        fetch: eventFetch,
      } as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/",
    });

    expect(fetchCollectionDetail).toHaveBeenCalledWith("collection-1", {
      fetch: eventFetch,
    });
    expect(serverFetch).not.toHaveBeenCalled();
  });
});
