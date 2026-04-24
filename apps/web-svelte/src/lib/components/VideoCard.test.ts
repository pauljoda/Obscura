import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/stores/nsfw.svelte", () => ({
  useNsfw: () => ({ mode: "show" }),
}));

import VideoCard from "./VideoCard.svelte";
import type { VideoCardData } from "$lib/video-card-data";

function buildVideo(overrides: Partial<VideoCardData> = {}): VideoCardData {
  return {
    id: "video-1",
    href: "/videos/video-1",
    title: "Fallback Test Video",
    thumbnail: "/thumb.jpg",
    ...overrides,
  };
}

describe("VideoCard", () => {
  it("falls back to the gradient thumbnail treatment when the image fails to load", async () => {
    const { container } = render(VideoCard, {
      props: {
        video: buildVideo(),
        index: 0,
      },
    });

    await fireEvent.error(screen.getByAltText("Fallback Test Video"));

    expect(screen.queryByAltText("Fallback Test Video")).not.toBeInTheDocument();
    expect(container.querySelector(".gradient-thumb-1")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-film")).toBeInTheDocument();
  });

  it("renders the gradient fallback when no thumbnail is available", () => {
    const { container } = render(VideoCard, {
      props: {
        video: buildVideo({
          thumbnail: undefined,
          cardThumbnail: undefined,
        }),
        index: 2,
      },
    });

    expect(container.querySelector(".gradient-thumb-3")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-film")).toBeInTheDocument();
  });
});
