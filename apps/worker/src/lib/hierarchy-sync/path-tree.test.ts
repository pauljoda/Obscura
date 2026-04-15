import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  hierarchyFolderDepth,
  libraryContainerTitle,
  mergeLibraryRootIntoDiscoveredDirs,
  toRelativeHierarchyPath,
} from "./path-tree.js";

const root = "/media/Shows";
const series = path.join(root, "Series");
const show = path.join(series, "Show");
const season = path.join(show, "S01");

describe("mergeLibraryRootIntoDiscoveredDirs", () => {
  it("adds intermediate parents even when files live deep", () => {
    const out = mergeLibraryRootIntoDiscoveredDirs([season], root);
    expect(out).not.toContain(root);
    expect(out).toContain(series);
    expect(out).toContain(show);
    expect(out).toContain(season);
  });

  it("keeps the real root when media files live directly under it", () => {
    const out = mergeLibraryRootIntoDiscoveredDirs([root], root);
    expect(out).toEqual([root]);
  });
});

describe("libraryContainerTitle", () => {
  it("uses basename for root path", () => {
    expect(libraryContainerTitle(root, root, "Shows")).toBe(path.basename(root));
  });

  it("uses basename for nested dirs", () => {
    expect(libraryContainerTitle(season, root, "Shows")).toBe(path.basename(season));
  });
});

describe("hierarchyFolderDepth", () => {
  it("depth 0 at the first segment under the root", () => {
    expect(hierarchyFolderDepth(root, series)).toBe(0);
  });

  it("increments by segment", () => {
    expect(hierarchyFolderDepth(root, show)).toBe(1);
    expect(hierarchyFolderDepth(root, season)).toBe(2);
  });

  it("matches relative-path segment math", () => {
    const rel = toRelativeHierarchyPath(root, season);
    const expected = rel && rel !== "." ? rel.split(/[/\\]/).filter(Boolean).length - 1 : 0;
    expect(hierarchyFolderDepth(root, season)).toBe(expected);
  });
});
