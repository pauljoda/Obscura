import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  inferComicArchiveGrouping,
  inferComicArchiveTitle,
  redundantSingleArchiveFolders,
} from "./gallery-series.js";

const root = "/library/Comics";

describe("inferComicArchiveGrouping", () => {
  it("keeps archives directly under the library root ungrouped", () => {
    expect(
      inferComicArchiveGrouping(path.join(root, "One Shot.cbz"), root, new Map()),
    ).toEqual({ parentId: null, parentTitle: null });
  });

  it("uses the containing folder gallery as the parent for nested archives", () => {
    const folder = path.join(root, "She Was Cute Before");
    expect(
      inferComicArchiveGrouping(
        path.join(folder, "She Was Cute Before 1.cbz"),
        root,
        new Map([[folder, "folder-gallery-id"]]),
      ),
    ).toEqual({
      parentId: "folder-gallery-id",
      parentTitle: "She Was Cute Before",
    });
  });

  it("treats a same-named single archive folder as a loose root archive", () => {
    const folder = path.join(root, "One Shot");
    const redundantFolders = redundantSingleArchiveFolders({
      rootPath: root,
      imageFiles: [],
      zipFiles: [path.join(folder, "One Shot.cbz")],
    });

    expect(redundantFolders.has(folder)).toBe(true);
    expect(
      inferComicArchiveGrouping(
        path.join(folder, "One Shot.cbz"),
        root,
        new Map([[folder, "folder-gallery-id"]]),
        redundantFolders,
      ),
    ).toEqual({ parentId: null, parentTitle: null });
  });

  it("keeps multi-archive folders grouped as comic series", () => {
    const folder = path.join(root, "She Was Cute Before");
    const redundantFolders = redundantSingleArchiveFolders({
      rootPath: root,
      imageFiles: [],
      zipFiles: [
        path.join(folder, "She Was Cute Before 1.cbz"),
        path.join(folder, "She Was Cute Before 2.cbz"),
      ],
    });

    expect(redundantFolders.has(folder)).toBe(false);
  });
});

describe("inferComicArchiveTitle", () => {
  it("numbers grouped chapter titles when the archive name ends in a number", () => {
    expect(
      inferComicArchiveTitle({
        zipPath: path.join(root, "She Was Cute Before", "She Was Cute Before 2.cbz"),
        fallbackTitle: "She Was Cute Before 2",
        parentTitle: "She Was Cute Before",
        comicInfoTitle: "She Was Cute Before 2",
      }),
    ).toBe("She Was Cute Before #02");
  });

  it("keeps unnumbered grouped archive titles as sub-gallery titles", () => {
    expect(
      inferComicArchiveTitle({
        zipPath: path.join(root, "Anthology", "Bonus Story.cbz"),
        fallbackTitle: "Bonus Story",
        parentTitle: "Anthology",
        comicInfoTitle: undefined,
      }),
    ).toBe("Bonus Story");
  });
});
