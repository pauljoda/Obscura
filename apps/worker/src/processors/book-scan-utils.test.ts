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
});
