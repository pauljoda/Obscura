import { describe, expect, it } from "vitest";
import { filterIdentifyQueueItems } from "./identify-queue";

describe("filterIdentifyQueueItems", () => {
  const items = [
    { id: "needs-work", organized: false },
    { id: "already-done", organized: true },
    { id: "legacy" },
  ];

  it("hides organized items by default", () => {
    expect(filterIdentifyQueueItems(items, false).map((item) => item.id)).toEqual([
      "needs-work",
      "legacy",
    ]);
  });

  it("keeps organized items when show-all is enabled", () => {
    expect(filterIdentifyQueueItems(items, true).map((item) => item.id)).toEqual([
      "needs-work",
      "already-done",
      "legacy",
    ]);
  });
});
