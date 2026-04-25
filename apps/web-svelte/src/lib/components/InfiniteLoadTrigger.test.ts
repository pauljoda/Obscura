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

  it("does not auto-fire while loading is true", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      props: {
        hasMore: true,
        loading: true,
        loadKey: 60,
        nextHref: "/videos?page=2",
        onLoad,
      },
    });

    observers[0]?.enter();
    await tick();

    expect(onLoad).not.toHaveBeenCalled();
  });

  it("does not auto-fire while error is set", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      props: {
        hasMore: true,
        loading: false,
        error: "boom",
        loadKey: 60,
        nextHref: "/videos?page=2",
        onLoad,
      },
    });

    observers[0]?.enter();
    await tick();

    expect(onLoad).not.toHaveBeenCalled();
  });

  it("does not auto-fire when hasMore is false", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      props: {
        hasMore: false,
        loading: false,
        loadKey: 60,
        nextHref: "/videos?page=2",
        onLoad,
      },
    });

    // When hasMore is false, the component does not render the sentinel,
    // so no observer is attached at all.
    expect(observers.length).toBe(0);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("Try again button calls onLoad even when loadKey is unchanged", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      props: {
        hasMore: true,
        loading: false,
        error: "Network error",
        loadKey: 60,
        nextHref: "/videos?page=2",
        onLoad,
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onLoad).toHaveBeenCalledOnce();
  });
});
