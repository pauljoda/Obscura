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

function isWithinRoot(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Expand discovered media directories into a full hierarchy chain.
 *
 * Example:
 * - root `/media/Shows`
 * - media in `/media/Shows/Series/Season`
 *
 * Returns:
 * - off: `/media/Shows/Series`, `/media/Shows/Series/Season`
 * - on: `/media/Shows`, `/media/Shows/Series`, `/media/Shows/Series/Season`
 */
export function mergeLibraryRootIntoDiscoveredDirs(
  dirPaths: Iterable<string>,
  rootPath: string,
): string[] {
  const set = new Set<string>();

  for (const dirPath of dirPaths) {
    let current = dirPath;

    while (isWithinRoot(rootPath, current)) {
      if (current === rootPath) {
        // The library root is never a folder in the hierarchy, but if
        // a discovered file sits directly at the root the entry has to
        // go somewhere — the root directory itself is the stand-in.
        if (dirPath === rootPath) {
          set.add(current);
        }
        break;
      }

      set.add(current);

      const parentDir = path.dirname(current);
      if (parentDir === current) break;
      current = parentDir;
    }
  }

  return sortPathsParentFirst(set);
}

export function libraryContainerTitle(
  dirPath: string,
  _rootPath: string,
  _rootLabel: string,
): string {
  // The library root is never treated as a folder. Series and seasons
  // are now modeled explicitly in the video schema, and audio / gallery
  // hierarchies always use the first subdirectory as depth 0.
  return path.basename(dirPath);
}

/**
 * Depth for aggregate ordering: 0 at the first path segment under the
 * root, +1 per additional segment. The library root itself is never a
 * folder (segment count 0 means we're at the root itself, which has no
 * hierarchy entry).
 */
export function hierarchyFolderDepth(
  rootPath: string,
  dirPath: string,
): number {
  const rel = toRelativeHierarchyPath(rootPath, dirPath);
  if (!rel || rel === ".") return 0;
  const segments = rel.split(/[/\\]/).filter(Boolean);
  if (segments.length === 0) return 0;
  return segments.length - 1;
}

export function pickStaleContainerIds(
  existing: Array<{ id: string; folderPath: string | null }>,
  discoveredDirs: Set<string>,
): string[] {
  return existing
    .filter((row) => row.folderPath && !discoveredDirs.has(row.folderPath))
    .map((row) => row.id);
}
