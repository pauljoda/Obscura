import { describe, expect, it, vi, afterEach } from "vitest";
import {
  detectUiPrefsFormFactor,
  formFactorUiPrefKey,
} from "./form-factor-prefs";

describe("form-factor prefs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives mobile and desktop preference keys from a base key", () => {
    expect(formFactorUiPrefKey("series:view", "mobile")).toBe("series:view:mobile");
    expect(formFactorUiPrefKey("series:view", "desktop")).toBe("series:view:desktop");
  });

  it("detects mobile from the shared media query", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    );

    expect(detectUiPrefsFormFactor()).toBe("mobile");
  });
});
