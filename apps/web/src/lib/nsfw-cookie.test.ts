import { describe, expect, it } from "vitest";
import { parseNsfwModeCookie } from "./nsfw-cookie";

describe("parseNsfwModeCookie", () => {
  it("accepts the supported modes and defaults invalid values to off", () => {
    expect(parseNsfwModeCookie("off")).toBe("off");
    expect(parseNsfwModeCookie("blur")).toBe("blur");
    expect(parseNsfwModeCookie("show")).toBe("show");
    expect(parseNsfwModeCookie("invalid")).toBe("off");
    expect(parseNsfwModeCookie(undefined)).toBe("off");
  });
});
