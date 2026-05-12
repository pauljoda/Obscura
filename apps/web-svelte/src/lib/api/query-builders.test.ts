import { describe, expect, it } from "vitest";
import {
  buildAudioLibraryListQuery,
  buildBookListQuery,
  buildGalleryListQuery,
  buildImageListQuery,
  buildStudioListQuery,
  buildTagListQuery,
  buildVideoSeriesListQuery,
} from "./query-builders";

describe("media list query builders", () => {
  it("encodes scalar and repeated gallery params in a shared order", () => {
    expect(
      buildGalleryListQuery({
        search: "neon",
        sort: "rating",
        order: "desc",
        randomSeed: "seed-1",
        tag: ["tag-a", "tag-b"],
        performer: ["perf-a", "perf-b"],
        studio: "studio-a",
        type: "gallery",
        parent: "parent-a",
        root: "root-a",
        ratingMin: 3,
        ratingMax: 5,
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
        imageCountMin: 12,
        organized: "true",
        isNsfw: "false",
        nsfw: "off",
        limit: 40,
        offset: 80,
      }),
    ).toBe(
      "?search=neon&sort=rating&order=desc&randomSeed=seed-1&studio=studio-a&type=gallery&parent=parent-a&root=root-a&ratingMin=3&ratingMax=5&dateFrom=2025-01-01&dateTo=2025-12-31&imageCountMin=12&organized=true&isNsfw=false&nsfw=off&limit=40&offset=80&tag=tag-a&tag=tag-b&performer=perf-a&performer=perf-b",
    );
  });

  it("keeps client and server-safe list params identical across media types", () => {
    const common = {
      search: "arc",
      sort: "name",
      order: "asc" as const,
      randomSeed: "seed-2",
      tag: ["tag-1"],
      performer: ["performer-1"],
      studio: "studio-1",
      ratingMin: 2,
      ratingMax: 4,
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
      organized: "false",
      isNsfw: "true",
      nsfw: "on",
      limit: 25,
      offset: 50,
    };

    expect(buildBookListQuery({ ...common, read: "false" })).toBe(
      "?search=arc&sort=name&order=asc&randomSeed=seed-2&studio=studio-1&ratingMin=2&ratingMax=4&dateFrom=2024-01-01&dateTo=2024-12-31&organized=false&isNsfw=true&read=false&nsfw=on&limit=25&offset=50&tag=tag-1&performer=performer-1",
    );
    expect(
      buildImageListQuery({
        ...common,
        gallery: "gallery-1",
        format: ["jpg", "webp"],
        dimension: ["landscape"],
      }),
    ).toBe(
      "?search=arc&sort=name&order=asc&randomSeed=seed-2&gallery=gallery-1&studio=studio-1&nsfw=on&ratingMin=2&ratingMax=4&dateFrom=2024-01-01&dateTo=2024-12-31&organized=false&isNsfw=true&limit=25&offset=50&tag=tag-1&performer=performer-1&format=jpg&format=webp&dimension=landscape",
    );
    expect(buildAudioLibraryListQuery({ ...common, parent: "parent-1", root: "root-1", trackCountMin: 7 })).toBe(
      "?search=arc&sort=name&order=asc&randomSeed=seed-2&studio=studio-1&parent=parent-1&root=root-1&ratingMin=2&ratingMax=4&dateFrom=2024-01-01&dateTo=2024-12-31&trackCountMin=7&organized=false&isNsfw=true&nsfw=on&limit=25&offset=50&tag=tag-1&performer=performer-1",
    );
  });

  it("normalizes scalar-or-array filters for video series", () => {
    expect(
      buildVideoSeriesListQuery({
        search: "show",
        studio: "studio-1",
        tag: ["tag-1", "tag-2"],
        performer: "performer-1",
        limit: 10,
        offset: 20,
      }),
    ).toBe(
      "?search=show&limit=10&offset=20&studio=studio-1&tag=tag-1&tag=tag-2&performer=performer-1",
    );
  });

  it("encodes tag and studio list params identically", () => {
    const params = {
      search: "glow",
      sort: "rating",
      order: "desc" as const,
      randomSeed: "seed-3",
      favorite: "true",
      hasImage: "false",
      ratingMin: 4,
      limit: 60,
      offset: 120,
      nsfw: "off",
    };

    expect(buildTagListQuery(params)).toBe(
      "?search=glow&sort=rating&order=desc&randomSeed=seed-3&favorite=true&hasImage=false&ratingMin=4&limit=60&offset=120&nsfw=off",
    );
    expect(buildStudioListQuery(params)).toBe(buildTagListQuery(params));
  });
});
