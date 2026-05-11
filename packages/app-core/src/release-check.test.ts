import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkForReleaseUpdate,
  compareReleaseVersions,
  createReleaseUpdateChecker,
  normalizeReleaseVersion,
} from "./release-check";

describe("release version comparison", () => {
  it("normalizes tags and local dev versions to semver cores", () => {
    expect(normalizeReleaseVersion("v0.23.0")).toBe("0.23.0");
    expect(normalizeReleaseVersion("0.22.1-dev")).toBe("0.22.1");
    expect(normalizeReleaseVersion("  v1.2.3-beta.1 ")).toBe("1.2.3");
    expect(normalizeReleaseVersion("not-a-version")).toBeNull();
  });

  it("compares newer, equal, and older versions", () => {
    expect(compareReleaseVersions("0.23.0", "0.22.1-dev")).toBeGreaterThan(0);
    expect(compareReleaseVersions("v0.22.1", "0.22.1-dev")).toBe(0);
    expect(compareReleaseVersions("0.22.0", "0.22.1-dev")).toBeLessThan(0);
  });
});

describe("checkForReleaseUpdate", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("reports an available update when GitHub latest is newer", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            tag_name: "v0.23.0",
            html_url: "https://github.com/pauljoda/Obscura/releases/tag/v0.23.0",
          }),
        ),
    );

    const status = await checkForReleaseUpdate({ localVersion: "0.22.1-dev", fetchImpl });

    expect(status).toMatchObject({
      status: "available",
      localVersion: "0.22.1-dev",
      latestVersion: "0.23.0",
      latestUrl: "https://github.com/pauljoda/Obscura/releases/tag/v0.23.0",
      updateAvailable: true,
      fromCache: false,
    });
  });

  it("does not warn when local dev build is ahead", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            tag_name: "v0.22.0",
            html_url: "https://github.com/pauljoda/Obscura/releases/tag/v0.22.0",
          }),
        ),
    );

    const status = await checkForReleaseUpdate({ localVersion: "0.22.1-dev", fetchImpl });

    expect(status.status).toBe("current");
    expect(status.updateAvailable).toBe(false);
  });

  it("returns an unknown status when GitHub cannot be reached", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    const status = await checkForReleaseUpdate({ localVersion: "0.22.1-dev", fetchImpl });

    expect(status.status).toBe("unknown");
    expect(status.updateAvailable).toBe(false);
    expect(status.error).toBe("offline");
  });

  it("caches daily checks and bypasses cache when forced", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tag_name: "v0.23.0", html_url: "https://example.test/1" })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tag_name: "v0.24.0", html_url: "https://example.test/2" })),
      );
    const checker = createReleaseUpdateChecker({
      fetchImpl,
      now: () => new Date("2026-05-11T12:00:00.000Z"),
    });

    const first = await checker({ localVersion: "0.22.1-dev" });
    const cached = await checker({ localVersion: "0.22.1-dev" });
    const forced = await checker({ localVersion: "0.22.1-dev", force: true });

    expect(first.latestVersion).toBe("0.23.0");
    expect(cached.fromCache).toBe(true);
    expect(cached.latestVersion).toBe("0.23.0");
    expect(forced.latestVersion).toBe("0.24.0");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
