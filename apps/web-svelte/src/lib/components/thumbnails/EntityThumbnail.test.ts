import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EntityThumbnail from "./EntityThumbnail.svelte";
import type { EntityThumbnailCard } from "$lib/entities/entity-thumbnail";

const loadTrickplayFrames = vi.fn();

vi.mock("@obscura/ui-svelte", () => ({
  loadTrickplayFrames: (...args: unknown[]) => loadTrickplayFrames(...args),
}));

describe("EntityThumbnail", () => {
  beforeEach(() => {
    loadTrickplayFrames.mockResolvedValue([
      { start: 0, end: 10, x: 0, y: 0, width: 160, height: 90, url: "/Videos/1/Trickplay/280/0.jpg" },
    ]);
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", class {
      observe = vi.fn();
      disconnect = vi.fn();
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the first sprite frame as soon as a trickplay thumbnail is hovered", async () => {
    const { container } = render(EntityThumbnail, {
      props: {
        card: spriteCard(),
      },
    });
    const media = container.querySelector(".media") as HTMLElement;
    Object.defineProperty(media, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });

    await fireEvent(media, pointerEvent("pointerenter", 50));

    await waitFor(() => {
      expect(loadTrickplayFrames).toHaveBeenCalledWith("/Videos/1/Trickplay/280/tiles.m3u8");
      expect(container.querySelector(".sprite-overlay")).not.toBeNull();
    });
  });
});

function spriteCard(): EntityThumbnailCard {
  return {
    entity: {
      id: "video-1",
      kind: "video",
      title: "Video",
      capabilities: [],
    },
    aspectRatio: "video",
    cover: {
      alt: "Video cover",
      src: "/assets/videos/1/thumb.jpg",
    },
    hover: {
      kind: "sprite",
      vttUrl: "/Videos/1/Trickplay/280/tiles.m3u8",
    },
  };
}

function pointerEvent(type: string, clientX: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: clientX });
  return event;
}
