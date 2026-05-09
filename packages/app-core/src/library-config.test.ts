import { describe, expect, it, vi } from "vitest";
import { loadLibraryConfig } from "./library-config";

describe("loadLibraryConfig", () => {
  it("returns settings and roots in one payload", async () => {
    const payload = await loadLibraryConfig({
      ensureSettings: vi.fn(async () => ({ id: "settings-1", nsfwLanAutoEnable: true })),
      loadRoots: vi.fn(async () => [{ id: "root-1", path: "/media/A" }]),
    });

    expect(payload.settings).toEqual({ id: "settings-1", nsfwLanAutoEnable: true });
    expect(payload.roots).toHaveLength(1);
    expect(payload.roots[0]).toEqual({ id: "root-1", path: "/media/A" });
  });

  it("runs all loaders concurrently", async () => {
    const order: string[] = [];
    await loadLibraryConfig({
      ensureSettings: async () => {
        order.push("settings:start");
        await new Promise((r) => setTimeout(r, 5));
        order.push("settings:end");
        return {};
      },
      loadRoots: async () => {
        order.push("roots:start");
        await new Promise((r) => setTimeout(r, 5));
        order.push("roots:end");
        return [];
      },
    });
    // Both :start events should precede any :end event, proving
    // concurrent execution rather than sequential.
    const firstEndIdx = order.findIndex((o) => o.endsWith(":end"));
    const starts = order.slice(0, firstEndIdx);
    expect(new Set(starts)).toEqual(new Set(["settings:start", "roots:start"]));
  });
});
