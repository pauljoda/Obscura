import { describe, expect, it } from "vitest";
import {
  buildRandomizedSortSql,
  buildBooleanCondition,
  buildDateConditions,
  buildNsfwFlagConditions,
  buildResolutionConditions,
  parsePagination,
} from "./media-query-helpers";
import { buildHierarchyScopeConditions } from "./hierarchy";
import { getImagePreviewPath } from "./image-media";
import { schema } from "@obscura/db";

describe("media-query-helpers", () => {
  it("clamps pagination to the provided default and max bounds", () => {
    expect(parsePagination(undefined, undefined, 50, 100)).toEqual({
      limit: 50,
      offset: 0,
    });
    expect(parsePagination("999", "12", 50, 100)).toEqual({
      limit: 100,
      offset: 12,
    });
  });

  it("builds boolean and date filters only for valid values", () => {
    expect(buildBooleanCondition(schema.images.organized, "true")).toBeTruthy();
    expect(buildBooleanCondition(schema.images.organized, "false")).toBeTruthy();
    expect(buildBooleanCondition(schema.images.organized, "maybe")).toBeUndefined();

    expect(
      buildDateConditions(schema.images.date, "2026-01-01", "2026-12-31"),
    ).toHaveLength(2);
    expect(
      buildDateConditions(schema.images.date, "bad-date", "also-bad"),
    ).toHaveLength(0);
  });

  it("keeps the global NSFW visibility guard when an explicit NSFW flag filter is active", () => {
    expect(buildNsfwFlagConditions(schema.images.isNsfw, "off", "true")).toHaveLength(2);
    expect(buildNsfwFlagConditions(schema.images.isNsfw, "on", "true")).toHaveLength(1);
    expect(buildNsfwFlagConditions(schema.images.isNsfw, "on", "false")).toHaveLength(1);
    expect(buildNsfwFlagConditions(schema.images.isNsfw, "on", undefined)).toHaveLength(0);
  });

  it("returns a single or combined resolution condition", () => {
    expect(buildResolutionConditions(schema.images.height, ["1080p"])).toBeTruthy();
    expect(
      buildResolutionConditions(schema.images.height, ["1080p", "720p"]),
    ).toBeTruthy();
    expect(buildResolutionConditions(schema.images.height, ["bogus"])).toBeUndefined();
  });

  it("builds a stable randomized sort expression from an id and seed", () => {
    const expression = buildRandomizedSortSql(schema.images.id, "reload-seed");

    expect(expression).toBeTruthy();
  });
});

describe("buildHierarchyScopeConditions", () => {
  it("defaults to top-level rows unless root=all or a search is active", () => {
    expect(
      buildHierarchyScopeConditions(schema.galleries.parentId, {}),
    ).toHaveLength(1);
    expect(
      buildHierarchyScopeConditions(schema.galleries.parentId, { root: "all" }),
    ).toHaveLength(0);
    expect(
      buildHierarchyScopeConditions(schema.galleries.parentId, { search: "term" }),
    ).toHaveLength(0);
  });

  it("prefers an explicit parent filter", () => {
    expect(
      buildHierarchyScopeConditions(schema.galleries.parentId, {
        parent: "gallery-123",
        root: "all",
        search: "ignored",
      }),
    ).toHaveLength(1);
  });
});

describe("getImagePreviewPath", () => {
  it("returns preview asset paths only for video-backed images", () => {
    expect(getImagePreviewPath("img-1", "mp4")).toBe("/assets/images/img-1/preview");
    expect(getImagePreviewPath("img-2", "image/jpeg")).toBeNull();
    expect(getImagePreviewPath("img-3", null)).toBeNull();
  });
});
