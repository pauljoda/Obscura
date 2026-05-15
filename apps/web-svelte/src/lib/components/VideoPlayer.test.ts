import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VideoPlayer from "./VideoPlayer.svelte";
import type {
  SubtitleAppearance,
  VideoSubtitleTrack,
} from "$lib/player/subtitle-types";

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
): VideoSubtitleTrack {
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

  it("renders the Vidstack playback shell with active status, settings, and cast controls", async () => {
    render(VideoPlayer, {
      props: {
        src: "/api/video-stream/video-1/hls2/master.m3u8",
        directSrc: "/api/video-stream/video-1/source",
        defaultPlaybackMode: "hls",
      },
    });

    expect(screen.getByTestId("vidstack-video-player")).toBeInTheDocument();
    expect(screen.getByText("Adaptive HLS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cast" })).toBeInTheDocument();
    const settingsButton = screen.getByRole("button", { name: "Player settings" });
    await fireEvent.click(settingsButton);
    expect(screen.getByRole("menu", { name: "Player settings menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quality/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Audio/ })).toBeInTheDocument();

    await fireEvent.click(settingsButton);
    await waitFor(() => {
      expect(screen.queryByRole("menu", { name: "Player settings menu" })).not.toBeInTheDocument();
    });
  });

  it("hides cast controls when the library setting disables them", () => {
    render(VideoPlayer, {
      props: {
        src: "/api/video-stream/video-1/hls2/master.m3u8",
        defaultPlaybackMode: "hls",
        showCastControls: false,
      },
    });

    expect(screen.queryByRole("button", { name: "Cast" })).not.toBeInTheDocument();
  });

  it("shows an unavailable notice when cast has no request target", async () => {
    render(VideoPlayer, {
      props: {
        src: "/api/videos/video-1/hls/master.m3u8",
        defaultPlaybackMode: "hls",
      },
    });

    await waitFor(() => {
      expect(document.querySelector("media-player")).toBeInTheDocument();
    });

    Object.defineProperty(document.querySelector("media-player"), "remoteControl", {
      configurable: true,
      value: {},
    });

    await fireEvent.click(screen.getByRole("button", { name: "Cast" }));

    expect(screen.getByText("Casting is not available for this player.")).toBeInTheDocument();
  });

  it("shows an unavailable notice when Google Cast is not available", async () => {
    const requestGoogleCast = vi.fn();
    render(VideoPlayer, {
      props: {
        src: "/api/videos/video-1/hls/master.m3u8",
        defaultPlaybackMode: "hls",
      },
    });

    await waitFor(() => {
      expect(document.querySelector("media-player")).toBeInTheDocument();
    });

    Object.defineProperty(document.querySelector("media-player"), "remoteControl", {
      configurable: true,
      value: { requestGoogleCast },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Cast" }));

    expect(requestGoogleCast).not.toHaveBeenCalled();
    expect(screen.getByText("Google Cast is not available for this browser.")).toBeInTheDocument();
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

  it("attaches v2 manifests directly because the .NET API has no readiness endpoint", async () => {
    render(VideoPlayer, {
      props: {
        src: "/api/videos/video-1/hls/master.m3u8",
        defaultPlaybackMode: "hls",
      },
    });

    await waitFor(() => {
      expect(document.querySelector("media-player")?.getAttribute("src")).toBe(
        "/api/videos/video-1/hls/master.m3u8",
      );
    });
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/videos/video-1/hls/status",
      expect.anything(),
    );
  });
});
