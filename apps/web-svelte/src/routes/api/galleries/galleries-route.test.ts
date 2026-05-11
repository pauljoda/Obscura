import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, listGalleriesRead, createGalleryWrite } = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  listGalleriesRead: vi.fn(),
  createGalleryWrite: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("@obscura/app-core", () => ({
  listGalleriesRead,
  createGalleryWrite,
}));

describe("/api/galleries route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    listGalleriesRead.mockReset();
    listGalleriesRead.mockResolvedValue({ galleries: [], total: 0, limit: 50, offset: 0 });
  });

  it("does not pass retired comic gallery params through to app-core", async () => {
    const { GET } = await import("./+server");
    const url = new URL("http://localhost/api/galleries?comic=false&read=unread");

    await GET({ url } as never);

    expect(listGalleriesRead).toHaveBeenCalledWith(db, {});
  });
});
