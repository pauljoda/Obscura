import { describe, expect, it, vi } from "vitest";
import {
  ignoreMediaFilePath,
  listIgnoredMediaPathsUnderRoot,
} from "./media-file-ignores";

function undefinedTableError() {
  return Object.assign(new Error('relation "media_file_ignores" does not exist'), {
    code: "42P01",
  });
}

describe("media file ignores", () => {
  it("treats a missing ignore table as an empty list during scans", async () => {
    const db = {
      select: vi.fn(() => ({
        from: () => ({
          where: async () => {
            throw undefinedTableError();
          },
        }),
      })),
    };

    await expect(
      listIgnoredMediaPathsUnderRoot(db as never, "/media/root"),
    ).resolves.toEqual(new Set());
  });

  it("does not fail library-only deletes before the ignore table exists", async () => {
    const db = {
      insert: vi.fn(() => ({
        values: () => ({
          onConflictDoNothing: async () => {
            throw undefinedTableError();
          },
        }),
      })),
    };

    await expect(
      ignoreMediaFilePath(db as never, {
        path: "/media/root/photo.jpg",
        entityType: "image",
      }),
    ).resolves.toBeUndefined();
  });

  it("still surfaces unexpected ignore query errors", async () => {
    const db = {
      select: vi.fn(() => ({
        from: () => ({
          where: async () => {
            throw Object.assign(new Error("database unavailable"), {
              code: "57P01",
            });
          },
        }),
      })),
    };

    await expect(
      listIgnoredMediaPathsUnderRoot(db as never, "/media/root"),
    ).rejects.toThrow("database unavailable");
  });
});
