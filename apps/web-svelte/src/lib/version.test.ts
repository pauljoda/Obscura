import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { APP_VERSION } from "./version";

describe("APP_VERSION", () => {
  it("matches the web package version", () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });
});
