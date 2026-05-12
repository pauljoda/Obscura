import { describe, expect, it } from "vitest";
import {
  applyStudioListQuery,
  applyTagListQuery,
  type StudioListEntry,
  type TagListEntry,
} from "./index";

const tagRows: TagListEntry[] = [
  {
    id: "tag-alpha",
    name: "Alpha",
    description: "bright story",
    aliases: "first",
    imagePath: "/tags/alpha.jpg",
    favorite: true,
    rating: 5,
    isNsfw: false,
    videoCount: 2,
    galleryCount: 1,
    imageCount: 0,
    audioTrackCount: 0,
  },
  {
    id: "tag-beta",
    name: "Beta",
    description: "quiet",
    aliases: null,
    imagePath: null,
    favorite: false,
    rating: 2,
    isNsfw: false,
    videoCount: 5,
    galleryCount: 0,
    imageCount: 4,
    audioTrackCount: 1,
  },
  {
    id: "tag-gamma",
    name: "Gamma",
    description: null,
    aliases: "hidden bright",
    imagePath: "/tags/gamma.jpg",
    favorite: false,
    rating: 4,
    isNsfw: true,
    videoCount: 1,
    galleryCount: 0,
    imageCount: 0,
    audioTrackCount: 0,
  },
];

const studioRows: StudioListEntry[] = [
  {
    id: "studio-zed",
    name: "Zed",
    description: "late studio",
    aliases: null,
    url: null,
    parentId: null,
    imageUrl: null,
    imagePath: null,
    favorite: false,
    rating: 2,
    isNsfw: false,
    videoCount: 10,
    imageAppearanceCount: 1,
    audioLibraryCount: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  },
  {
    id: "studio-arc",
    name: "Arc",
    description: "bright studio",
    aliases: "curve",
    url: null,
    parentId: null,
    imageUrl: "https://example.test/arc.jpg",
    imagePath: null,
    favorite: true,
    rating: 5,
    isNsfw: false,
    videoCount: 1,
    imageAppearanceCount: 8,
    audioLibraryCount: 2,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  },
  {
    id: "studio-moon",
    name: "Moon",
    description: null,
    aliases: null,
    url: null,
    parentId: null,
    imageUrl: null,
    imagePath: "/studios/moon.jpg",
    favorite: false,
    rating: 4,
    isNsfw: true,
    videoCount: 3,
    imageAppearanceCount: 0,
    audioLibraryCount: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  },
];

describe("applyTagListQuery", () => {
  it("keeps the default usage ordering and returns pagination metadata", () => {
    const result = applyTagListQuery(tagRows, { limit: "2", offset: "1" });

    expect(result.total).toBe(3);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(1);
    expect(result.tags.map((tag) => tag.id)).toEqual(["tag-alpha", "tag-gamma"]);
  });

  it("filters tags by search, favorite, image presence, rating, and SFW mode", () => {
    const result = applyTagListQuery(tagRows, {
      search: "bright",
      favorite: "false",
      hasImage: "true",
      ratingMin: "4",
      nsfw: "off",
    });

    expect(result.tags.map((tag) => tag.id)).toEqual([]);
  });

  it("uses a stable seeded randomized order", () => {
    const first = applyTagListQuery(tagRows, {
      sort: "randomized",
      randomSeed: "same-seed",
    }).tags.map((tag) => tag.id);
    const second = applyTagListQuery(tagRows, {
      sort: "randomized",
      randomSeed: "same-seed",
    }).tags.map((tag) => tag.id);

    expect(second).toEqual(first);
    expect(first).toHaveLength(3);
  });
});

describe("applyStudioListQuery", () => {
  it("keeps the default name ordering and returns pagination metadata", () => {
    const result = applyStudioListQuery(studioRows, { limit: "2" });

    expect(result.total).toBe(3);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(0);
    expect(result.studios.map((studio) => studio.id)).toEqual([
      "studio-arc",
      "studio-moon",
    ]);
  });

  it("filters studios by search, favorite, image presence, rating, and SFW mode", () => {
    const result = applyStudioListQuery(studioRows, {
      search: "bright",
      favorite: "true",
      hasImage: "true",
      ratingMin: "5",
      nsfw: "off",
    });

    expect(result.studios.map((studio) => studio.id)).toEqual(["studio-arc"]);
  });

  it("sorts studios by video count when requested", () => {
    const result = applyStudioListQuery(studioRows, {
      sort: "videoCount",
      order: "desc",
    });

    expect(result.studios.map((studio) => studio.id)).toEqual([
      "studio-zed",
      "studio-moon",
      "studio-arc",
    ]);
  });
});
