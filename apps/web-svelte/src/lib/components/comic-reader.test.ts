import { describe, expect, it } from "vitest";
import { comicSpreadForIndex, nextComicIndex, previousComicIndex } from "./comic-reader";

describe("comic reader page math", () => {
  it("shows one page at a time in single-page mode", () => {
    expect(comicSpreadForIndex(2, 8, { pageMode: "single", firstPageIsCover: true })).toEqual([2]);
  });

  it("pairs pages in two-page mode", () => {
    expect(comicSpreadForIndex(0, 8, { pageMode: "double", firstPageIsCover: false })).toEqual([0, 1]);
    expect(comicSpreadForIndex(1, 8, { pageMode: "double", firstPageIsCover: false })).toEqual([0, 1]);
    expect(comicSpreadForIndex(2, 8, { pageMode: "double", firstPageIsCover: false })).toEqual([2, 3]);
  });

  it("keeps the first page alone when it is marked as cover", () => {
    expect(comicSpreadForIndex(0, 8, { pageMode: "double", firstPageIsCover: true })).toEqual([0]);
    expect(comicSpreadForIndex(1, 8, { pageMode: "double", firstPageIsCover: true })).toEqual([1, 2]);
    expect(comicSpreadForIndex(2, 8, { pageMode: "double", firstPageIsCover: true })).toEqual([1, 2]);
    expect(comicSpreadForIndex(7, 8, { pageMode: "double", firstPageIsCover: true })).toEqual([7]);
  });

  it("moves by spreads in double-page mode", () => {
    const opts = { pageMode: "double" as const, firstPageIsCover: true };
    expect(nextComicIndex(0, 8, opts)).toBe(1);
    expect(nextComicIndex(1, 8, opts)).toBe(3);
    expect(previousComicIndex(3, 8, opts)).toBe(1);
    expect(previousComicIndex(1, 8, opts)).toBe(0);
  });
});
