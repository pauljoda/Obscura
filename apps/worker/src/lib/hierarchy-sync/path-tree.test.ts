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
const season = path.join(series, "S01");

describe("mergeLibraryRootIntoDiscoveredDirs", () => {
  it("adds library root when requested", () => {
    const out = mergeLibraryRootIntoDiscoveredDirs([season, series], root, true);
    expect(out[0]).toBe(root);
    expect(out).toContain(series);
    expect(out).toContain(season);
  });

  it("does not add root when flag is off", () => {
    const out = mergeLibraryRootIntoDiscoveredDirs([season, series], root, false);
    expect(out).not.toContain(root);
  });
});

describe("libraryContainerTitle", () => {
  it("uses library label for root path when flag is on", () => {
    expect(libraryContainerTitle(root, root, "Shows", true)).toBe("Shows");
  });

  it("uses basename for root path when flag is off", () => {
    expect(libraryContainerTitle(root, root, "Shows", false)).toBe(path.basename(root));
  });

  it("uses basename for nested dirs", () => {
    expect(libraryContainerTitle(season, root, "Shows", true)).toBe(path.basename(season));
  });
});

describe("hierarchyFolderDepth", () => {
  it("depth 0 at root row when using root as folder", () => {
    expect(hierarchyFolderDepth(root, root, true)).toBe(0);
  });

  it("increments by segment when using root as folder", () => {
    expect(hierarchyFolderDepth(root, series, true)).toBe(1);
    expect(hierarchyFolderDepth(root, season, true)).toBe(2);
  });

  it("matches legacy depth when flag is off", () => {
    const rel = toRelativeHierarchyPath(root, season);
    const legacy = rel && rel !== "." ? rel.split(/[/\\]/).filter(Boolean).length - 1 : 0;
    expect(hierarchyFolderDepth(root, season, false)).toBe(legacy);
  });
});
