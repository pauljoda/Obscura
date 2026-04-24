import { render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImageLightboxHarness from "./ImageLightbox.test-harness.svelte";

const image = {
  id: "image-1",
  title: "Still",
  details: null,
  date: null,
  rating: null,
  organized: false,
  isNsfw: false,
  width: 100,
  height: 100,
  format: "jpg",
  isVideo: false,
  fileSize: 100,
  filePath: "/media/still.jpg",
  thumbnailPath: "/assets/images/image-1/thumb",
  previewPath: null,
  fullPath: "/assets/images/image-1/full",
  galleryId: null,
  sortOrder: 0,
  studioId: null,
  studio: null,
  performers: [],
  tags: [],
  createdAt: "2026-04-24T00:00:00.000Z",
};

const videoImage = {
  ...image,
  id: "image-video-1",
  title: "Animated clip",
  format: "webm",
  isVideo: true,
  thumbnailPath: "/assets/images/image-video-1/thumb",
  previewPath: "/assets/images/image-video-1/preview",
  fullPath: "/assets/images/image-video-1/full",
};

describe("ImageLightbox", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports auto advance after the configured slideshow duration", () => {
    const onAutoAdvance = vi.fn();
    render(ImageLightboxHarness, {
      props: {
        images: [image],
        initialIndex: 0,
        onClose: vi.fn(),
        autoAdvanceSeconds: 3,
        onAutoAdvance,
      },
    });

    vi.advanceTimersByTime(2_999);
    expect(onAutoAdvance).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onAutoAdvance).toHaveBeenCalledTimes(1);
  });

  it("renders original animated media before the generated MP4 fallback", () => {
    const { container } = render(ImageLightboxHarness, {
      props: {
        images: [videoImage],
        initialIndex: 0,
        onClose: vi.fn(),
      },
    });

    const sources = [...container.querySelectorAll("video source")];
    expect(sources.map((source) => source.getAttribute("src"))).toEqual([
      "/api/assets/images/image-video-1/full",
      "/api/assets/images/image-video-1/preview",
    ]);
    expect(sources.map((source) => source.getAttribute("type"))).toEqual([
      "video/webm",
      "video/mp4",
    ]);
  });
});
