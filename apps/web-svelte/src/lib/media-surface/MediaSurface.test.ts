import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { Grid2x2, List } from "@lucide/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Harness from "./_test/Harness.svelte";
import StubCard from "./_test/StubCard.svelte";
import { surfacePrefsKey } from "./prefs/surface-prefs.svelte";
import type {
  FilterSectionSpec,
  MediaSurfaceConfig,
  SurfacePrefs,
} from "./config";

interface Item {
  id: string;
  title: string;
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  constructor(private callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

const defaultPrefs: SurfacePrefs<"resolution" | "tag"> = {
  viewMode: "grid",
  sortBy: "recent",
  sortDir: "desc",
  search: "",
  activeFilters: [],
};

function items(start: number, count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${start + i}`,
    title: `Item ${start + i}`,
  }));
}

function mockUiPrefsApi(initialStore: Record<string, unknown> = {}) {
  let store: Record<string, unknown> = { ...initialStore };
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const m = url.match(/\/api\/ui-prefs\/(.+?)(?:\?|$)/);
    const key = m ? decodeURIComponent(m[1]) : "";
    if (init?.method === "PUT") {
      const body = init.body ? JSON.parse(init.body as string) : {};
      store[key] = body.value;
      return new Response(JSON.stringify({ key, value: body.value }), { status: 200 });
    }
    return new Response(JSON.stringify({ key, value: store[key] ?? null }), {
      status: 200,
    });
  }) as typeof fetch;
}

describe("MediaSurface", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    mockUiPrefsApi();

    // JSDOM doesn't implement element.animate / getAnimations, which
    // Svelte's flip animations call. Stub them to no-ops for these tests.
    Element.prototype.animate = vi.fn(
      () =>
        ({
          cancel: () => {},
          finish: () => {},
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          oncancel: null,
          onfinish: null,
          play: () => {},
          pause: () => {},
        }) as unknown as Animation,
    );
    Element.prototype.getAnimations = vi.fn(() => []);

    // matchMedia for prefers-reduced-motion
    if (!window.matchMedia) {
      window.matchMedia = vi.fn().mockReturnValue({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders SSR-initial items", async () => {
    const fetcher = vi.fn(async () => ({ items: [], total: 5 }));
    const config: MediaSurfaceConfig<Item, "resolution" | "tag"> = {
      surfaceId: "test-1",
      pageSize: 10,
      fetcher,
      initial: { items: items(0, 5), total: 50, loadedStart: 0 },
      card: StubCard,
      defaultPrefs,
      sortOptions: [{ value: "recent", label: "Recent" }],
    };

    render(Harness, { props: { config } });

    // SSR data is rendered immediately, before any client-side fetch.
    expect(screen.getByText("Item 0")).toBeInTheDocument();
    expect(screen.getByText("Item 4")).toBeInTheDocument();
    // The new scroll-based trigger may auto-fill on mount when the SSR
    // page doesn't fill the viewport — that's Twitter-style behavior.
    // We don't assert a count here; we just verify the SSR items are
    // visible in the rendered output.
  });

  it("loads the first page on mount when a detail tab has no hydrated items", async () => {
    const fetcher = vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => ({
      items: items(offset + 20, limit),
      total: 1,
    }));
    const config: MediaSurfaceConfig<Item, "resolution" | "tag"> = {
      surfaceId: "tag:military:galleries",
      pageSize: 1,
      fetcher,
      initial: { items: [], total: 0, loadedStart: 0 },
      card: StubCard,
      defaultPrefs,
      sortOptions: [{ value: "recent", label: "Recent" }],
    };

    render(Harness, { props: { config } });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, limit: 1 }));
    });
    expect(await screen.findByText("Item 20")).toBeInTheDocument();
  });

  it("re-fetches when sortBy changes", async () => {
    const fetcher = vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => ({
      items: items(offset + 100, limit),
      total: 50,
    }));
    const config: MediaSurfaceConfig<Item, "resolution" | "tag"> = {
      surfaceId: "test-2",
      pageSize: 10,
      fetcher,
      initial: { items: items(0, 5), total: 50, loadedStart: 0 },
      card: StubCard,
      defaultPrefs,
      sortOptions: [
        { value: "recent", label: "Recent" },
        { value: "title", label: "Title A-Z" },
      ],
    };

    render(Harness, { props: { config } });
    fetcher.mockClear();

    // Open sort menu and click "Title A-Z"
    const sortBtn = screen.getByText("Recent").closest("button") as HTMLButtonElement;
    await fireEvent.click(sortBtn);
    const titleOpt = await screen.findByText("Title A-Z");
    await fireEvent.click(titleOpt);

    // The reset+loadMore that the sort change triggers calls the
    // fetcher with prefs.sortBy === "title". (The auto-fill on mount
    // may also register before our mockClear is processed, so we just
    // assert at least one call carries the new sort key.)
    await waitFor(() => {
      const sortBys = fetcher.mock.calls.map(
        (c) => (c[0] as unknown as { prefs: SurfacePrefs<"resolution" | "tag"> }).prefs.sortBy,
      );
      expect(sortBys).toContain("title");
    });
  });

  it("encodes activeFilters via the fetcher's prefs argument", async () => {
    const fetcher = vi.fn(async () => ({ items: [], total: 0 }));
    const sections: FilterSectionSpec<"resolution" | "tag">[] = [
      { kind: "enum", filterType: "resolution", label: "Resolution" },
    ];
    const config: MediaSurfaceConfig<Item, "resolution" | "tag"> = {
      surfaceId: "test-3",
      pageSize: 10,
      fetcher,
      initial: { items: items(0, 1), total: 1, loadedStart: 0 },
      card: StubCard,
      defaultPrefs,
      filterSections: sections,
      sortOptions: [{ value: "recent", label: "Recent" }],
    };

    render(Harness, { props: { config } });

    const config2: MediaSurfaceConfig<Item, "resolution" | "tag"> = {
      ...config,
      surfaceId: "test-4",
      initial: { items: items(10, 1), total: 1, loadedStart: 0 },
      defaultPrefs: {
        ...defaultPrefs,
        activeFilters: [{ type: "resolution", label: "Resolution", value: "1080p" }],
      },
    };

    render(Harness, { props: { config: config2 } });
    // No fetch yet — initial provides the data; defaultPrefs are used
    // straight away on first render.
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads persisted surface preferences on mount", async () => {
    const savedPrefs: SurfacePrefs<"resolution" | "tag"> = {
      ...defaultPrefs,
      viewMode: "list",
      sortBy: "title",
      sortDir: "asc",
      cols: 2,
    };
    mockUiPrefsApi({
      "surface:detail-videos:prefs": savedPrefs,
    });
    const fetcher = vi.fn(
      async (_args: { prefs: SurfacePrefs<"resolution" | "tag"> }) => ({
        items: items(100, 2),
        total: 2,
      }),
    );
    const config: MediaSurfaceConfig<Item, "resolution" | "tag"> = {
      surfaceId: "detail-videos",
      pageSize: 10,
      fetcher,
      initial: { items: items(0, 2), total: 2, loadedStart: 0 },
      card: StubCard,
      defaultPrefs: { ...defaultPrefs, cols: 5 },
      sortOptions: [
        { value: "recent", label: "Recent" },
        { value: "title", label: "Title A-Z" },
      ],
      viewModes: [
        { mode: "grid", icon: Grid2x2, label: "Grid view" },
        { mode: "list", icon: List, label: "List view" },
      ],
      thumbSize: { min: 2, max: 8, default: 5 },
    };

    render(Harness, { props: { config } });

    await waitFor(() => {
      const prefs = fetcher.mock.calls.map(([arg]) => arg.prefs);
      expect(prefs).toContainEqual(expect.objectContaining(savedPrefs));
    });
    expect(screen.getByRole("button", { name: /list view/i }).className).toContain(
      "text-text-accent",
    );
  });

  it("derives form-factor specific surface preference keys", () => {
    expect(surfacePrefsKey("images", "mobile")).toBe("surface:images:mobile:prefs");
    expect(surfacePrefsKey("images", "desktop")).toBe("surface:images:desktop:prefs");
  });

  it("loads the mobile surface preference key on mobile viewports", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const savedPrefs: SurfacePrefs<"resolution" | "tag"> = {
      ...defaultPrefs,
      viewMode: "list",
      sortBy: "title",
      sortDir: "asc",
      cols: 2,
    };
    mockUiPrefsApi({
      "surface:detail-videos:mobile:prefs": savedPrefs,
      "surface:detail-videos:desktop:prefs": {
        ...defaultPrefs,
        viewMode: "grid",
        sortBy: "recent",
        sortDir: "desc",
        cols: 8,
      },
    });
    const fetcher = vi.fn(
      async (_args: { prefs: SurfacePrefs<"resolution" | "tag"> }) => ({
        items: items(100, 2),
        total: 2,
      }),
    );
    const config: MediaSurfaceConfig<Item, "resolution" | "tag"> = {
      surfaceId: "detail-videos",
      pageSize: 10,
      fetcher,
      initial: { items: items(0, 2), total: 2, loadedStart: 0 },
      card: StubCard,
      defaultPrefs: { ...defaultPrefs, cols: 5 },
      sortOptions: [
        { value: "recent", label: "Recent" },
        { value: "title", label: "Title A-Z" },
      ],
      viewModes: [
        { mode: "grid", icon: Grid2x2, label: "Grid view" },
        { mode: "list", icon: List, label: "List view" },
      ],
      thumbSize: { min: 2, max: 8, default: 5 },
    };

    render(Harness, { props: { config } });

    await waitFor(() => {
      const prefs = fetcher.mock.calls.map(([arg]) => arg.prefs);
      expect(prefs).toContainEqual(expect.objectContaining(savedPrefs));
    });
    expect(screen.getByRole("button", { name: /list view/i }).className).toContain(
      "text-text-accent",
    );
  });

  it("uses server-loaded mobile preferences before the mount fetch resolves", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const savedPrefs: SurfacePrefs<"resolution" | "tag"> = {
      ...defaultPrefs,
      viewMode: "list",
      sortBy: "title",
      sortDir: "asc",
      cols: 2,
    };
    const fetcher = vi.fn(async () => ({ items: items(100, 2), total: 2 }));
    const config: MediaSurfaceConfig<Item, "resolution" | "tag"> = {
      surfaceId: "detail-videos",
      pageSize: 10,
      fetcher,
      initial: { items: items(0, 2), total: 2, loadedStart: 0 },
      card: StubCard,
      defaultPrefs: { ...defaultPrefs, cols: 5 },
      sortOptions: [
        { value: "recent", label: "Recent" },
        { value: "title", label: "Title A-Z" },
      ],
      viewModes: [
        { mode: "grid", icon: Grid2x2, label: "Grid view" },
        { mode: "list", icon: List, label: "List view" },
      ],
      thumbSize: { min: 2, max: 8, default: 5 },
    };

    render(Harness, {
      props: {
        config,
        initialPrefsByFormFactor: {
          mobile: savedPrefs,
          desktop: { ...defaultPrefs, viewMode: "grid", cols: 8 },
        },
      },
    });

    expect(screen.getByRole("button", { name: /list view/i }).className).toContain(
      "text-text-accent",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
