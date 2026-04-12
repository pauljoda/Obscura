import path from "node:path";
import { eq, inArray, like } from "drizzle-orm";
import { db, sceneFolders, scenes } from "./db.js";
import { hasSceneFolderSchema } from "./scene-folder-schema.js";
import {
  groupFilesByDirectory,
  hierarchyFolderDepth,
  libraryContainerTitle,
  mergeLibraryRootIntoDiscoveredDirs,
  pickStaleContainerIds,
  resolveParentPathId,
  toRelativeHierarchyPath,
} from "./hierarchy-sync/hierarchy-sync.js";

interface LibraryRootLike {
  id: string;
  path: string;
  label: string;
}

interface FolderAggregate {
  direct: number;
  total: number;
  visibleSfw: number;
  containsNsfw: boolean;
}

const EMPTY_AGGREGATE: FolderAggregate = {
  direct: 0,
  total: 0,
  visibleSfw: 0,
  containsNsfw: false,
};

let hasWarnedMissingSceneFolderSchema = false;

export async function syncSceneFoldersForRoot(
  root: LibraryRootLike,
  filePaths: string[],
  useLibraryRootAsFolder: boolean,
): Promise<void> {
  if (!(await hasSceneFolderSchema())) {
    if (!hasWarnedMissingSceneFolderSchema) {
      console.warn(
        "[obscura worker] Scene folder sync skipped because the database migration has not been applied yet.",
      );
      hasWarnedMissingSceneFolderSchema = true;
    }
    return;
  }

  hasWarnedMissingSceneFolderSchema = false;

  const filesByDir = groupFilesByDirectory(filePaths);
  const dirsWithFiles = [...filesByDir.keys()];
  const discoveredDirs = mergeLibraryRootIntoDiscoveredDirs(
    dirsWithFiles,
    root.path,
    useLibraryRootAsFolder,
  );
  const includeRootInParentMap =
    useLibraryRootAsFolder || dirsWithFiles.includes(root.path);

  const existingFolders = await db
    .select({
      id: sceneFolders.id,
      folderPath: sceneFolders.folderPath,
      parentId: sceneFolders.parentId,
      depth: sceneFolders.depth,
    })
    .from(sceneFolders)
    .where(eq(sceneFolders.libraryRootId, root.id));

  const folderIdByPath = new Map(
    existingFolders
      .filter((folder) => includeRootInParentMap || folder.folderPath !== root.path)
      .map((folder) => [folder.folderPath, folder.id]),
  );

  for (const dirPath of discoveredDirs) {
    const parentId = resolveParentPathId(dirPath, root.path, folderIdByPath);
    const title = libraryContainerTitle(
      dirPath,
      root.path,
      root.label,
      useLibraryRootAsFolder,
    );
    const relativePath = toRelativeHierarchyPath(root.path, dirPath);
    const depth = hierarchyFolderDepth(root.path, dirPath, useLibraryRootAsFolder);
    const [existingFolder] = existingFolders.filter(
      (folder) => folder.folderPath === dirPath,
    );

    if (existingFolder) {
      await db
        .update(sceneFolders)
        .set({
          title,
          relativePath,
          parentId,
          depth,
          updatedAt: new Date(),
        })
        .where(eq(sceneFolders.id, existingFolder.id));
      folderIdByPath.set(dirPath, existingFolder.id);
      continue;
    }

    const [created] = await db
      .insert(sceneFolders)
      .values({
        libraryRootId: root.id,
        title,
        folderPath: dirPath,
        relativePath,
        parentId,
        depth,
      })
      .returning({ id: sceneFolders.id });
    folderIdByPath.set(dirPath, created.id);
  }

  const staleFolderIds = pickStaleContainerIds(existingFolders, new Set(discoveredDirs));

  const sceneRows = await db
    .select({
      id: scenes.id,
      filePath: scenes.filePath,
      isNsfw: scenes.isNsfw,
      sceneFolderId: scenes.sceneFolderId,
    })
    .from(scenes)
    .where(like(scenes.filePath, `${root.path}%`));

  const sceneIdsByFolderId = new Map<string, string[]>();
  for (const sceneRow of sceneRows) {
    if (!sceneRow.filePath) continue;
    const folderId = folderIdByPath.get(path.dirname(sceneRow.filePath)) ?? null;
    if (folderId) {
      const ids = sceneIdsByFolderId.get(folderId);
      if (ids) {
        ids.push(sceneRow.id);
      } else {
        sceneIdsByFolderId.set(folderId, [sceneRow.id]);
      }
    }
  }

  const discoveredSceneIds = new Set<string>();
  for (const [folderId, sceneIds] of sceneIdsByFolderId.entries()) {
    for (const sceneId of sceneIds) discoveredSceneIds.add(sceneId);
    await db
      .update(scenes)
      .set({ sceneFolderId: folderId, updatedAt: new Date() })
      .where(inArray(scenes.id, sceneIds));
  }

  const sceneIdsToClear = sceneRows
    .filter((sceneRow) => !discoveredSceneIds.has(sceneRow.id) && sceneRow.sceneFolderId)
    .map((sceneRow) => sceneRow.id);
  if (sceneIdsToClear.length > 0) {
    await db
      .update(scenes)
      .set({ sceneFolderId: null, updatedAt: new Date() })
      .where(inArray(scenes.id, sceneIdsToClear));
  }

  const allFolders = await db
    .select({
      id: sceneFolders.id,
      parentId: sceneFolders.parentId,
      depth: sceneFolders.depth,
    })
    .from(sceneFolders)
    .where(eq(sceneFolders.libraryRootId, root.id));

  const folderChildren = new Map<string, string[]>();
  for (const folder of allFolders) {
    if (!folder.parentId) continue;
    const children = folderChildren.get(folder.parentId);
    if (children) {
      children.push(folder.id);
    } else {
      folderChildren.set(folder.parentId, [folder.id]);
    }
  }

  const directCounts = new Map<string, number>();
  const directVisibleSfwCounts = new Map<string, number>();
  const directNsfwCounts = new Map<string, number>();

  for (const sceneRow of sceneRows) {
    if (!sceneRow.filePath) continue;
    const folderId = folderIdByPath.get(path.dirname(sceneRow.filePath));
    if (!folderId) continue;
    directCounts.set(folderId, (directCounts.get(folderId) ?? 0) + 1);
    if (sceneRow.isNsfw === true) {
      directNsfwCounts.set(folderId, (directNsfwCounts.get(folderId) ?? 0) + 1);
    } else {
      directVisibleSfwCounts.set(
        folderId,
        (directVisibleSfwCounts.get(folderId) ?? 0) + 1,
      );
    }
  }

  const aggregateByFolderId = new Map<string, FolderAggregate>();
  for (const folder of [...allFolders].sort((a, b) => b.depth - a.depth)) {
    const aggregate: FolderAggregate = {
      direct: directCounts.get(folder.id) ?? 0,
      total: directCounts.get(folder.id) ?? 0,
      visibleSfw: directVisibleSfwCounts.get(folder.id) ?? 0,
      containsNsfw: (directNsfwCounts.get(folder.id) ?? 0) > 0,
    };
    const childIds = folderChildren.get(folder.id) ?? [];
    for (const childId of childIds) {
      const childAgg = aggregateByFolderId.get(childId) ?? EMPTY_AGGREGATE;
      aggregate.total += childAgg.total;
      aggregate.visibleSfw += childAgg.visibleSfw;
      aggregate.containsNsfw = aggregate.containsNsfw || childAgg.containsNsfw;
    }
    aggregateByFolderId.set(folder.id, aggregate);
  }

  for (const folder of allFolders) {
    const aggregate = aggregateByFolderId.get(folder.id) ?? EMPTY_AGGREGATE;
    await db
      .update(sceneFolders)
      .set({
        directSceneCount: aggregate.direct,
        totalSceneCount: aggregate.total,
        visibleSfwSceneCount: aggregate.visibleSfw,
        containsNsfwDescendants: aggregate.containsNsfw,
        updatedAt: new Date(),
      })
      .where(eq(sceneFolders.id, folder.id));
  }

  if (staleFolderIds.length > 0) {
    await db.delete(sceneFolders).where(inArray(sceneFolders.id, staleFolderIds));
  }
}
