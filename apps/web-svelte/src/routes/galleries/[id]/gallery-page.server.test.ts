import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchGalleryDetail, loadFormFactorUiPrefObjects } = vi.hoisted(() => ({
  fetchGalleryDetail: vi.fn(),
  loadFormFactorUiPrefObjects: vi.fn(),
}));

vi.mock("$lib/server/media", () => ({
  fetchGalleryDetail,
}));

vi.mock("$lib/server/ui-prefs", () => ({
  loadFormFactorUiPrefObjects,
}));

vi.mock("$lib/nsfw/cookie", () => ({
  parseNsfwModeCookie: vi.fn(() => "show"),
}));

describe("/galleries/[id] page server load", () => {
  beforeEach(() => {
    fetchGalleryDetail.mockReset();
    loadFormFactorUiPrefObjects.mockReset();

    fetchGalleryDetail.mockResolvedValue({
      id: "gallery-1",
      title: "Comic",
      images: [],
      imageTotal: 0,
    });
    loadFormFactorUiPrefObjects.mockResolvedValue({ mobile: {}, desktop: {} });
  });

  it("loads gallery data without comic reader progress", async () => {
    const { load } = await import("./+page.server");

    const result = await load({
      params: { id: "gallery-1" },
      depends: vi.fn(),
      fetch: vi.fn(),
      cookies: { get: vi.fn() },
    } as never);

    if (!result) throw new Error("Expected gallery page data");
    expect(result).not.toHaveProperty("comicProgress");
  });
});
