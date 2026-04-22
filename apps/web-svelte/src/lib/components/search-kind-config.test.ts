import { describe, expect, it } from "vitest";
import { ALL_SEARCH_KINDS, SEARCH_KIND_CONFIG } from "./search-kind-config";

describe("search-kind-config", () => {
  it("covers every exported search kind with a label and href", () => {
    expect(new Set(ALL_SEARCH_KINDS).size).toBe(ALL_SEARCH_KINDS.length);

    for (const kind of ALL_SEARCH_KINDS) {
      expect(SEARCH_KIND_CONFIG[kind]).toBeDefined();
      expect(SEARCH_KIND_CONFIG[kind].label.length).toBeGreaterThan(0);
      expect(SEARCH_KIND_CONFIG[kind].href.startsWith("/")).toBe(true);
    }
  });

  it("preserves Obscura terminology for performer search results", () => {
    expect(SEARCH_KIND_CONFIG.performer.label).toBe("Actors");
  });
});
