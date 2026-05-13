import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@obscura/app-core";

const { db, getWebDb, getVideoDetailRead, updateVideoWrite, deleteVideoWrite } =
  vi.hoisted(() => ({
    db: { name: "web-db" },
    getWebDb: vi.fn(),
    getVideoDetailRead: vi.fn(),
    updateVideoWrite: vi.fn(),
    deleteVideoWrite: vi.fn(),
  }));

vi.mock("$lib/v1/server/db-v1", () => ({
  getWebDb,
}));

vi.mock("@obscura/app-core", async () => {
  const actual = await vi.importActual<typeof import("@obscura/app-core")>(
    "@obscura/app-core",
  );
  return {
    ...actual,
    getVideoDetailRead,
    updateVideoWrite,
    deleteVideoWrite,
  };
});

describe("/api/videos/[id] route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    getVideoDetailRead.mockReset();
    updateVideoWrite.mockReset();
    deleteVideoWrite.mockReset();
  });

  it("maps shared not-found errors to the standard error JSON body", async () => {
    getVideoDetailRead.mockRejectedValue(new NotFoundError("Video not found"));

    const { GET } = await import("./+server");
    const response = await GET({
      params: { id: "video-1" },
    } as never);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Video not found" });
  });

  it("forwards patch bodies to app-core", async () => {
    updateVideoWrite.mockResolvedValue({ ok: true, id: "video-1" });

    const { PATCH } = await import("./+server");
    const response = await PATCH({
      params: { id: "video-1" },
      request: new Request("http://test/api/videos/video-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Renamed",
          performerNames: ["Alice", "Bob"],
        }),
      }),
    } as never);

    expect(updateVideoWrite).toHaveBeenCalledWith(db, "video-1", {
      title: "Renamed",
      performerNames: ["Alice", "Bob"],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: "video-1" });
  });

  it("parses the deleteFile query flag for deletes", async () => {
    deleteVideoWrite.mockResolvedValue({ ok: true });

    const { DELETE } = await import("./+server");
    const response = await DELETE({
      params: { id: "video-1" },
      url: new URL("http://test/api/videos/video-1?deleteFile=true"),
    } as never);

    expect(deleteVideoWrite).toHaveBeenCalledWith(db, "video-1", true);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
