import { describe, expect, it } from "vitest";
import { isModShiftZ } from "./nsfw-hotkey";

describe("isModShiftZ", () => {
  it("matches cmd/ctrl + shift + z without alt", () => {
    expect(
      isModShiftZ(
        new KeyboardEvent("keydown", {
          ctrlKey: true,
          shiftKey: true,
          code: "KeyZ",
        }),
      ),
    ).toBe(true);
    expect(
      isModShiftZ(
        new KeyboardEvent("keydown", {
          metaKey: true,
          shiftKey: true,
          key: "z",
        }),
      ),
    ).toBe(true);
  });

  it("rejects incomplete or conflicting modifiers", () => {
    expect(
      isModShiftZ(
        new KeyboardEvent("keydown", {
          ctrlKey: true,
          code: "KeyZ",
        }),
      ),
    ).toBe(false);
    expect(
      isModShiftZ(
        new KeyboardEvent("keydown", {
          ctrlKey: true,
          shiftKey: true,
          altKey: true,
          code: "KeyZ",
        }),
      ),
    ).toBe(false);
  });
});
