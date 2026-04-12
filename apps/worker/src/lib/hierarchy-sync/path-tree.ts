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

export function pickStaleContainerIds(
  existing: Array<{ id: string; folderPath: string | null }>,
  discoveredDirs: Set<string>,
): string[] {
  return existing
    .filter((row) => row.folderPath && !discoveredDirs.has(row.folderPath))
    .map((row) => row.id);
}
