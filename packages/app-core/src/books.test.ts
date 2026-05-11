import { describe, expect, it } from "vitest";
import { resolveBookArtwork } from "./books";

describe("resolveBookArtwork", () => {
  it("uses a custom book cover as both the default image and first preview image", () => {
    const artwork = resolveBookArtwork({
      bookId: "book-1",
      storedCoverImagePath: "/assets/books/book-1/cover",
      pages: [
        {
          pageId: "page-1",
          chapterId: "chapter-1",
          volumeId: null,
          volumeNumber: null,
          volumeTitle: null,
          chapterNumber: 1,
          chapterTitle: "Chapter 1",
          sortOrder: 0,
        },
      ],
    });

    expect(artwork.coverImagePath).toBe("/assets/books/book-1/cover");
    expect(artwork.previewImagePaths).toEqual(["/assets/books/book-1/cover"]);
  });

  it("ignores stale generated page covers and falls back to the first page in volume order", () => {
    const artwork = resolveBookArtwork({
      bookId: "book-1",
      storedCoverImagePath: "/assets/book-pages/stale-page/thumb",
      pages: [
        {
          pageId: "loose-page",
          chapterId: "loose-chapter",
          volumeId: null,
          volumeNumber: null,
          volumeTitle: null,
          chapterNumber: 1,
          chapterTitle: "Loose chapter",
          sortOrder: 0,
        },
        {
          pageId: "volume-2-page",
          chapterId: "chapter-v2",
          volumeId: "volume-2",
          volumeNumber: 2,
          volumeTitle: "Volume 02",
          chapterNumber: 1,
          chapterTitle: "Chapter 1",
          sortOrder: 0,
        },
        {
          pageId: "volume-1-page",
          chapterId: "chapter-v1",
          volumeId: "volume-1",
          volumeNumber: 1,
          volumeTitle: "Volume 01",
          chapterNumber: 1,
          chapterTitle: "Chapter 1",
          sortOrder: 0,
        },
      ],
    });

    expect(artwork.coverImagePath).toBe("/assets/book-pages/volume-1-page/thumb");
    expect(artwork.previewImagePaths).toEqual([
      "/assets/book-pages/volume-1-page/thumb",
      "/assets/book-pages/volume-2-page/thumb",
      "/assets/book-pages/loose-page/thumb",
    ]);
  });

  it("uses chapter order when a book has no volumes", () => {
    const artwork = resolveBookArtwork({
      bookId: "book-1",
      storedCoverImagePath: null,
      pages: [
        {
          pageId: "chapter-2-page",
          chapterId: "chapter-2",
          volumeId: null,
          volumeNumber: null,
          volumeTitle: null,
          chapterNumber: 2,
          chapterTitle: "Chapter 2",
          sortOrder: 0,
        },
        {
          pageId: "chapter-1-page",
          chapterId: "chapter-1",
          volumeId: null,
          volumeNumber: null,
          volumeTitle: null,
          chapterNumber: 1,
          chapterTitle: "Chapter 1",
          sortOrder: 0,
        },
      ],
    });

    expect(artwork.coverImagePath).toBe("/assets/book-pages/chapter-1-page/thumb");
    expect(artwork.previewImagePaths[0]).toBe("/assets/book-pages/chapter-1-page/thumb");
  });
});
