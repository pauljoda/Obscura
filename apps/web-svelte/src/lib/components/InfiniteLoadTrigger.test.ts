import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InfiniteLoadTrigger from "./InfiniteLoadTrigger.svelte";

const observers: MockIntersectionObserver[] = [];

class MockIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {
    observers.push(this);
  }

  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  enter() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

describe("InfiniteLoadTrigger", () => {
  beforeEach(() => {
    observers.length = 0;
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

  it("only auto-loads once for the same load key while the sentinel remains visible", async () => {
    const onLoad = vi.fn();
    const view = render(InfiniteLoadTrigger, {
      props: {
        hasMore: true,
        loading: false,
        loadKey: 60,
        nextHref: "/videos?page=2",
        onLoad,
      },
    });

    observers[0]?.enter();
    await tick();

    expect(onLoad).toHaveBeenCalledOnce();

    await view.rerender({
      hasMore: true,
      loading: true,
      loadKey: 60,
      nextHref: "/videos?page=2",
      onLoad,
    });
    await view.rerender({
      hasMore: true,
      loading: false,
      loadKey: 60,
      nextHref: "/videos?page=2",
      onLoad,
    });
    await tick();

    expect(onLoad).toHaveBeenCalledOnce();

    await view.rerender({
      hasMore: true,
      loading: false,
      loadKey: 120,
      nextHref: "/videos?page=3",
      onLoad,
    });
    await tick();

    expect(onLoad).toHaveBeenCalledTimes(2);
  });
});
