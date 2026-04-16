import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  isVideoFile,
  isImageFile,
  fileNameToTitle,
  normalizeNfoRating,
  getSidecarPaths,
  getSceneVideoGeneratedDiskPaths,
  allSceneVideoGeneratedDiskPaths,
  sceneVideoGeneratedLayoutFromDedicated,
  isAnimatedFormat,
  computePhash,
  runProcess,
} from "./index";

async function hasBinary(name: string): Promise<boolean> {
  try {
    await runProcess("which", [name]);
    return true;
  } catch {
    return false;
  }
}

describe("isVideoFile", () => {
  it("recognizes standard video extensions", () => {
    expect(isVideoFile("/media/scene.mp4")).toBe(true);
    expect(isVideoFile("/media/scene.mkv")).toBe(true);
    expect(isVideoFile("/media/scene.avi")).toBe(true);
    expect(isVideoFile("/media/scene.mov")).toBe(true);
    expect(isVideoFile("/media/scene.webm")).toBe(true);
  });

  it("rejects non-video files", () => {
    expect(isVideoFile("/media/photo.jpg")).toBe(false);
    expect(isVideoFile("/media/doc.txt")).toBe(false);
    expect(isVideoFile("/media/audio.mp3")).toBe(false);
  });

  it("skips generated preview/thumbnail files", () => {
    expect(isVideoFile("/media/scene-preview.mp4")).toBe(false);
    expect(isVideoFile("/media/scene_thumb.mp4")).toBe(false);
    expect(isVideoFile("/media/scene.sprite.mp4")).toBe(false);
    expect(isVideoFile("/media/scene-sample.mkv")).toBe(false);
  });

  it("allows files with preview-like words in the middle", () => {
    expect(isVideoFile("/media/my-preview-video-full.mp4")).toBe(true);
  });
});

describe("isImageFile", () => {
  it("recognizes standard image extensions", () => {
    expect(isImageFile("photo.jpg")).toBe(true);
    expect(isImageFile("photo.jpeg")).toBe(true);
    expect(isImageFile("photo.png")).toBe(true);
    expect(isImageFile("photo.webp")).toBe(true);
    expect(isImageFile("photo.gif")).toBe(true);
  });

  it("also recognizes animated/video gallery formats", () => {
    // isImageFile checks supportedGalleryMediaExtensions which includes animated
    expect(isImageFile("video.mp4")).toBe(true);
    expect(isImageFile("video.webm")).toBe(true);
  });

  it("rejects unsupported formats", () => {
    expect(isImageFile("doc.txt")).toBe(false);
    expect(isImageFile("audio.mp3")).toBe(false);
  });
});

describe("fileNameToTitle", () => {
  it("strips extension and replaces separators", () => {
    expect(fileNameToTitle("/media/my-scene_title.mp4")).toBe("my scene title");
  });

  it("decodes HTML entities", () => {
    expect(fileNameToTitle("/media/tom &amp; jerry.mp4")).toBe("tom & jerry");
  });

  it("collapses whitespace", () => {
    expect(fileNameToTitle("/media/a___b---c...d.mp4")).toBe("a b c d");
  });

  it("trims leading/trailing whitespace", () => {
    expect(fileNameToTitle("/media/  scene  .mkv")).toBe("scene");
  });
});

describe("normalizeNfoRating", () => {
  it("normalizes 0-5 star scale to 0-100", () => {
    expect(normalizeNfoRating(0)).toBe(0);
    expect(normalizeNfoRating(2.5)).toBe(50);
    expect(normalizeNfoRating(5)).toBe(100);
  });

  it("normalizes 0-10 scale to 0-100", () => {
    expect(normalizeNfoRating(7)).toBe(70);
    expect(normalizeNfoRating(10)).toBe(100);
  });

  it("passes through 0-100 scale directly", () => {
    expect(normalizeNfoRating(75)).toBe(75);
    expect(normalizeNfoRating(100)).toBe(100);
  });

  it("returns null for invalid values", () => {
    expect(normalizeNfoRating(-1)).toBeNull();
    expect(normalizeNfoRating(NaN)).toBeNull();
    expect(normalizeNfoRating(Infinity)).toBeNull();
  });

  it("returns null for vote counts (>100)", () => {
    expect(normalizeNfoRating(500)).toBeNull();
    expect(normalizeNfoRating(101)).toBeNull();
  });
});

describe("getSidecarPaths", () => {
  it("generates expected sidecar paths", () => {
    const paths = getSidecarPaths("/media/scene.mp4");
    expect(paths.thumbnail).toBe("/media/scene-thumb.jpg");
    expect(paths.cardThumbnail).toBe("/media/scene-card.jpg");
    expect(paths.preview).toBe("/media/scene-preview.mp4");
    expect(paths.sprite).toBe("/media/scene-sprite.jpg");
    expect(paths.trickplayVtt).toBe("/media/scene-trickplay.vtt");
    expect(paths.nfo).toBe("/media/scene.nfo");
  });

  it("strips original extension for nfo", () => {
    const paths = getSidecarPaths("/media/my-video.mkv");
    expect(paths.nfo).toBe("/media/my-video.nfo");
  });
});

