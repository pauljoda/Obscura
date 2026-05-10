import { describe, expect, it } from "vitest";
import {
  adaptiveAutoLevelSelection,
  canUseDirectPlayback,
  chooseInitialPlaybackMode,
  computeVideoLoadState,
  requestedModeFromQualityMode,
} from "./video-player-load";

describe("video-player-load", () => {
  it("treats every non-direct quality mode as adaptive playback", () => {
    expect(requestedModeFromQualityMode("direct")).toBe("direct");
    expect(requestedModeFromQualityMode("auto")).toBe("hls");
    expect(requestedModeFromQualityMode(0)).toBe("hls");
    expect(requestedModeFromQualityMode("seed:720p")).toBe("hls");
  });

  it("prefers direct playback for a brand-new source when a direct stream exists", () => {
    expect(
      chooseInitialPlaybackMode({
        src: "/api/video-stream/video-1/hls2/master.m3u8",
        directSrc: "/api/video-stream/video-1/source",
        defaultPlaybackMode: "direct",
      }),
    ).toBe("direct");

    const state = computeVideoLoadState({
      src: "/api/video-stream/video-1/hls2/master.m3u8",
      directSrc: "/api/video-stream/video-1/source",
      defaultPlaybackMode: "direct",
      requestedMode: "hls",
      prevSrcKey: "",
    });

    expect(state.isNewSource).toBe(true);
    expect(state.effectiveMode).toBe("direct");
    expect(state.loadKey).toBe(
      "/api/video-stream/video-1/hls2/master.m3u8|/api/video-stream/video-1/source|direct",
    );
  });

  it("requires browser HEVC support before direct-playing HEVC sources", () => {
    const unsupported = canUseDirectPlayback({
      directSrc: "/api/video-stream/video-1/source",
      codec: "HEVC",
      canPlayType: () => "",
    });

    const supported = canUseDirectPlayback({
      directSrc: "/api/video-stream/video-1/source",
      codec: "h265",
      canPlayType: (mime) => (mime.includes("hvc1") ? "probably" : ""),
    });

    expect(unsupported).toBe(false);
    expect(supported).toBe(true);
  });

  it("starts HEVC sources in adaptive mode when direct playback is unsupported", () => {
    const state = computeVideoLoadState({
      src: "/api/video-stream/video-1/hls2/master.m3u8",
      directSrc: "/api/video-stream/video-1/source",
      defaultPlaybackMode: "direct",
      directPlayable: false,
      requestedMode: "direct",
      prevSrcKey: "",
    });

    expect(state.isNewSource).toBe(true);
    expect(state.effectiveMode).toBe("hls");
    expect(state.loadKey).toBe(
      "/api/video-stream/video-1/hls2/master.m3u8|/api/video-stream/video-1/source|hls",
    );
  });

  it("switches the load key when the same source falls back from direct to hls", () => {
    const direct = computeVideoLoadState({
      src: "/api/video-stream/video-1/hls2/master.m3u8",
      directSrc: "/api/video-stream/video-1/source",
      defaultPlaybackMode: "direct",
      requestedMode: "direct",
      prevSrcKey: "",
    });

    const adaptive = computeVideoLoadState({
      src: "/api/video-stream/video-1/hls2/master.m3u8",
      directSrc: "/api/video-stream/video-1/source",
      defaultPlaybackMode: "direct",
      requestedMode: "hls",
      prevSrcKey: direct.srcKey,
    });

    expect(adaptive.isNewSource).toBe(false);
    expect(adaptive.effectiveMode).toBe("hls");
    expect(adaptive.loadKey).not.toBe(direct.loadKey);
  });

  it("keeps the same load key while changing adaptive quality levels", () => {
    const auto = computeVideoLoadState({
      src: "/api/video-stream/video-1/hls2/master.m3u8",
      directSrc: "/api/video-stream/video-1/source",
      defaultPlaybackMode: "direct",
      requestedMode: requestedModeFromQualityMode("auto"),
      prevSrcKey: "/api/video-stream/video-1/hls2/master.m3u8|/api/video-stream/video-1/source",
    });

    const seeded = computeVideoLoadState({
      src: "/api/video-stream/video-1/hls2/master.m3u8",
      directSrc: "/api/video-stream/video-1/source",
      defaultPlaybackMode: "direct",
      requestedMode: requestedModeFromQualityMode("seed:720p"),
      prevSrcKey: auto.srcKey,
    });

    expect(seeded.loadKey).toBe(auto.loadKey);
    expect(seeded.effectiveMode).toBe("hls");
  });

  it("leaves automatic adaptive startup to hls.js instead of forcing the top level", () => {
    expect(adaptiveAutoLevelSelection()).toEqual({
      currentLevel: -1,
      startLevel: -1,
      nextAutoLevel: -1,
    });
  });
});
