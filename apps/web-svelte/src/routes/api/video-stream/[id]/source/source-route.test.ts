import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, serveVideoSource } = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  serveVideoSource: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/video-stream", () => ({
  serveVideoSource,
}));

describe("/api/video-stream/[id]/source route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    serveVideoSource.mockReset();
    serveVideoSource.mockResolvedValue(new Response("ok"));
  });

  it("forwards range requests to the video-stream helper", async () => {
    const { GET } = await import("./+server");

    const response = await GET({
      params: { id: "video-1" },
      request: new Request("http://localhost/api/video-stream/video-1/source", {
        headers: { range: "bytes=0-99" },
      }),
    } as never);

    expect(getWebDb).toHaveBeenCalled();
    expect(serveVideoSource).toHaveBeenCalledWith(db, "video-1", "bytes=0-99");
    expect(await response.text()).toBe("ok");
  });
});
