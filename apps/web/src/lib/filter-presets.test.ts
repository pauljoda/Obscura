import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPresets, savePresets } from "./filter-presets";

describe("filter presets", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem(key: string) {
        return storage.has(key) ? storage.get(key)! : null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      clear() {
        storage.clear();
      },
    };
    vi.stubGlobal("localStorage", localStorageMock);
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("stores presets under the videos storage key", () => {
    savePresets([
      {
        id: "preset-1",
        name: "Favorites",
        filters: [],
        sortBy: "recent",
        sortDir: "desc",
      },
    ]);

    expect(window.localStorage.getItem("obscura-videos-filter-presets")).toBe(
      JSON.stringify([
        {
          id: "preset-1",
          name: "Favorites",
          filters: [],
          sortBy: "recent",
          sortDir: "desc",
        },
      ]),
    );
    expect(loadPresets()).toEqual([
      {
        id: "preset-1",
        name: "Favorites",
        filters: [],
        sortBy: "recent",
        sortDir: "desc",
      },
    ]);
  });
});
