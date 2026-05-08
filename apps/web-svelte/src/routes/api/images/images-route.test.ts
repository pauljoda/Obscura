import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, listImagesRead } = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  listImagesRead: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("@obscura/app-core", () => ({
  listImagesRead,
}));

describe("/api/images route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    listImagesRead.mockReset();
    listImagesRead.mockResolvedValue({ images: [], total: 0, limit: 80, offset: 0 });
  });

  it("passes image-specific filter params through to app-core", async () => {
    const { GET } = await import("./+server");
    const url = new URL(
      "http://localhost/api/images?format=jpg&format=png&animated=true&dimension=landscape&dimension=hd",
    );

    await GET({ url } as never);

    expect(listImagesRead).toHaveBeenCalledWith(db, {
      animated: "true",
      format: ["jpg", "png"],
      dimension: ["landscape", "hd"],
    });
  });

  it("passes gallery scoped natural sorting params through to app-core", async () => {
    const { GET } = await import("./+server");
    const url = new URL(
      "http://localhost/api/images?gallery=gallery-1&sort=natural&order=asc",
    );

    await GET({ url } as never);

    expect(listImagesRead).toHaveBeenCalledWith(db, {
      gallery: "gallery-1",
      sort: "natural",
      order: "asc",
    });
  });

  it("passes comic filter params through to app-core", async () => {
    const { GET } = await import("./+server");
    const url = new URL("http://localhost/api/images?comic=true");

    await GET({ url } as never);

    expect(listImagesRead).toHaveBeenCalledWith(db, {
      comic: "true",
    });
  });
});
