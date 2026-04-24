import { describe, expect, it } from "vitest";
import {
  isPathVisibleForRoots,
  summarizeActiveLibraryRoots,
} from "./library-root-visibility";

describe("summarizeActiveLibraryRoots", () => {
  it("keeps only enabled roots for each media family", () => {
    const scope = summarizeActiveLibraryRoots([
      {
        id: "root-video",
        path: "/media/video",
        enabled: true,
        scanVideos: true,
        scanImages: false,
        scanAudio: false,
      },
      {
        id: "root-mixed",
        path: "/media/mixed",
        enabled: true,
        scanVideos: true,
        scanImages: true,
        scanAudio: false,
      },
      {
        id: "root-disabled",
        path: "/media/disabled",
        enabled: false,
        scanVideos: true,
        scanImages: true,
        scanAudio: true,
      },
      {
        id: "root-audio",
        path: "/media/audio",
        enabled: true,
        scanVideos: false,
        scanImages: false,
        scanAudio: true,
      },
    ]);

    expect(scope.videoRootIds).toEqual(["root-video", "root-mixed"]);
    expect(scope.imageRootPaths).toEqual(["/media/mixed"]);
    expect(scope.audioRootPaths).toEqual(["/media/audio"]);
  });
});

describe("isPathVisibleForRoots", () => {
  it("accepts direct files and archive-scoped paths inside an enabled root", () => {
    expect(
      isPathVisibleForRoots("/media/library/movie.mp4", ["/media/library"]),
    ).toBe(true);
    expect(
      isPathVisibleForRoots(
        "/media/library/archive.zip::image-01.jpg",
        ["/media/library"],
      ),
    ).toBe(true);
  });

  it("rejects prefix collisions outside the root boundary", () => {
    expect(
      isPathVisibleForRoots("/media/library-2/movie.mp4", ["/media/library"]),
    ).toBe(false);
  });

  it("returns false when no roots are active", () => {
    expect(isPathVisibleForRoots("/media/library/movie.mp4", [])).toBe(false);
  });
});
