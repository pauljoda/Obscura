import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, getStorageStats, settingsRow, rootRows } = vi.hoisted(() => {
  const settingsRow = { id: "settings-1", nsfwLanAutoEnable: true };
  const rootRows = [{ id: "root-1", path: "/media/A" }];

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        limit: vi.fn(async () => [settingsRow]),
        orderBy: vi.fn(async () => rootRows),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [settingsRow]),
      })),
    })),
  };

  return {
    db,
    getWebDb: vi.fn(),
    getStorageStats: vi.fn(),
    settingsRow,
    rootRows,
  };
});

vi.mock("$lib/v1/server/db-v1", () => ({
  getWebDb,
}));

vi.mock("$lib/v1/server/library-storage-v1", () => ({
  getStorageStats,
}));

describe("/api/settings/library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWebDb.mockResolvedValue(db);
    getStorageStats.mockResolvedValue({
      thumbnailsBytes: 1,
      previewsBytes: 2,
      trickplayBytes: 3,
      totalBytes: 6,
    });
  });

  it("returns settings and roots without walking generated storage", async () => {
    const { GET } = await import("./+server");

    const response = await GET({} as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settings: settingsRow,
      roots: rootRows,
    });
    expect(getStorageStats).not.toHaveBeenCalled();
  });
});
