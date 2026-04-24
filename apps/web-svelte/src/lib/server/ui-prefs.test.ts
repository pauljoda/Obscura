import { describe, expect, it } from "vitest";
import { mergeUiPrefObject } from "./ui-prefs";

describe("server ui prefs", () => {
  it("merges saved object values over defaults for first render", () => {
    expect(mergeUiPrefObject({ cols: 5 }, { cols: 9 })).toEqual({ cols: 9 });
  });

  it("falls back to defaults for missing or non-object values", () => {
    expect(mergeUiPrefObject({ cols: 5 }, null)).toEqual({ cols: 5 });
    expect(mergeUiPrefObject({ cols: 5 }, "bad")).toEqual({ cols: 5 });
  });
});
