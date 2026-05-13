import { describe, expect, it, vi } from "vitest";
import { studiosSurfaceConfig } from "./studios-v1";
import { tagsSurfaceConfig } from "./tags-v1";

const {
  deleteStudio,
  deleteTag,
  fetchStudios,
  fetchTags,
  updateStudio,
  updateTag,
} = vi.hoisted(() => ({
  deleteStudio: vi.fn(),
  deleteTag: vi.fn(),
  fetchStudios: vi.fn(),
  fetchTags: vi.fn(),
  updateStudio: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("$lib/v1/api/entities-v1", () => ({
  deleteStudio,
  deleteTag,
  fetchStudios,
  fetchTags,
  updateStudio,
  updateTag,
}));

describe("tagsSurfaceConfig", () => {
  it("encodes persisted filters into paginated tag fetches", async () => {
    fetchTags.mockResolvedValue({ tags: [], total: 0, limit: 60, offset: 0 });

    const config = tagsSurfaceConfig({
      initial: { items: [], total: 0 },
      pageSize: 60,
      page: 1,
      nsfwMode: "off",
    });

    await config.fetcher({
      offset: 20,
      limit: 10,
      signal: new AbortController().signal,
      prefs: {
        viewMode: "grid",
        sortBy: "rating",
        sortDir: "desc",
        search: "bright",
        activeFilters: [
          { type: "favorite", label: "Favorite", value: "true" },
          { type: "hasImage", label: "Image", value: "false" },
          { type: "ratingMin", label: "Min rating", value: "4" },
        ],
        extras: { randomSeed: "seed" },
      },
    });

    expect(fetchTags).toHaveBeenCalledWith(
      {
        search: "bright",
        sort: "rating",
        order: "desc",
        randomSeed: "seed",
        favorite: "true",
        hasImage: "false",
        ratingMin: 4,
        nsfw: "off",
        limit: 10,
        offset: 20,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("runs tag bulk actions through the entity API", async () => {
    const onMutated = vi.fn();
    const config = tagsSurfaceConfig({
      initial: { items: [], total: 0 },
      pageSize: 60,
      page: 1,
      nsfwMode: "on",
      onMutated,
    });
    const item = {
      id: "tag-1",
      name: "Tag",
      videoCount: 0,
      galleryCount: 0,
      imageCount: 0,
      audioTrackCount: 0,
      imagePath: null,
      favorite: false,
      rating: null,
      isNsfw: false,
    };

    await config.bulkActions?.find((action) => action.id === "mark-nsfw")?.handler([item]);
    await config.bulkActions?.find((action) => action.id === "delete")?.handler([item]);

    expect(updateTag).toHaveBeenCalledWith("tag-1", { isNsfw: true });
    expect(deleteTag).toHaveBeenCalledWith("tag-1");
    expect(onMutated).toHaveBeenCalledTimes(2);
  });
});

describe("studiosSurfaceConfig", () => {
  it("encodes persisted filters into paginated studio fetches", async () => {
    fetchStudios.mockResolvedValue({ studios: [], total: 0, limit: 60, offset: 0 });

    const config = studiosSurfaceConfig({
      initial: { items: [], total: 0 },
      pageSize: 60,
      page: 1,
      nsfwMode: "off",
    });

    await config.fetcher({
      offset: 0,
      limit: 25,
      signal: new AbortController().signal,
      prefs: {
        viewMode: "grid",
        sortBy: "videoCount",
        sortDir: "desc",
        search: "arc",
        activeFilters: [
          { type: "favorite", label: "Favorite", value: "true" },
          { type: "hasImage", label: "Photo", value: "true" },
          { type: "ratingMin", label: "Min rating", value: "5" },
        ],
      },
    });

    expect(fetchStudios).toHaveBeenCalledWith(
      {
        search: "arc",
        sort: "videoCount",
        order: "desc",
        randomSeed: undefined,
        favorite: "true",
        hasImage: "true",
        ratingMin: 5,
        nsfw: "off",
        limit: 25,
        offset: 0,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("runs studio bulk actions through the entity API", async () => {
    const onMutated = vi.fn();
    const config = studiosSurfaceConfig({
      initial: { items: [], total: 0 },
      pageSize: 60,
      page: 1,
      nsfwMode: "on",
      onMutated,
    });
    const item = {
      id: "studio-1",
      name: "Studio",
      url: null,
      imageUrl: null,
      imagePath: null,
      favorite: false,
      rating: null,
      isNsfw: false,
      videoCount: 0,
      imageAppearanceCount: 0,
      audioLibraryCount: 0,
    };

    await config.bulkActions?.find((action) => action.id === "mark-nsfw")?.handler([item]);
    await config.bulkActions?.find((action) => action.id === "delete")?.handler([item]);

    expect(updateStudio).toHaveBeenCalledWith("studio-1", { isNsfw: true });
    expect(deleteStudio).toHaveBeenCalledWith("studio-1");
    expect(onMutated).toHaveBeenCalledTimes(2);
  });
});
