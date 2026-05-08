import { describe, expect, it } from "vitest";
import {
  canResumeComic,
  comicProgressLabel,
  comicProgressPercent,
  comicReadingProgressKey,
  isComicComplete,
  normalizeComicProgress,
} from "./comic-progress";

describe("comic progress helpers", () => {
  it("builds a stable per-gallery persistence key", () => {
    expect(comicReadingProgressKey("gallery-1")).toBe("comic-reader:gallery-1:progress");
  });

  it("clamps stored page indexes to the current gallery image list", () => {
    expect(normalizeComicProgress({ pageIndex: 99, pageCount: 120 }, 12)).toMatchObject({
      pageIndex: 11,
      pageCount: 12,
    });
    expect(normalizeComicProgress({ pageIndex: -4, pageCount: 12 }, 12)).toMatchObject({
      pageIndex: 0,
      pageCount: 12,
    });
  });

  it("reports resume availability and display progress", () => {
    expect(canResumeComic({ pageIndex: 0, pageCount: 10 }, 10)).toBe(false);
    expect(canResumeComic({ pageIndex: 4, pageCount: 10 }, 10)).toBe(true);
    expect(comicProgressPercent(4, 10)).toBe(50);
    expect(comicProgressLabel(4, 10)).toBe("Page 5 of 10");
  });

  it("preserves completed-at state for read comics", () => {
    const progress = normalizeComicProgress(
      { pageIndex: 9, pageCount: 10, completedAt: "2026-05-08T18:00:00.000Z" },
      10,
    );

    expect(progress.completedAt).toBe("2026-05-08T18:00:00.000Z");
    expect(isComicComplete(progress, 10)).toBe(true);
    expect(isComicComplete({ pageIndex: 9, pageCount: 10 }, 10)).toBe(false);
  });
});
