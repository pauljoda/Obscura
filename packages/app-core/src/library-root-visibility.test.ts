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
        scanMovies: true,
        scanSeries: false,
        scanImages: false,
        scanAudio: false,
      },
      {
        id: "root-series",
        path: "/media/series",
        enabled: true,
        scanMovies: false,
        scanSeries: true,
        scanImages: true,
        scanAudio: false,
      },
      {
        id: "root-disabled",
        path: "/media/disabled",
        enabled: false,
        scanMovies: true,
        scanSeries: true,
        scanImages: true,
        scanAudio: true,
      },
      {
        id: "root-audio",
        path: "/media/audio",
        enabled: true,
        scanMovies: false,
        scanSeries: false,
        scanImages: false,
        scanAudio: true,
      },
    ]);

    expect(scope.movieRootIds).toEqual(["root-video"]);
    expect(scope.seriesRootIds).toEqual(["root-series"]);
    expect(scope.imageRootPaths).toEqual(["/media/series"]);
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
