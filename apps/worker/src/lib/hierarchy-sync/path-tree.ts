import path from "node:path";

export function sortPathsParentFirst(paths: Iterable<string>): string[] {
  return [...paths].sort((a, b) => {
    const depthDiff = a.split(path.sep).length - b.split(path.sep).length;
    if (depthDiff !== 0) return depthDiff;
    return a.localeCompare(b);
  });
}

export function resolveParentPathId(
  dirPath: string,
  rootPath: string,
  pathToId: Map<string, string>,
): string | null {
  const parentDir = path.dirname(dirPath);
  if (parentDir === dirPath || !parentDir.startsWith(rootPath)) return null;
  return pathToId.get(parentDir) ?? null;
}

export function toRelativeHierarchyPath(rootPath: string, targetPath: string): string {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" ? "." : relative;
}

/** Dirs that contain media, optionally forcing the library root path first for parent resolution. */
export function mergeLibraryRootIntoDiscoveredDirs(
  dirPaths: Iterable<string>,
  rootPath: string,
  includeRootAsFolder: boolean,
): string[] {
  const set = new Set(dirPaths);
  if (includeRootAsFolder) set.add(rootPath);
  return sortPathsParentFirst(set);
}

export function libraryContainerTitle(
  dirPath: string,
  rootPath: string,
  rootLabel: string,
  useLibraryRootAsFolder: boolean,
): string {
  if (useLibraryRootAsFolder && dirPath === rootPath) return rootLabel;
  return path.basename(dirPath);
}

/**
 * Depth for aggregate ordering: 0 at the library root folder row, +1 per path segment under the root.
 * When `useLibraryRootAsFolder` is false, the first segment under the root is depth 0 (legacy behavior).
 */
export function hierarchyFolderDepth(
  rootPath: string,
  dirPath: string,
  useLibraryRootAsFolder: boolean,
): number {
  const rel = toRelativeHierarchyPath(rootPath, dirPath);
  if (!rel || rel === ".") return 0;
  const segments = rel.split(/[/\\]/).filter(Boolean);
  if (segments.length === 0) return 0;
  return useLibraryRootAsFolder ? segments.length : segments.length - 1;
}

export function pickStaleContainerIds(
  existing: Array<{ id: string; folderPath: string | null }>,
  discoveredDirs: Set<string>,
): string[] {
  return existing
    .filter((row) => row.folderPath && !discoveredDirs.has(row.folderPath))
    .map((row) => row.id);
}
