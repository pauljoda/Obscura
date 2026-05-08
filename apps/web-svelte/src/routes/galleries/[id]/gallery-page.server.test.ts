import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchGalleryDetail, loadFormFactorUiPrefObjects, loadUiPrefObject } = vi.hoisted(() => ({
  fetchGalleryDetail: vi.fn(),
  loadFormFactorUiPrefObjects: vi.fn(),
  loadUiPrefObject: vi.fn(),
}));

vi.mock("$lib/server/media", () => ({
  fetchGalleryDetail,
}));

vi.mock("$lib/server/ui-prefs", () => ({
  loadFormFactorUiPrefObjects,
  loadUiPrefObject,
}));

vi.mock("$lib/nsfw/cookie", () => ({
  parseNsfwModeCookie: vi.fn(() => "show"),
}));

describe("/galleries/[id] page server load", () => {
  beforeEach(() => {
    fetchGalleryDetail.mockReset();
    loadFormFactorUiPrefObjects.mockReset();
    loadUiPrefObject.mockReset();

    fetchGalleryDetail.mockResolvedValue({
      id: "gallery-1",
      title: "Comic",
      images: [],
      imageTotal: 0,
    });
    loadFormFactorUiPrefObjects.mockResolvedValue({ mobile: {}, desktop: {} });
    loadUiPrefObject.mockResolvedValue({
      pageIndex: 4,
      pageCount: 12,
      updatedAt: "2026-05-08T00:00:00.000Z",
    });
  });

  it("loads comic reading progress for the gallery", async () => {
    const { load } = await import("./+page.server");

    const result = await load({
      params: { id: "gallery-1" },
      depends: vi.fn(),
      fetch: vi.fn(),
      cookies: { get: vi.fn() },
    } as never);

    expect(loadUiPrefObject).toHaveBeenCalledWith(
      "comic-reader:gallery-1:progress",
      expect.objectContaining({ pageIndex: 0, pageCount: 0 }),
    );
    if (!result) throw new Error("Expected gallery page data");
    expect(result.comicProgress).toMatchObject({ pageIndex: 4, pageCount: 12 });
  });
});
