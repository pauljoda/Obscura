import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, listVideosRead, mapAppCoreErrorToJson } = vi.hoisted(() => ({
  db: { name: "web-db" },
  getWebDb: vi.fn(),
  listVideosRead: vi.fn(),
  mapAppCoreErrorToJson: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/error-mapper", () => ({
  mapAppCoreErrorToJson,
}));

vi.mock("@obscura/app-core", () => ({
  listVideosRead,
}));

describe("/api/videos route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    listVideosRead.mockReset();
    mapAppCoreErrorToJson.mockReset();
  });

  it("passes repeated filters through to app-core", async () => {
    listVideosRead.mockResolvedValue({
      videos: [],
      total: 0,
      limit: 10,
      offset: 5,
    });

    const { GET } = await import("./+server");
    const response = await GET({
      url: new URL(
        "http://test/api/videos?search=demo&limit=10&offset=5&tag=alpha&tag=beta&performer=alice&resolution=1080p&codec=h264&codec=hevc",
      ),
    } as never);

    expect(listVideosRead).toHaveBeenCalledWith(db, {
      search: "demo",
      limit: "10",
      offset: "5",
      tag: ["alpha", "beta"],
      performer: "alice",
      resolution: "1080p",
      codec: ["h264", "hevc"],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      videos: [],
      total: 0,
      limit: 10,
      offset: 5,
    });
  });
});
