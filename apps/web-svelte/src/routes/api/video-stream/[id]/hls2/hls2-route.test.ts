import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, serveVirtualHlsAsset } = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  serveVirtualHlsAsset: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/video-stream", () => ({
  serveVirtualHlsAsset,
}));

describe("/api/video-stream/[id]/hls2/[...asset] route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    serveVirtualHlsAsset.mockReset();
    serveVirtualHlsAsset.mockResolvedValue(new Response("#EXTM3U"));
  });

  it("forwards virtual HLS asset requests to the video-stream helper", async () => {
    const { GET } = await import("./[...asset]/+server");

    const response = await GET({
      params: {
        id: "video-1",
        asset: "v/1080p/seg_00000.ts",
      },
    } as never);

    expect(getWebDb).toHaveBeenCalled();
    expect(serveVirtualHlsAsset).toHaveBeenCalledWith(
      db,
      "video-1",
      "v/1080p/seg_00000.ts",
    );
    expect(await response.text()).toBe("#EXTM3U");
  });
});
