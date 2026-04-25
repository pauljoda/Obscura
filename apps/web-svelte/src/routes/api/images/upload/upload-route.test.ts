import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, mapAppCoreErrorToJson, uploadRootImageWrite } = vi.hoisted(
  () => ({
    db: { name: "web-db" },
    getWebDb: vi.fn(),
    mapAppCoreErrorToJson: vi.fn(),
    uploadRootImageWrite: vi.fn(),
  }),
);

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/error-mapper", () => ({
  mapAppCoreErrorToJson,
}));

vi.mock("@obscura/app-core", () => ({
  uploadRootImageWrite,
}));

describe("/api/images/upload route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    mapAppCoreErrorToJson.mockReset();
    uploadRootImageWrite.mockReset();
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

  it("rejects requests without a file", async () => {
    const { POST } = await import("./+server");
    const form = new FormData();
    form.set("libraryRootId", "root-1");

    const response = await POST({
      request: {
        formData: async () => form,
      },
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No file uploaded" });
  });

  it("requires an image library root", async () => {
    const { POST } = await import("./+server");
    const file = createFile("image-bytes", "photo.webp", "image/webp");

    const response = await POST({
      request: {
        formData: async () =>
          ({
            get: () => null,
            getAll: (key: string) => (key === "file" ? [file] : []),
          }) as unknown as FormData,
      },
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "libraryRootId field is required",
    });
    expect(uploadRootImageWrite).not.toHaveBeenCalled();
  });

  it("rejects requests with multiple files", async () => {
    const { POST } = await import("./+server");
    const files = [
      createFile("one", "one.jpg", "image/jpeg"),
      createFile("two", "two.png", "image/png"),
    ];

    const response = await POST({
      request: {
        formData: async () =>
          ({
            get: (key: string) => (key === "libraryRootId" ? "root-1" : null),
            getAll: (key: string) => (key === "file" ? files : []),
          }) as FormData,
      },
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Only one file per upload request is supported",
    });
    expect(uploadRootImageWrite).not.toHaveBeenCalled();
  });

  it("routes flat image uploads to the root image writer", async () => {
    uploadRootImageWrite.mockResolvedValue({
      id: "image-1",
      title: "Photo",
      libraryRootId: "root-1",
    });

    const { POST } = await import("./+server");
    const file = createFile("root-image-bytes", "photo.avif", "image/avif");

    const response = await POST({
      request: {
        formData: async () =>
          ({
            get: (key: string) => (key === "libraryRootId" ? "root-1" : null),
            getAll: (key: string) => (key === "file" ? [file] : []),
          }) as FormData,
      },
    } as never);

    expect(uploadRootImageWrite).toHaveBeenCalledWith(
      db,
      "root-1",
      expect.objectContaining({
        filename: "photo.avif",
        mimetype: "image/avif",
      }),
    );
    const input = uploadRootImageWrite.mock.calls[0]?.[2];
    expect(input?.buffer.toString("utf8")).toBe("root-image-bytes");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "image-1",
      title: "Photo",
      libraryRootId: "root-1",
    });
  });
});
