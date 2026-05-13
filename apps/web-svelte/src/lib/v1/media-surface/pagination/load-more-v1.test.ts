import { describe, expect, it } from "vitest";
import { mergeUniquePage } from "./load-more-v1";

describe("mergeUniquePage", () => {
  it("appends unique page items and preserves the server total when progress is made", () => {
    const result = mergeUniquePage({
      current: [{ id: "a" }],
      incoming: [{ id: "b" }, { id: "c" }],
      loadedStart: 0,
      total: 10,
    });

    expect(result.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result.total).toBe(10);
    expect(result.added).toBe(2);
  });

  it("marks the loaded window complete when the next page repeats existing items", () => {
    const result = mergeUniquePage({
      current: [{ id: "a" }, { id: "b" }],
      incoming: [{ id: "a" }, { id: "b" }],
      loadedStart: 40,
      total: 100,
    });

    expect(result.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.total).toBe(42);
    expect(result.added).toBe(0);
  });
});
