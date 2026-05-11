import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, deleteBookCoverWrite, getWebDb, mapAppCoreErrorToJson, uploadBookCoverWrite } =
  vi.hoisted(() => ({
    db: { name: "web-db" },
    deleteBookCoverWrite: vi.fn(),
    getWebDb: vi.fn(),
    mapAppCoreErrorToJson: vi.fn(),
    uploadBookCoverWrite: vi.fn(),
  }));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/error-mapper", () => ({
  mapAppCoreErrorToJson,
}));

vi.mock("@obscura/app-core", () => ({
  deleteBookCoverWrite,
  uploadBookCoverWrite,
}));

describe("/api/books/[id]/cover route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    deleteBookCoverWrite.mockReset();
    mapAppCoreErrorToJson.mockReset();
    uploadBookCoverWrite.mockReset();
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

  it("rejects cover uploads without a file", async () => {
    const { POST } = await import("./upload/+server");

    const response = await POST({
      params: { id: "book-1" },
      request: {
        formData: async () => new FormData(),
      },
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No file uploaded" });
  });

  it("forwards root book cover uploads to app-core", async () => {
    uploadBookCoverWrite.mockResolvedValue({
      ok: true,
      coverImagePath: "/assets/books/book-1/cover",
    });

    const { POST } = await import("./upload/+server");
    const file = createFile("cover-bytes", "cover.jpg", "image/jpeg");

    const response = await POST({
      params: { id: "book-1" },
      request: {
        formData: async () =>
          ({
            get: (key: string) => (key === "file" ? file : null),
          }) as FormData,
      },
    } as never);

    expect(uploadBookCoverWrite).toHaveBeenCalledWith(
      db,
      "book-1",
      expect.any(Buffer),
    );
    const buffer = uploadBookCoverWrite.mock.calls[0]?.[2] as Buffer;
    expect(buffer.toString("utf8")).toBe("cover-bytes");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      coverImagePath: "/assets/books/book-1/cover",
    });
  });

  it("delegates root book cover clearing to app-core", async () => {
    deleteBookCoverWrite.mockResolvedValue({
      ok: true,
      coverImagePath: "/assets/book-pages/page-1/thumb",
    });

    const { DELETE } = await import("./+server");
    const response = await DELETE({
      params: { id: "book-1" },
    } as never);

    expect(deleteBookCoverWrite).toHaveBeenCalledWith(db, "book-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      coverImagePath: "/assets/book-pages/page-1/thumb",
    });
  });
});
