import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, serveLegacyHlsAsset } = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  serveLegacyHlsAsset: vi.fn(),
}));

vi.mock("$lib/v1/server/db-v1", () => ({
  getWebDb,
}));

vi.mock("$lib/v1/server/video-stream-v1", () => ({
  serveLegacyHlsAsset,
}));

describe("/api/video-stream/[id]/hls2/[...asset] route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    serveLegacyHlsAsset.mockReset();
    serveLegacyHlsAsset.mockResolvedValue(new Response("#EXTM3U"));
  });

  it("forwards hls2 asset requests to the continuous HLS helper", async () => {
    const { GET } = await import("./[...asset]/+server");

    const response = await GET({
      params: {
        id: "video-1",
        asset: "720p/segment_000.ts",
      },
    } as never);

    expect(getWebDb).toHaveBeenCalled();
    expect(serveLegacyHlsAsset).toHaveBeenCalledWith(
      db,
      "video-1",
      "720p/segment_000.ts",
    );
    expect(await response.text()).toBe("#EXTM3U");
  });
});