describe("getSceneVideoGeneratedDiskPaths", () => {
  const sceneId = "550e8400-e29b-41d4-a716-446655440000";
  const videoPath = "/media/videos/scene.mp4";

  it("sidecar layout matches getSidecarPaths stems", () => {
    const p = getSceneVideoGeneratedDiskPaths(sceneId, videoPath, "sidecar");
    expect(p.thumb).toBe("/media/videos/scene-thumb.jpg");
    expect(p.card).toBe("/media/videos/scene-card.jpg");
    expect(p.preview).toBe("/media/videos/scene-preview.mp4");
    expect(p.sprite).toBe("/media/videos/scene-sprite.jpg");
    expect(p.trickplay).toBe("/media/videos/scene-trickplay.vtt");
  });

  it("dedicated layout uses cache root scenes/<id>/ and fixed filenames", () => {
    const prev = process.env.OBSCURA_CACHE_DIR;
    process.env.OBSCURA_CACHE_DIR = "/data/cache";
    try {
      const p = getSceneVideoGeneratedDiskPaths(sceneId, videoPath, "dedicated");
      const base = `/data/cache/scenes/${sceneId}`;
      expect(p.thumb).toBe(`${base}/thumbnail.jpg`);
      expect(p.card).toBe(`${base}/card.jpg`);
      expect(p.preview).toBe(`${base}/preview.mp4`);
      expect(p.sprite).toBe(`${base}/sprite.jpg`);
      expect(p.trickplay).toBe(`${base}/trickplay.vtt`);
    } finally {
      if (prev === undefined) delete process.env.OBSCURA_CACHE_DIR;
      else process.env.OBSCURA_CACHE_DIR = prev;
    }
  });

  it("allSceneVideoGeneratedDiskPaths dedupes across layouts", () => {
    const prev = process.env.OBSCURA_CACHE_DIR;
    process.env.OBSCURA_CACHE_DIR = "/c";
    try {
      const all = allSceneVideoGeneratedDiskPaths(sceneId, videoPath);
      expect(all.length).toBe(10);
      expect(new Set(all).size).toBe(10);
    } finally {
      if (prev === undefined) delete process.env.OBSCURA_CACHE_DIR;
      else process.env.OBSCURA_CACHE_DIR = prev;
    }
  });

  it("sceneVideoGeneratedLayoutFromDedicated maps booleans", () => {
    expect(sceneVideoGeneratedLayoutFromDedicated(true)).toBe("dedicated");
    expect(sceneVideoGeneratedLayoutFromDedicated(false)).toBe("sidecar");
  });
});

describe("computePhash", () => {
  it("returns null when duration is zero or negative", async () => {
    // No binary call happens — duration guard short-circuits.
    expect(await computePhash("/nonexistent.mp4", 0)).toBeNull();
    expect(await computePhash("/nonexistent.mp4", -5)).toBeNull();
    expect(await computePhash("/nonexistent.mp4", null)).toBeNull();
    expect(await computePhash("/nonexistent.mp4", undefined)).toBeNull();
  });

  it("returns null with a warning when the helper binary is missing", async () => {
    const prev = process.env.OBSCURA_PHASH_BIN;
    process.env.OBSCURA_PHASH_BIN = "/nonexistent/obscura-phash-missing";
    try {
      const result = await computePhash("/nonexistent.mp4", 10);
      expect(result).toBeNull();
    } finally {
      if (prev === undefined) delete process.env.OBSCURA_PHASH_BIN;
      else process.env.OBSCURA_PHASH_BIN = prev;
    }
  });

  it("produces a 16-char hex hash for a real video and is deterministic", { timeout: 30_000 }, async () => {
    const ffmpegAvailable = await hasBinary("ffmpeg");
    const phashAvailable = await hasBinary("obscura-phash");
    if (!ffmpegAvailable || !phashAvailable) {
      // Skip cleanly when the toolchain isn't installed on this dev machine.
      return;
    }

    const dir = mkdtempSync(path.join(tmpdir(), "obscura-phash-test-"));
    const video = path.join(dir, "test.mp4");
    try {
      await runProcess("ffmpeg", [
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=5:size=320x180:rate=30",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        video,
      ]);

      const first = await computePhash(video, 5);
      const second = await computePhash(video, 5);
      expect(first).not.toBeNull();
      expect(first).toMatch(/^[0-9a-f]{16}$/);
      expect(first).toBe(second);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("isAnimatedFormat", () => {
  it("recognizes animated/video formats by file path", () => {
    expect(isAnimatedFormat("clip.gif")).toBe(true);
    expect(isAnimatedFormat("clip.webm")).toBe(true);
    expect(isAnimatedFormat("clip.mp4")).toBe(true);
  });

  it("rejects static image formats", () => {
    expect(isAnimatedFormat("photo.jpg")).toBe(false);
    expect(isAnimatedFormat("photo.png")).toBe(false);
    expect(isAnimatedFormat("photo.tiff")).toBe(false);
  });
});
