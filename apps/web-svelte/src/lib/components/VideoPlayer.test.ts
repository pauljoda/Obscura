import { render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VideoPlayer from "./VideoPlayer.svelte";
import type { SubtitleAppearance, VideoSubtitleTrackDto } from "@obscura/contracts";

vi.mock("vidstack/player", () => ({}));
vi.mock("vidstack/player/layouts", () => ({}));
vi.mock("vidstack/player/ui", () => ({}));
vi.mock("vidstack", () => ({
  isHLSProvider: () => false,
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

describe("VideoPlayer", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ state: "ready", renditions: [] }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
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

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("renders the Vidstack playback shell with active playback status and quality controls", () => {
    render(VideoPlayer, {
      props: {
        src: "/api/video-stream/video-1/hls2/master.m3u8",
        directSrc: "/api/video-stream/video-1/source",
        defaultPlaybackMode: "hls",
      },
    });

    expect(screen.getByTestId("vidstack-video-player")).toBeInTheDocument();
    expect(screen.getByText("Adaptive HLS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Audio track" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quality menu/ })).toBeInTheDocument();
  });

  it("waits for hls2 readiness before attaching the manifest to Vidstack", async () => {
    let resolveStatus!: (response: Response) => void;
    const statusResponse = new Promise<Response>((resolve) => {
      resolveStatus = resolve;
    });
    vi.mocked(fetch).mockReturnValueOnce(statusResponse);

    render(VideoPlayer, {
      props: {
        src: "/api/video-stream/video-1/hls2/master.m3u8",
        defaultPlaybackMode: "hls",
      },
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/video-stream/video-1/hls2/status",
        expect.objectContaining({ cache: "no-store" }),
      );
    });

    expect(document.querySelector("media-player")).toBeNull();

    resolveStatus(
      new Response(JSON.stringify({ state: "ready", renditions: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(document.querySelector("media-player")?.getAttribute("src")).toBe(
        "/api/video-stream/video-1/hls2/master.m3u8",
      );
    });
  });
});
