import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InfiniteLoadTrigger from "./InfiniteLoadTrigger.svelte";

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

describe("InfiniteLoadTrigger", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the load-more handler for the visible fallback control", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      props: {
        hasMore: true,
        loading: false,
        nextHref: "/videos?page=2",
        label: "Load more videos",
        onLoad,
      },
    });

    await fireEvent.click(screen.getByRole("link", { name: "Load more videos" }));

    expect(onLoad).toHaveBeenCalledOnce();
  });
});
