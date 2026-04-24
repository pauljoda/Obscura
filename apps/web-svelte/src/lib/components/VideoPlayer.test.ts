import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VideoPlayer from "./VideoPlayer.svelte";
import type { SubtitleAppearance, VideoSubtitleTrackDto } from "@obscura/contracts";

const { fetchVideoSubtitleCues } = vi.hoisted(() => ({
  fetchVideoSubtitleCues: vi.fn(),
}));

vi.mock("$lib/api/videos", () => ({
  fetchVideoSubtitleCues,
}));

const subtitleDefaults: {
  autoEnable: boolean;
  preferredLanguages: string;
  appearance: SubtitleAppearance;
} = {
  autoEnable: true,
  preferredLanguages: "en,eng",
  appearance: {
    style: "stylized",
    fontScale: 1,
    positionPercent: 88,
    opacity: 1,
  },
};

function makeTrack(
  id: string,
  language: string,
  videoId = "video-1",
): VideoSubtitleTrackDto {
  return {
    id,
    videoId,
    language,
    label: null,
    format: "vtt",
    source: "embedded",
    sourceFormat: "vtt",
    isDefault: false,
    url: `/api/videos/${videoId}/subtitles/${id}`,
    sourceUrl: null,
    createdAt: "2026-04-23T00:00:00.000Z",
  };
}

describe("VideoPlayer subtitle defaults", () => {
  beforeEach(() => {
    fetchVideoSubtitleCues.mockReset();
    fetchVideoSubtitleCues.mockResolvedValue({ cues: [] });
    window.localStorage?.removeItem?.("obscura:subtitle-appearance");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("auto-selects the preferred subtitle track when unlocked", async () => {
    const onActiveSubtitleTrackIdChange = vi.fn();

    render(VideoPlayer, {
      props: {
        subtitleTracks: [
          makeTrack("track-ja", "ja"),
          makeTrack("track-en", "en"),
        ],
        subtitleDefaults,
        activeSubtitleTrackId: null,
        subtitleChoiceLocked: false,
        onActiveSubtitleTrackIdChange,
      },
    });

    await waitFor(() => {
      expect(onActiveSubtitleTrackIdChange).toHaveBeenCalledWith("track-en");
    });
  });

  it("re-applies defaults for a new video after the parent clears a prior lock", async () => {
    const onActiveSubtitleTrackIdChange = vi.fn();

    const { rerender } = render(VideoPlayer, {
      props: {
        src: "/api/video-stream/video-1/hls2/master.m3u8",
        subtitleTracks: [makeTrack("track-en-1", "en", "video-1")],
        subtitleDefaults,
        activeSubtitleTrackId: null,
        subtitleChoiceLocked: true,
        onActiveSubtitleTrackIdChange,
      },
    });

    await waitFor(() => {
      expect(onActiveSubtitleTrackIdChange).not.toHaveBeenCalled();
    });

    await rerender({
      src: "/api/video-stream/video-2/hls2/master.m3u8",
      subtitleTracks: [makeTrack("track-en-2", "en", "video-2")],
      subtitleDefaults,
      activeSubtitleTrackId: null,
      subtitleChoiceLocked: false,
      onActiveSubtitleTrackIdChange,
    });

    await waitFor(() => {
      expect(onActiveSubtitleTrackIdChange).toHaveBeenCalledWith("track-en-2");
    });
  });

  it("opens the subtitle flyout with viewport-constrained positioning", async () => {
    render(VideoPlayer, {
      props: {
        subtitleTracks: [makeTrack("track-en", "en")],
        activeSubtitleTrackId: null,
        subtitleChoiceLocked: true,
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Subtitles" }));

    const flyout = await screen.findByText("Off");
    const menu = flyout.closest(".player-dropdown");
    expect(menu).toBeInTheDocument();
    expect(menu?.className).toContain("fixed");
    expect(menu).toHaveStyle({
      left: "12px",
      right: "12px",
    });
    expect(menu?.getAttribute("style")).toContain("max-height:");
  });
});
