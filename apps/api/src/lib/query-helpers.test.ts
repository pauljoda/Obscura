import { describe, expect, it } from "vitest";
import { schema } from "../db";
import {
  buildBooleanCondition,
  buildDateConditions,
  buildRatingConditions,
  buildResolutionConditions,
  parsePagination,
  toArray,
} from "./query-helpers.js";

const { videoMovies } = schema;

describe("toArray", () => {
  it("normalizes scalar, list, and empty values", () => {
    expect(toArray(undefined)).toEqual([]);
    expect(toArray("one")).toEqual(["one"]);
    expect(toArray(["one", "two"])).toEqual(["one", "two"]);
  });
});

describe("parsePagination", () => {
  it("applies defaults and clamps the limit", () => {
    expect(parsePagination(undefined, undefined, 25, 100)).toEqual({
      limit: 25,
      offset: 0,
    });
    expect(parsePagination("500", "10", 25, 100)).toEqual({
      limit: 100,
      offset: 10,
    });
  });
});

describe("query helper condition builders", () => {
  it("builds rating and date conditions only for valid values", () => {
    expect(buildRatingConditions(videoMovies.rating, "4", "5")).toHaveLength(2);
    expect(buildRatingConditions(videoMovies.rating, "bogus", "99")).toHaveLength(0);
    expect(buildDateConditions(videoMovies.releaseDate, "2026-01-01", "2026-12-31")).toHaveLength(2);
    expect(buildDateConditions(videoMovies.releaseDate, "invalid", "also-invalid")).toHaveLength(0);
  });

  it("maps boolean and resolution filters", () => {
    expect(buildBooleanCondition(videoMovies.organized, "true")).toBeTruthy();
    expect(buildBooleanCondition(videoMovies.organized, "false")).toBeTruthy();
    expect(buildBooleanCondition(videoMovies.organized, "maybe")).toBeUndefined();

    expect(buildResolutionConditions(videoMovies.height, ["1080p"])).toBeTruthy();
    expect(buildResolutionConditions(videoMovies.height, ["unknown"])).toBeUndefined();
  });
});
