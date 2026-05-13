import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InfiniteLoadTrigger from "./InfiniteLoadTriggerV1.svelte";

/**
 * Tests for the scroll-event-based trigger (sveltesnaps pattern).
 *
 * The trigger looks for the nearest scroll container by walking parents
 * for overflow-y:auto/scroll. In tests we mount the component into a
 * stub container that we control: scrollTop and scrollHeight are the
 * knobs we manipulate, and we dispatch a "scroll" event on the
 * container to drive the trigger's check.
 */

let container: HTMLDivElement;
let raf: (cb: FrameRequestCallback) => number;

beforeEach(() => {
  container = document.createElement("div");
  container.style.cssText = "overflow-y: auto; height: 400px;";
  document.body.appendChild(container);
  // Mocked dimensions for a "scrolled to within threshold" state.
  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    value: 400,
  });
  // Default to "not scrolled close enough yet"
  Object.defineProperty(container, "scrollHeight", {
    configurable: true,
    value: 2000,
  });
  Object.defineProperty(container, "scrollTop", {
    configurable: true,
    writable: true,
    value: 0,
  });

  // requestAnimationFrame: invoke synchronously after a microtask so
  // tests don't have to spin event loops.
  raf = (cb: FrameRequestCallback) => {
    queueMicrotask(() => cb(performance.now()));
    return 1;
  };
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function setScroll(top: number) {
  Object.defineProperty(container, "scrollTop", {
    configurable: true,
    writable: true,
    value: top,
  });
  container.dispatchEvent(new Event("scroll"));
}

function setScrollHeight(h: number) {
  Object.defineProperty(container, "scrollHeight", {
    configurable: true,
    value: h,
  });
}

function flush() {
  return new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
}

describe("InfiniteLoadTrigger (scroll-event)", () => {
  it("fires onLoad when the user scrolls within the threshold", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      target: container,
      props: {
        hasMore: true,
        loading: false,
        loadKey: 60,
        nextHref: "/videos?page=2",
        threshold: 500,
        onLoad,
      },
    });
    // Component runs an initial microtask check on mount; let it settle.
    await flush();
    onLoad.mockClear();

    // Scroll near the bottom: scrollTop=1200, scrollHeight=2000, clientHeight=400.
    // remaining = 2000 - 1200 - 400 = 400 < 500 → fire.
    setScroll(1200);
    await flush();

    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("does NOT cascade after a successful load while the user stays put", async () => {
    const onLoad = vi.fn();
    const view = render(InfiniteLoadTrigger, {
      target: container,
      props: {
        hasMore: true,
        loading: false,
        loadKey: 60,
        nextHref: "/videos?page=2",
        threshold: 500,
        onLoad,
      },
    });
    await flush();
    onLoad.mockClear();

    setScroll(1200);
    await flush();
    expect(onLoad).toHaveBeenCalledOnce();

    // Simulate the load completing: items append, scrollHeight grows
    // from 2000 → 4000, scrollTop unchanged at 1200, loading flips
    // false, loadKey advances. The browser does NOT dispatch a scroll
    // event for content changes, so the trigger should stay quiet.
    await view.rerender({
      hasMore: true,
      loading: true,
      loadKey: 60,
      nextHref: "/videos?page=2",
      threshold: 500,
      onLoad,
    });
    setScrollHeight(4000);
    await view.rerender({
      hasMore: true,
      loading: false,
      loadKey: 120,
      nextHref: "/videos?page=3",
      threshold: 500,
      onLoad,
    });
    await flush();

    // remaining = 4000 - 1200 - 400 = 2400 > 500. Even if the trigger
    // re-evaluated, it would not fire — but we want to be sure no
    // synthetic scroll-equivalent fires either.
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("fires the next page when the user resumes scrolling", async () => {
    const onLoad = vi.fn();
    const view = render(InfiniteLoadTrigger, {
      target: container,
      props: {
        hasMore: true,
        loading: false,
        loadKey: 60,
        nextHref: "/videos?page=2",
        threshold: 500,
        onLoad,
      },
    });
    await flush();
    onLoad.mockClear();

    setScroll(1200);
    await flush();
    expect(onLoad).toHaveBeenCalledOnce();

    // Simulate append: scrollHeight grows, scrollTop unchanged, loadKey advances.
    setScrollHeight(4000);
    await view.rerender({
      hasMore: true,
      loading: false,
      loadKey: 120,
      nextHref: "/videos?page=3",
      threshold: 500,
      onLoad,
    });
    await flush();
    expect(onLoad).toHaveBeenCalledOnce();

    // User resumes scrolling, gets close to the new bottom.
    setScroll(3200);
    await flush();
    // remaining = 4000 - 3200 - 400 = 400 < 500 → fire next page.
    expect(onLoad).toHaveBeenCalledTimes(2);
  });

  it("does not fire while loading, even when scrolled within threshold", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      target: container,
      props: {
        hasMore: true,
        loading: true,
        loadKey: 60,
        nextHref: "/videos?page=2",
        threshold: 500,
        onLoad,
      },
    });
    await flush();
    onLoad.mockClear();

    setScroll(1200);
    await flush();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("does not fire while error is set", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      target: container,
      props: {
        hasMore: true,
        loading: false,
        error: "boom",
        loadKey: 60,
        nextHref: "/videos?page=2",
        threshold: 500,
        onLoad,
      },
    });
    await flush();
    onLoad.mockClear();

    setScroll(1200);
    await flush();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("does not fire when hasMore is false", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      target: container,
      props: {
        hasMore: false,
        loading: false,
        loadKey: 60,
        nextHref: "/videos?page=2",
        threshold: 500,
        onLoad,
      },
    });
    await flush();

    setScroll(1200);
    await flush();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it("Try again button calls onLoad even when loadKey is unchanged", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      target: container,
      props: {
        hasMore: true,
        loading: false,
        error: "Network error",
        loadKey: 60,
        nextHref: "/videos?page=2",
        threshold: 500,
        onLoad,
      },
    });
    await flush();

    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("uses the load-more handler for the visible fallback control", async () => {
    const onLoad = vi.fn();
    render(InfiniteLoadTrigger, {
      target: container,
      props: {
        hasMore: true,
        loading: false,
        nextHref: "/videos?page=2",
        label: "Load more videos",
        onLoad,
      },
    });
    await flush();
    onLoad.mockClear();

    await fireEvent.click(screen.getByRole("link", { name: "Load more videos" }));
    expect(onLoad).toHaveBeenCalledOnce();
  });
});

// Avoid the unused-tick import warning while keeping it available for
// future test additions that need component-event flushing.
void tick;
