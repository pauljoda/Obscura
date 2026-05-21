import { describe, expect, it } from "vitest";
import {
  computeContainedScrollHeight,
  shouldContainWheelScroll,
} from "./entity-grid-viewport.svelte";

describe("entity-grid viewport sizing", () => {
  it("fits the scrollable grid into the visible viewport below its actual top edge", () => {
    expect(computeContainedScrollHeight({ top: 430, viewportHeight: 960, bottomPadding: 24 })).toBe("506px");
  });

  it("keeps a usable minimum height when the grid starts low on the page", () => {
    expect(computeContainedScrollHeight({ top: 820, viewportHeight: 960, bottomPadding: 24, minHeight: 280 })).toBe("280px");
  });

  it("contains wheel scroll at the top and bottom of the grid", () => {
    expect(shouldContainWheelScroll({ scrollTop: 0, clientHeight: 400, scrollHeight: 1000, deltaY: -16 })).toBe(true);
    expect(shouldContainWheelScroll({ scrollTop: 600, clientHeight: 400, scrollHeight: 1000, deltaY: 16 })).toBe(true);
    expect(shouldContainWheelScroll({ scrollTop: 240, clientHeight: 400, scrollHeight: 1000, deltaY: 16 })).toBe(false);
  });
});
