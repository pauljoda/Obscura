import path from "node:path";
import { describe, expect, it } from "vitest";
import { planGallerySeriesMerge } from "./gallery-series-merge";

const root = "/library/Comics";

describe("planGallerySeriesMerge", () => {
  it("moves flat archive galleries into a new series folder", () => {
    const plan = planGallerySeriesMerge({
      title: "She Was Cute Before",
      galleries: [
        {
          id: "one",
          galleryType: "zip",
          folderPath: null,
          zipFilePath: path.join(root, "She Was Cute Before 1.cbz"),
        },
        {
          id: "two",
          galleryType: "zip",
          folderPath: null,
          zipFilePath: path.join(root, "She Was Cute Before 2.cbz"),
        },
      ],
    });

    expect(plan.targetDir).toBe(path.join(root, "She Was Cute Before"));
    expect(plan.moves).toEqual([
      {
        galleryId: "one",
        sourcePath: path.join(root, "She Was Cute Before 1.cbz"),
        destinationPath: path.join(root, "She Was Cute Before", "She Was Cute Before 1.cbz"),
        kind: "zip",
      },
      {
        galleryId: "two",
        sourcePath: path.join(root, "She Was Cute Before 2.cbz"),
        destinationPath: path.join(root, "She Was Cute Before", "She Was Cute Before 2.cbz"),
        kind: "zip",
      },
    ]);
  });

  it("keeps archives already inside the target folder in place", () => {
    const targetDir = path.join(root, "She Was Cute Before");
    const plan = planGallerySeriesMerge({
      title: "She Was Cute Before",
      galleries: [
        {
          id: "one",
          galleryType: "zip",
          folderPath: null,
          zipFilePath: path.join(targetDir, "She Was Cute Before 1.cbz"),
        },
      ],
    });

    expect(plan.moves).toEqual([]);
    expect(plan.targetDir).toBe(targetDir);
  });

  it("adds a flat archive to an existing selected series folder", () => {
    const targetDir = path.join(root, "She Was Cute Before");
    const plan = planGallerySeriesMerge({
      title: "She Was Cute Before",
      galleries: [
        {
          id: "existing-one",
          galleryType: "zip",
          folderPath: null,
          zipFilePath: path.join(targetDir, "She Was Cute Before 1.cbz"),
        },
        {
          id: "new-one",
          galleryType: "zip",
          folderPath: null,
          zipFilePath: path.join(root, "She Was Cute Before 3.cbz"),
        },
      ],
    });

    expect(plan.targetDir).toBe(targetDir);
    expect(plan.moves).toEqual([
      {
        galleryId: "new-one",
        sourcePath: path.join(root, "She Was Cute Before 3.cbz"),
        destinationPath: path.join(targetDir, "She Was Cute Before 3.cbz"),
        kind: "zip",
      },
    ]);
  });

  it("does not move the selected series folder into itself", () => {
    const targetDir = path.join(root, "She Was Cute Before");
    const plan = planGallerySeriesMerge({
      title: "She Was Cute Before",
      galleries: [
        {
          id: "series",
          galleryType: "folder",
          folderPath: targetDir,
          zipFilePath: null,
        },
        {
          id: "new-one",
          galleryType: "zip",
          folderPath: null,
          zipFilePath: path.join(root, "She Was Cute Before 3.cbz"),
        },
      ],
    });

    expect(plan.targetDir).toBe(targetDir);
    expect(plan.moves).toEqual([
      {
        galleryId: "new-one",
        sourcePath: path.join(root, "She Was Cute Before 3.cbz"),
        destinationPath: path.join(targetDir, "She Was Cute Before 3.cbz"),
        kind: "zip",
      },
    ]);
  });

  it("moves same-named single-archive wrapper folders into the new series folder", () => {
    const plan = planGallerySeriesMerge({
      title: "New Series",
      galleries: [
        {
          id: "one",
          galleryType: "zip",
          folderPath: null,
          zipFilePath: path.join(root, "Old One", "Old One.cbz"),
        },
        {
          id: "two",
          galleryType: "zip",
          folderPath: null,
          zipFilePath: path.join(root, "Old Two", "Old Two.cbz"),
        },
      ],
    });

    expect(plan.targetDir).toBe(path.join(root, "New Series"));
    expect(plan.moves).toEqual([
      {
        galleryId: "one",
        sourcePath: path.join(root, "Old One", "Old One.cbz"),
        destinationPath: path.join(root, "New Series", "Old One.cbz"),
        kind: "zip",
      },
      {
        galleryId: "two",
        sourcePath: path.join(root, "Old Two", "Old Two.cbz"),
        destinationPath: path.join(root, "New Series", "Old Two.cbz"),
        kind: "zip",
      },
    ]);
    expect(plan.emptySourceDirs).toEqual([
      path.join(root, "Old One"),
      path.join(root, "Old Two"),
    ]);
  });
});
