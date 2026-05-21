import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityThumbnailCard } from "$lib/entities/entity-thumbnail";
import EntityGrid from "./EntityGrid.svelte";

describe("EntityGrid pagination", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", class {
      observe = vi.fn();
      disconnect = vi.fn();
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the default page instead of every card in a large grid", async () => {
    const cards = Array.from({ length: 4_500 }, (_, index) => card(index));
    let renderedCount = 0;

    const { container } = render(EntityGrid, {
      props: {
        cards,
        onRenderedCountChange: (count) => {
          renderedCount = count;
        },
        prefsKey: undefined,
      },
    });

    await waitFor(() => {
      expect(renderedCount).toBe(250);
      expect(container.querySelectorAll(".entity-thumbnail").length).toBe(250);
      expect(screen.getByText("Page 1 / 18")).toBeInTheDocument();
    });
  });

  it("lets the docked pagination bar choose page size and move pages", async () => {
    const cards = Array.from({ length: 600 }, (_, index) => card(index));
    const { container } = render(EntityGrid, {
      props: {
        cards,
        prefsKey: undefined,
      },
    });

    await fireEvent.change(screen.getByLabelText("Per page"), { target: { value: "100" } });

    await waitFor(() => {
      expect(container.querySelectorAll(".entity-thumbnail").length).toBe(100);
      expect(screen.getByText("Page 1 / 6")).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByLabelText("Next page"));

    await waitFor(() => {
      expect(screen.getByText("101–200")).toBeInTheDocument();
      expect(screen.getByText("Page 2 / 6")).toBeInTheDocument();
    });
  });
});

function card(index: number): EntityThumbnailCard {
  return {
    entity: {
      id: `video-${index}`,
      kind: "video",
      title: `Video ${index.toString().padStart(4, "0")}`,
      parentEntityId: null,
      sortOrder: null,
      relationships: [],
      capabilities: [],
      childrenByKind: [],
    },
    aspectRatio: "video",
    cover: null,
    hover: {
      kind: "none",
    },
  };
}
