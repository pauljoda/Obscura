import { describe, expect, it } from "vitest";
import { scrubIndexFromClientX } from "./gallery-thumbnail-scrub-v1";

describe("gallery-thumbnail-scrub", () => {
  it("maps pointer or touch position to the bounded preview index", () => {
    const bounds = { left: 100, width: 200 };

    expect(scrubIndexFromClientX(90, bounds, 4)).toBe(0);
    expect(scrubIndexFromClientX(100, bounds, 4)).toBe(0);
    expect(scrubIndexFromClientX(199, bounds, 4)).toBe(1);
    expect(scrubIndexFromClientX(299, bounds, 4)).toBe(3);
    expect(scrubIndexFromClientX(320, bounds, 4)).toBe(3);
  });

  it("returns the first preview when there is no usable geometry", () => {
    expect(scrubIndexFromClientX(150, { left: 100, width: 0 }, 4)).toBe(0);
    expect(scrubIndexFromClientX(150, { left: 100, width: 200 }, 0)).toBe(0);
  });
});
