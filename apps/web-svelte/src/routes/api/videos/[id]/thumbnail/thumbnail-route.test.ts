import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, setCustomVideoThumbnailWrite, resetVideoThumbnailWrite, mapAppCoreErrorToJson } =
  vi.hoisted(() => ({
    db: { name: "web-db" },
    getWebDb: vi.fn(),
    setCustomVideoThumbnailWrite: vi.fn(),
    resetVideoThumbnailWrite: vi.fn(),
    mapAppCoreErrorToJson: vi.fn(),
  }));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/error-mapper", () => ({
  mapAppCoreErrorToJson,
}));

vi.mock("@obscura/app-core", () => ({
  resetVideoThumbnailWrite,
  setCustomVideoThumbnailWrite,
}));

describe("/api/videos/[id]/thumbnail route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    setCustomVideoThumbnailWrite.mockReset();
    resetVideoThumbnailWrite.mockReset();
    mapAppCoreErrorToJson.mockReset();
  });

  function createFile(contents: string, name: string, type: string) {
    const file = new Blob([contents], { type });
    const bytes = new TextEncoder().encode(contents);
    Object.defineProperty(file, "name", { value: name });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    });
    Object.setPrototypeOf(file, File.prototype);
    return file as File;
  }

  it("rejects thumbnail uploads without a file", async () => {
    const { POST } = await import("./+server");

    const response = await POST({
      params: { id: "video-1" },
      request: {
        formData: async () => new FormData(),
      },
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No file uploaded" });
  });

  it("forwards thumbnail buffers to app-core", async () => {
    setCustomVideoThumbnailWrite.mockResolvedValue({
      thumbnailPath: "/assets/videos/video-1/thumb-custom",
    });

    const { POST } = await import("./+server");
    const file = createFile("thumb-bytes", "poster.jpg", "image/jpeg");

    const response = await POST({
      params: { id: "video-1" },
      request: {
        formData: async () =>
          ({
            get: (key: string) => (key === "file" ? file : null),
          }) as FormData,
      },
    } as never);

    expect(setCustomVideoThumbnailWrite).toHaveBeenCalledWith(
      db,
      "video-1",
      expect.any(Buffer),
    );
    const buffer = setCustomVideoThumbnailWrite.mock.calls[0]?.[2] as Buffer;
    expect(buffer.toString("utf8")).toBe("thumb-bytes");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      thumbnailPath: "/assets/videos/video-1/thumb-custom",
    });
  });

  it("delegates thumbnail resets to app-core", async () => {
    resetVideoThumbnailWrite.mockResolvedValue({
      ok: true,
      thumbnailPath: "/assets/videos/video-1/thumb",
    });

    const { DELETE } = await import("./+server");
    const response = await DELETE({
      params: { id: "video-1" },
    } as never);

    expect(resetVideoThumbnailWrite).toHaveBeenCalledWith(db, "video-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      thumbnailPath: "/assets/videos/video-1/thumb",
    });
  });
});
