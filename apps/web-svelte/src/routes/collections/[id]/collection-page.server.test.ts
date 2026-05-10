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

  it("loads collection detail through the current NSFW mode", async () => {
    const eventFetch = vi.fn();
    const { load } = await import("./+page.server");

    await load({
      params: { id: "collection-1" },
      cookies: { get: vi.fn(() => "off") },
      depends: vi.fn(),
      fetch: eventFetch,
    } as never);

    expect(fetchCollectionDetail).toHaveBeenCalledWith("collection-1", {
      fetch: eventFetch,
      nsfw: "off",
    });
  });
});
