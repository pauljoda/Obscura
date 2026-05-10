import { describe, expect, it, vi } from "vitest";
import { collectionsSurfaceConfig } from "./collections";

const { fetchCollections } = vi.hoisted(() => ({
  fetchCollections: vi.fn(),
}));

vi.mock("$lib/api/media", () => ({
  fetchCollections,
  deleteCollection: vi.fn(),
}));

describe("collectionsSurfaceConfig", () => {
  it("passes the active SFW filter through client-side pagination fetches", async () => {
    fetchCollections.mockResolvedValue({ items: [], total: 0 });

    const config = collectionsSurfaceConfig({
      initial: { items: [], total: 0 },
      pageSize: 60,
      page: 1,
      nsfw: "off",
    });

    await config.fetcher({
      offset: 0,
      limit: 60,
      signal: new AbortController().signal,
      prefs: {
        viewMode: "grid",
        sortBy: "recent",
        sortDir: "desc",
        search: "",
        activeFilters: [],
      },
    });

    expect(fetchCollections).toHaveBeenCalledWith(
      expect.objectContaining({ nsfw: "off" }),
      expect.any(Object),
    );
  });
});
