import { describe, expect, it } from "vitest";
import {
  buildTrickplayFfmpegArgs,
  buildTrickplayVtt,
  planTrickplaySheet,
} from "./preview.js";

describe("preview trickplay planning", () => {
  it("builds a single ffmpeg tile command for the whole trickplay sheet", () => {
    const args = buildTrickplayFfmpegArgs({
      filePath: "/media/video.mp4",
      spriteFile: "/cache/video/sprite.jpg",
      frameInterval: 10,
      frameWidth: 160,
      frameHeight: 90,
      gridColumns: 5,
      gridRows: 3,
      jpegQuality: 62,
    });

    expect(args).toContain("/media/video.mp4");
    expect(args).toContain("/cache/video/sprite.jpg");
    expect(args).toContain("-frames:v");
    expect(args).toContain("1");
    expect(args).toContain("-q:v");
    expect(args).toContain("62");
    expect(args).toContain(
      "fps=1/10,scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2,tile=5x3",
    );
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
