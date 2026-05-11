import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkForReleaseUpdate } = vi.hoisted(() => ({
  checkForReleaseUpdate: vi.fn(),
}));

vi.mock("@obscura/app-core", () => ({
  checkForReleaseUpdate,
}));

describe("/api/update-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkForReleaseUpdate.mockResolvedValue({
      status: "available",
      localVersion: "0.22.1-dev",
      latestVersion: "0.23.0",
      latestUrl: "https://github.com/pauljoda/Obscura/releases/tag/v0.23.0",
      updateAvailable: true,
      checkedAt: "2026-05-11T12:00:00.000Z",
      fromCache: false,
    });
  });

  it("returns release update status as JSON", async () => {
    const { GET } = await import("./+server");

    const response = await GET({ url: new URL("http://test/api/update-check") } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "available", updateAvailable: true });
    expect(checkForReleaseUpdate).toHaveBeenCalledWith({
      localVersion: "0.22.1-dev",
      force: false,
    });
  });

  it("passes force through for manual refresh", async () => {
    const { GET } = await import("./+server");

    await GET({ url: new URL("http://test/api/update-check?force=1") } as never);

    expect(checkForReleaseUpdate).toHaveBeenCalledWith({
      localVersion: "0.22.1-dev",
      force: true,
    });
  });
});
