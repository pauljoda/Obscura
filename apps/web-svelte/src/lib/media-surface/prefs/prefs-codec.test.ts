import { describe, expect, it } from "vitest";
import { encodeSurfacePrefs } from "./prefs-codec";
import type { FilterSectionSpec, SurfacePrefs } from "../config";

type F =
  | "tag"
  | "performer"
  | "studio"
  | "resolution"
  | "ratingMin"
  | "ratingMax"
  | "rating"
  | "duration"
  | "dateFrom"
  | "dateTo"
  | "date";

const sections: FilterSectionSpec<F>[] = [
  { kind: "alphabetical-id-list", filterType: "tag", label: "Tag", source: "tags" },
  { kind: "alphabetical-id-list", filterType: "performer", label: "Performer", source: "performers" },
  { kind: "alphabetical-id-list", filterType: "studio", label: "Studio", source: "studios" },
  { kind: "enum", filterType: "resolution", label: "Resolution" },
  {
    kind: "rating",
    filterType: "rating",
    label: "Rating",
    rangeTypes: { min: "ratingMin", max: "ratingMax" },
  },
  {
    kind: "date-range",
    filterType: "date",
    label: "Date",
    rangeTypes: { min: "dateFrom", max: "dateTo" },
  },
  {
    kind: "enum",
    filterType: "duration",
    label: "Duration",
    encode: (value) => {
      // Custom encoder: translate preset id into min/max seconds.
      // Verified by the test rather than asserted shape here.
      const v = Array.isArray(value) ? value[0] : value;
      const map: Record<string, { durationMin?: number; durationMax?: number }> = {
        lt300: { durationMax: 300 },
        "300-900": { durationMin: 300, durationMax: 900 },
      };
      Object.assign(value === v && map[v] ? map[v] : {});
    },
  },
];

const base: SurfacePrefs<F> = {
  viewMode: "grid",
  sortBy: "recent",
  sortDir: "desc",
  search: "",
  activeFilters: [],
};

describe("encodeSurfacePrefs", () => {
  it("emits search and sort/order keys", () => {
    const params = encodeSurfacePrefs(
      { ...base, search: "  hello  ", sortBy: "title", sortDir: "asc" },
      { filterSections: sections },
    );
    expect(params).toMatchObject({
      search: "hello",
      sort: "title",
      order: "asc",
    });
  });

  it("does not emit search when blank", () => {
    const params = encodeSurfacePrefs({ ...base, search: "   " }, { filterSections: sections });
    expect(params.search).toBeUndefined();
  });

  it("groups multi-select enum filters into an array", () => {
    const params = encodeSurfacePrefs(
      {
        ...base,
        activeFilters: [
          { type: "resolution", label: "Resolution", value: "4K" },
          { type: "resolution", label: "Resolution", value: "1080p" },
        ],
      },
      { filterSections: sections },
    );
    expect(params.resolution).toEqual(["4K", "1080p"]);
  });

  it("emits a single value (not array) for one enum match", () => {
    const params = encodeSurfacePrefs(
      {
        ...base,
        activeFilters: [{ type: "resolution", label: "Resolution", value: "1080p" }],
      },
      { filterSections: sections },
    );
    expect(params.resolution).toBe("1080p");
  });

  it("encodes rating range filters as numeric min/max", () => {
    const params = encodeSurfacePrefs(
      {
        ...base,
        activeFilters: [
          { type: "ratingMin", label: "Min rating", value: "3" },
          { type: "ratingMax", label: "Max rating", value: "5" },
        ],
      },
      { filterSections: sections },
    );
    expect(params.ratingMin).toBe(3);
    expect(params.ratingMax).toBe(5);
  });

  it("encodes date-range filters under their bracket type names", () => {
    const params = encodeSurfacePrefs(
      {
        ...base,
        activeFilters: [
          { type: "dateFrom", label: "Date from", value: "2025-01-01" },
          { type: "dateTo", label: "Date to", value: "2025-12-31" },
        ],
      },
      { filterSections: sections },
    );
    expect(params.dateFrom).toBe("2025-01-01");
    expect(params.dateTo).toBe("2025-12-31");
  });

  it("merges base params before filter encoding", () => {
    const params = encodeSurfacePrefs(base, {
      filterSections: sections,
      base: { nsfw: "include" },
    });
    expect(params.nsfw).toBe("include");
  });

  it("falls back to a literal type key for unknown filter types", () => {
    const params = encodeSurfacePrefs(
      {
        ...base,
        activeFilters: [
          { type: "unknownType" as F, label: "x", value: "y" },
        ],
      },
      { filterSections: sections },
    );
    expect(params.unknownType).toBe("y");
  });
});
