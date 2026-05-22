import { describe, expect, it, vi } from "vitest";
import {
  createFileTreeRegistry,
  fileTreeEntryPath,
  fileTreeRootPath,
  unloadedExpandedDirectories,
  upsertFileTreeEntries,
} from "./file-tree-state";
import type { V2FileEntry, V2FileRoot } from "$lib/api/v2";

describe("file tree state", () => {
  const root: V2FileRoot = {
    id: "root-alpha-1234",
    label: "Movies",
    path: "/media/movies",
    enabled: true,
  };

  it("maps display tree paths back to root ids and relative paths", () => {
    const registry = createFileTreeRegistry([root]);
    const rootPath = fileTreeRootPath(root);
    const entries: V2FileEntry[] = [
      {
        rootId: root.id,
        path: "Series/Season 1/clip.mp4",
        name: "clip.mp4",
        kind: "file",
        sizeBytes: 10,
        mimeType: "video/mp4",
        modifiedAt: null,
      },
    ];

    upsertFileTreeEntries(registry, rootPath, entries);
    const meta = registry.get(fileTreeEntryPath(rootPath, entries[0]));

    expect(meta).toMatchObject({
      rootId: root.id,
      path: "Series/Season 1/clip.mp4",
      name: "clip.mp4",
      kind: "file",
    });
  });

  it("returns expanded unloaded directories once", () => {
    const registry = createFileTreeRegistry([root]);
    const rootPath = fileTreeRootPath(root);
    const paths = upsertFileTreeEntries(registry, rootPath, [
      {
        rootId: root.id,
        path: "Series",
        name: "Series",
        kind: "directory",
        sizeBytes: null,
        mimeType: null,
        modifiedAt: null,
      },
    ]);
    const isExpanded = vi.fn((treePath: string) => treePath.endsWith("Series"));

    expect(unloadedExpandedDirectories([rootPath, ...paths], registry, new Set([`${root.id}:`]), isExpanded))
      .toEqual([registry.get(`${rootPath}/Series`)]);
    expect(unloadedExpandedDirectories([rootPath, ...paths], registry, new Set([`${root.id}:`, `${root.id}:Series`]), isExpanded))
      .toEqual([]);
  });
});

