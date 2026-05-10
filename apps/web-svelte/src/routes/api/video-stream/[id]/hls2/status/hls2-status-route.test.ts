import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, serveHlsStatus } = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  serveHlsStatus: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/video-stream", () => ({
  serveHlsStatus,
}));

describe("/api/video-stream/[id]/hls2/status route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    serveHlsStatus.mockReset();
    serveHlsStatus.mockResolvedValue(Response.json({ state: "pending", renditions: [] }));
  });

  it("uses the same continuous HLS status helper as the hls route", async () => {
    const { GET } = await import("./+server");

    const response = await GET({
      params: {
        id: "video-1",
      },
    } as never);

    expect(getWebDb).toHaveBeenCalled();
    expect(serveHlsStatus).toHaveBeenCalledWith(db, "video-1");
    await expect(response.json()).resolves.toEqual({ state: "pending", renditions: [] });
  });
});
