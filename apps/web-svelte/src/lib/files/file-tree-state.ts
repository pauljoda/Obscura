import type { V2FileEntry, V2FileRoot } from "$lib/api/v2";

export interface FileTreeNodeMeta {
  rootId: string;
  path: string;
  name: string;
  kind: string;
  treePath: string;
}

export function fileTreeRootPath(root: Pick<V2FileRoot, "id" | "label" | "path">): string {
  const label = root.label?.trim() || root.path?.split(/[\\/]/).filter(Boolean).at(-1) || "Library";
  return `${label} (${root.id.slice(0, 8)})`;
}

export function fileTreeEntryPath(rootTreePath: string, entry: Pick<V2FileEntry, "path">): string {
  return entry.path ? `${rootTreePath}/${entry.path}` : rootTreePath;
}

export function createFileTreeRegistry(roots: V2FileRoot[]): Map<string, FileTreeNodeMeta> {
  const registry = new Map<string, FileTreeNodeMeta>();
  for (const root of roots) {
    const treePath = fileTreeRootPath(root);
    registry.set(treePath, {
      rootId: root.id,
      path: "",
      name: root.label || root.path,
      kind: "directory",
      treePath,
    });
  }
  return registry;
}

export function upsertFileTreeEntries(
  registry: Map<string, FileTreeNodeMeta>,
  rootTreePath: string,
  entries: V2FileEntry[],
): string[] {
  const treePaths: string[] = [];
  for (const entry of entries) {
    const treePath = fileTreeEntryPath(rootTreePath, entry);
    registry.set(treePath, {
      rootId: entry.rootId,
      path: entry.path,
      name: entry.name,
      kind: entry.kind,
      treePath,
    });
    treePaths.push(treePath);
  }
  return treePaths;
}

export function unloadedExpandedDirectories(
  treePaths: readonly string[],
  registry: Map<string, FileTreeNodeMeta>,
  loadedKeys: ReadonlySet<string>,
  isExpandedDirectory: (treePath: string) => boolean,
): FileTreeNodeMeta[] {
  return treePaths
    .map((treePath) => registry.get(treePath))
    .filter((meta): meta is FileTreeNodeMeta => Boolean(meta))
    .filter((meta) => meta.kind === "directory")
    .filter((meta) => !loadedKeys.has(`${meta.rootId}:${meta.path}`))
    .filter((meta) => isExpandedDirectory(meta.treePath));
}

