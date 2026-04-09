import { describe, it, expect } from "vitest";
import {
  isVideoFile,
  isImageFile,
  fileNameToTitle,
  normalizeNfoRating,
  getSidecarPaths,
  isAnimatedFormat,
} from "./index";

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
