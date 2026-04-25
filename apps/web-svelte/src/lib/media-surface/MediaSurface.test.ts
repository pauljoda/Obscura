import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Harness from "./_test/Harness.svelte";
import StubCard from "./_test/StubCard.svelte";
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

function mockUiPrefsApi() {
  let store: Record<string, unknown> = {};
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

  it("renders SSR-initial items without calling the fetcher", async () => {
    const fetcher = vi.fn();
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

    expect(screen.getByText("Item 0")).toBeInTheDocument();
    expect(screen.getByText("Item 4")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
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
    expect(fetcher).not.toHaveBeenCalled();

    // Open sort menu (button is the one labeled with current sort name) and click "Title A-Z"
    const sortBtn = screen.getByText("Recent").closest("button") as HTMLButtonElement;
    await fireEvent.click(sortBtn);
    const titleOpt = await screen.findByText("Title A-Z");
    await fireEvent.click(titleOpt);

    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
        limit: 10,
      }),
    );
    const arg = fetcher.mock.calls[0][0] as unknown as {
      prefs: SurfacePrefs<"resolution" | "tag">;
    };
    expect(arg.prefs.sortBy).toBe("title");
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
});
