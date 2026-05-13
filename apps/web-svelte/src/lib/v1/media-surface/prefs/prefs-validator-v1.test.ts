import { describe, expect, it } from "vitest";
import { validateSurfacePrefs } from "./prefs-validator-v1";
import type { MediaSurfaceConfig, SurfacePrefs } from "../config-v1";

type FilterType = "rating" | "ratingMin" | "ratingMax";

const defaultPrefs: SurfacePrefs<FilterType> = {
  viewMode: "grid",
  sortBy: "recent",
  sortDir: "desc",
  search: "",
  activeFilters: [],
  cols: 5,
};

const config = {
  defaultPrefs,
  sortOptions: [
    { value: "recent", label: "Recently Added" },
    { value: "title", label: "Title A-Z" },
  ],
  viewModes: [
    { mode: "grid", icon: {} as never, label: "Grid view" },
    { mode: "list", icon: {} as never, label: "List view" },
  ],
  filterSections: [
    {
      kind: "rating",
      filterType: "rating",
      label: "Rating",
      rangeTypes: { min: "ratingMin", max: "ratingMax" },
    },
  ],
  thumbSize: { min: 2, max: 8, default: 5 },
} satisfies Pick<
  MediaSurfaceConfig<{ id: string }, FilterType>,
  "defaultPrefs" | "sortOptions" | "viewModes" | "filterSections" | "thumbSize"
>;

describe("validateSurfacePrefs", () => {
  it("defaults missing thumbnail columns to the largest configured thumbnail size", () => {
    const prefs = validateSurfacePrefs(config, {
      viewMode: "grid",
      sortBy: "title",
      sortDir: "asc",
      search: "",
      activeFilters: [],
    });

    expect(prefs?.cols).toBe(2);
  });

  it("keeps a saved thumbnail column count within the configured bounds", () => {
    const prefs = validateSurfacePrefs(config, {
      viewMode: "grid",
      sortBy: "title",
      sortDir: "asc",
      search: "",
      activeFilters: [],
      cols: 6,
    });

    expect(prefs?.cols).toBe(6);
  });

  it("clamps an out-of-range saved thumbnail column count to the configured bounds", () => {
    const tooSmall = validateSurfacePrefs(config, {
      viewMode: "grid",
      sortBy: "title",
      sortDir: "asc",
      search: "",
      activeFilters: [],
      cols: 1,
    });
    const tooLarge = validateSurfacePrefs(config, {
      viewMode: "grid",
      sortBy: "title",
      sortDir: "asc",
      search: "",
      activeFilters: [],
      cols: 99,
    });

    expect(tooSmall?.cols).toBe(2);
    expect(tooLarge?.cols).toBe(8);
  });
});
