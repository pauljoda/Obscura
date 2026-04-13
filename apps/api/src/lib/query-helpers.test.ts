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

const { scenes } = schema;

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
    expect(buildRatingConditions(scenes.rating, "4", "5")).toHaveLength(2);
    expect(buildRatingConditions(scenes.rating, "bogus", "99")).toHaveLength(0);
    expect(buildDateConditions(scenes.date, "2026-01-01", "2026-12-31")).toHaveLength(2);
    expect(buildDateConditions(scenes.date, "invalid", "also-invalid")).toHaveLength(0);
  });

  it("maps boolean and resolution filters", () => {
    expect(buildBooleanCondition(scenes.organized, "true")).toBeTruthy();
    expect(buildBooleanCondition(scenes.organized, "false")).toBeTruthy();
    expect(buildBooleanCondition(scenes.organized, "maybe")).toBeUndefined();

    expect(buildResolutionConditions(scenes.height, ["1080p"])).toBeTruthy();
    expect(buildResolutionConditions(scenes.height, ["unknown"])).toBeUndefined();
  });
});
