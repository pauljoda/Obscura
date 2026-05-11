import { describe, expect, it, vi } from "vitest";
import { createDbAssetDeps } from "./database-deps";

describe("createDbAssetDeps", () => {
  it("reads only the metadata storage setting needed for asset resolution", async () => {
    const limit = vi.fn(async () => [{ metadataStorageDedicated: false }]);
    const from = vi.fn(() => ({ limit }));
    const select = vi.fn((selection: Record<string, unknown>) => ({
      from,
      selection,
    }));
    const db = { select } as never;

    const dedicated = await createDbAssetDeps(db).getMetadataStorageDedicated();

    expect(dedicated).toBe(false);
    expect(select).toHaveBeenCalledOnce();
    expect(Object.keys(select.mock.calls[0][0])).toEqual([
      "metadataStorageDedicated",
    ]);
  });

  it("returns only the metadata storage setting when creating default settings", async () => {
    const limit = vi.fn(async () => []);
    const from = vi.fn(() => ({ limit }));
    const select = vi.fn((selection: Record<string, unknown>) => ({
      from,
      selection,
    }));
    const returning = vi.fn(async (selection: Record<string, unknown>) => {
      void selection;
      return [{ metadataStorageDedicated: true }];
    });
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const db = { insert, select } as never;

    const dedicated = await createDbAssetDeps(db).getMetadataStorageDedicated();

    expect(dedicated).toBe(true);
    expect(returning).toHaveBeenCalledOnce();
    expect(Object.keys(returning.mock.calls[0][0])).toEqual([
      "metadataStorageDedicated",
    ]);
  });
});
