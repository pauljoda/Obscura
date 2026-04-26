import { describe, expect, it } from "vitest";
import {
  buildPreviewAssetPatch,
  buildTrickplayAssetPatch,
  buildTrickplayFrameFfmpegArgs,
  buildTrickplayVtt,
  planTrickplaySheet,
  trickplayFrameTimestamp,
  trickplaySharpQuality,
} from "./preview.js";

describe("preview trickplay planning", () => {
  it("builds preview asset paths separately from trickplay paths", () => {
    expect(buildPreviewAssetPatch("video-1")).toMatchObject({
      thumbnailPath: "/assets/videos/video-1/thumb",
      cardThumbnailPath: "/assets/videos/video-1/card",
      previewPath: "/assets/videos/video-1/preview",
    });

    expect(buildTrickplayAssetPatch("video-1")).toMatchObject({
      spritePath: "/assets/videos/video-1/sprite",
      trickplayVttPath: "/assets/videos/video-1/trickplay",
    });
  });

  it("builds an input-seek ffmpeg command for a single trickplay frame", () => {
    const args = buildTrickplayFrameFfmpegArgs({
      filePath: "/media/video.mp4",
      outputFile: "/tmp/frame_00007.jpg",
      timestampSeconds: 75,
      frameWidth: 160,
      frameHeight: 90,
      jpegQuality: 4,
    });

    // -ss must come BEFORE -i so ffmpeg uses the fast input-seek path
    // (jumps to the nearest keyframe via the demuxer index instead of
    // decoding the entire prefix).
    const ssIndex = args.indexOf("-ss");
    const inputIndex = args.indexOf("-i");
    expect(ssIndex).toBeGreaterThanOrEqual(0);
    expect(inputIndex).toBeGreaterThan(ssIndex);

    // -skip_frame nokey makes the decoder discard non-keyframe packets so
    // each spawn decodes exactly one frame (the keyframe at/before -ss).
    // Must be passed BEFORE -i to apply to the input decoder.
    const skipIndex = args.indexOf("-skip_frame");
    expect(skipIndex).toBeGreaterThanOrEqual(0);
    expect(args[skipIndex + 1]).toBe("nokey");
    expect(skipIndex).toBeLessThan(inputIndex);

    expect(args).toContain("/media/video.mp4");
    expect(args).toContain("/tmp/frame_00007.jpg");
    expect(args).toContain("75.000");
    // format=yuvj420p tail is required so the mjpeg encoder accepts
    // full-range YUV sources (HDR, phone video, rendered animation).
    expect(args).toContain(
      "scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2,format=yuvj420p",
    );
    expect(args).toContain("-q:v");
    expect(args).toContain("4");
  });

  it("centers each trickplay sample inside its VTT cue", () => {
    expect(trickplayFrameTimestamp(0, 10)).toBe(5);
    expect(trickplayFrameTimestamp(1, 10)).toBe(15);
    expect(trickplayFrameTimestamp(6, 10)).toBe(65);
  });

  it("maps the 1..31 quality slider onto sharp's 1..100 jpeg scale", () => {
    expect(trickplaySharpQuality(1)).toBe(90);
    expect(trickplaySharpQuality(31)).toBe(60);
    expect(trickplaySharpQuality(0)).toBe(90);
    expect(trickplaySharpQuality(99)).toBe(60);
  });

  it("maps VTT cues onto the planned tile grid", () => {
    const vtt = buildTrickplayVtt({
      assetUrl: "/assets/videos/video-1/sprite",
      frameCount: 7,
      frameInterval: 10,
      frameWidth: 160,
      frameHeight: 90,
      gridColumns: 5,
    });

    expect(vtt).toContain("WEBVTT");
    expect(vtt).toContain("00:00:00.000 --> 00:00:10.000");
    expect(vtt).toContain("/assets/videos/video-1/sprite#xywh=0,0,160,90");
    expect(vtt).toContain("00:01:00.000 --> 00:01:10.000");
    expect(vtt).toContain("/assets/videos/video-1/sprite#xywh=160,90,160,90");
  });

  it("keeps trickplay sheets bounded by raising interval before exploding dimensions", () => {
    const plan = planTrickplaySheet({
      duration: 12 * 60 * 60,
      frameInterval: 3,
      frameWidth: 320,
      frameHeight: 180,
    });

    expect(plan.frameWidth).toBeGreaterThanOrEqual(48);
    expect(plan.frameHeight).toBeGreaterThanOrEqual(27);
    expect(plan.frameCount * plan.frameWidth * plan.frameHeight).toBeLessThanOrEqual(
      24_000_000,
    );
  });
});
