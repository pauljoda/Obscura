import { render, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssSubtitleOverlay from "./AssSubtitleOverlay.svelte";

const { fetchVideoSubtitleSource, jassubCtor, destroy, loadJassub } = vi.hoisted(() => {
  const destroy = vi.fn();
  const jassubCtor = vi.fn(function MockJassub() {
    return { destroy };
  });
  return {
    fetchVideoSubtitleSource: vi.fn(),
    jassubCtor,
    destroy,
    loadJassub: vi.fn(),
  };
});

vi.mock("$lib/api/videos", () => ({
  fetchVideoSubtitleSource,
}));

vi.mock("$lib/vendor/load-jassub", () => ({
  loadJassub,
}));

describe("AssSubtitleOverlay", () => {
  beforeEach(() => {
    fetchVideoSubtitleSource.mockReset();
    fetchVideoSubtitleSource.mockResolvedValue("[Script Info]\nTitle: Test");
    jassubCtor.mockClear();
    destroy.mockClear();
    loadJassub.mockReset();
    loadJassub.mockResolvedValue(jassubCtor);
  });

  it("boots once the video element becomes available after initial render", async () => {
    const { rerender } = render(AssSubtitleOverlay, {
      props: {
        videoEl: null,
        videoId: "video-1",
        trackId: "track-1",
      },
    });

    expect(jassubCtor).not.toHaveBeenCalled();

    const wrapper = document.createElement("div");
    const video = document.createElement("video");
    wrapper.append(video);
    document.body.append(wrapper);

    await rerender({
      videoEl: video,
      videoId: "video-1",
      trackId: "track-1",
    });

    await waitFor(() => {
      expect(fetchVideoSubtitleSource).toHaveBeenCalledWith("video-1", "track-1");
      expect(jassubCtor).toHaveBeenCalledTimes(1);
    });

    expect(jassubCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        video,
        workerUrl: "/jassub/jassub-worker.js",
        wasmUrl: "/jassub/jassub-worker.wasm",
      }),
    );
  });
});
