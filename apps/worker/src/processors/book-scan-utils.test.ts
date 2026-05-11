import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  inferComicBookArchivePlan,
  isSupportedComicBookArchive,
} from "./book-scan-utils.js";

const root = "/library/Books";

describe("isSupportedComicBookArchive", () => {
  it("keeps book scanning focused on zip and cbz comic archives", () => {
    expect(isSupportedComicBookArchive(path.join(root, "Issue 1.cbz"))).toBe(true);
    expect(isSupportedComicBookArchive(path.join(root, "Issue 1.zip"))).toBe(true);
    expect(isSupportedComicBookArchive(path.join(root, "Issue 1.cbr"))).toBe(false);
    expect(isSupportedComicBookArchive(path.join(root, "Novel.epub"))).toBe(false);
  });
});

describe("inferComicBookArchivePlan", () => {
  it("turns a single archive into a one-chapter book", () => {
    expect(
      inferComicBookArchivePlan({
        archivePath: path.join(root, "One Shot.cbz"),
        rootPath: root,
        comicInfo: { title: "One Shot", urls: [], creators: [], tags: [] },
      }),
    ).toMatchObject({
      bookTitle: "One Shot",
      chapterTitle: "One Shot",
      chapterNumber: 1,
      relativePath: "One Shot.cbz",
    });
  });

  it("uses ComicInfo series/title metadata for chaptered archive folders", () => {
    expect(
      inferComicBookArchivePlan({
        archivePath: path.join(root, "She Was Cute Before", "v02.cbz"),
        rootPath: root,
        comicInfo: {
          title: "Chapter Two",
          series: "She Was Cute Before",
          number: "2",
          urls: [],
          creators: [],
          tags: [],
        },
      }),
    ).toMatchObject({
      bookTitle: "She Was Cute Before",
      chapterTitle: "Chapter Two",
      chapterNumber: 2,
      relativePath: path.join("She Was Cute Before", "v02.cbz"),
    });
  });

  it("numbers loose archives in a book folder without creating volumes", () => {
    expect(
      inferComicBookArchivePlan({
        archivePath: path.join(root, "For the Travel Records", "For the Travel Records 02.zip"),
        rootPath: root,
        comicInfo: null,
      }),
    ).toMatchObject({
      bookTitle: "For the Travel Records",
      chapterTitle: "For the Travel Records 02",
      chapterNumber: 2,
      bookRelativePath: "For the Travel Records",
      volumeNumber: null,
      volumeTitle: null,
      volumeRelativePath: null,
    });
  });

  it("does not treat a top-level same-named wrapper folder as a volume", () => {
    expect(
      inferComicBookArchivePlan({
        archivePath: path.join(root, "Volume 01", "Volume 01.cbz"),
        rootPath: root,
        comicInfo: {
          title: "Volume 01",
          volume: 1,
          urls: [],
          creators: [],
          tags: [],
        },
      }),
    ).toMatchObject({
      bookTitle: "Volume 01",
      chapterTitle: "Volume 01",
      bookRelativePath: "Volume 01",
      volumeNumber: null,
      volumeTitle: null,
      volumeRelativePath: null,
    });
  });

  it("keeps same-named chapter wrapper folders loose instead of making volumes", () => {
    expect(
      inferComicBookArchivePlan({
        archivePath: path.join(root, "A Series", "Chapter 01", "Chapter 01.cbz"),
        rootPath: root,
        comicInfo: { title: "Chapter 01", urls: [], creators: [], tags: [] },
      }),
    ).toMatchObject({
      bookTitle: "A Series",
      chapterTitle: "Chapter 01",
      bookRelativePath: "A Series",
      volumeNumber: null,
      volumeTitle: null,
      volumeRelativePath: null,
    });
  });

  it("keeps non-volume chapter wrapper folders loose under their book", () => {
    expect(
      inferComicBookArchivePlan({
        archivePath: path.join(root, "A Series", "Chapter 01", "Pages.cbz"),
        rootPath: root,
        comicInfo: { title: "Chapter 01", urls: [], creators: [], tags: [] },
      }),
    ).toMatchObject({
      bookTitle: "A Series",
      chapterTitle: "Chapter 01",
      bookRelativePath: "A Series",
      volumeNumber: null,
      volumeTitle: null,
      volumeRelativePath: null,
    });
  });

  it("only creates volumes from explicit volume subfolders inside a book", () => {
    expect(
      inferComicBookArchivePlan({
        archivePath: path.join(root, "A Series", "Volume 01", "Chapter 01.cbz"),
        rootPath: root,
        comicInfo: { title: "Chapter 01", urls: [], creators: [], tags: [] },
      }),
    ).toMatchObject({
      bookTitle: "A Series",
      chapterTitle: "Chapter 01",
      bookRelativePath: "A Series",
      volumeNumber: 1,
      volumeTitle: "Volume 01",
      volumeRelativePath: path.join("A Series", "Volume 01"),
    });
  });

  it("recognizes old duplicated volume folders as the intended canonical volume", () => {
    expect(
      inferComicBookArchivePlan({
        archivePath: path.join(root, "A Series", "Volume 01 - Volume 1", "Chapter 01.cbz"),
        rootPath: root,
        comicInfo: { title: "Chapter 01", urls: [], creators: [], tags: [] },
      }),
    ).toMatchObject({
      bookTitle: "A Series",
      chapterTitle: "Chapter 01",
      bookRelativePath: "A Series",
      volumeNumber: 1,
      volumeTitle: "Volume 01",
      volumeRelativePath: path.join("A Series", "Volume 01"),
    });
  });
});
