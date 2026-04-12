import { mkdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getGeneratedSceneFolderDir } from "@obscura/media-core";
import { db, schema } from "../db";
import { AppError } from "../plugins/error-handler";
import { parsePagination } from "../lib/query-helpers";
import { buildHierarchyBreadcrumbs } from "../lib/hierarchy-service/breadcrumbs";
import { buildHierarchyScopeConditions } from "../lib/hierarchy-service/list";
import { buildPreviewPathMap } from "../lib/hierarchy-service/previews";
import { isHierarchyNodeVisible } from "../lib/hierarchy-service/visibility";
import {
  hasSceneFolderSchema,
  requireSceneFolderSchema,
} from "../lib/scene-folder-schema";

const { sceneFolders, scenes, libraryRoots } = schema;

const SCENE_FOLDER_COVER_FILE = "cover-custom.jpg";

function sceneFolderCoverAssetPath(id: string) {
  return `/assets/scene-folders/${id}/cover`;
}

async function fetchFolderChildCounts(folderIds: string[]) {
  if (folderIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({
      parentId: sceneFolders.parentId,
      count: sql<number>`count(*)::int`,
    })
    .from(sceneFolders)
    .where(inArray(sceneFolders.parentId, folderIds))
    .groupBy(sceneFolders.parentId);
  return new Map(
    rows
      .filter((row): row is { parentId: string; count: number } => Boolean(row.parentId))
      .map((row) => [row.parentId, row.count]),
  );
}

async function fetchFolderPreviewPaths(folderId: string, nsfwMode?: string) {
  const rows = await db.execute<{
    candidate_path: string | null;
    depth: number;
    file_path: string | null;
  }>(sql`
    WITH RECURSIVE folder_tree AS (
      SELECT id, depth
      FROM scene_folders
      WHERE id = ${folderId}
      UNION ALL
      SELECT child.id, child.depth
      FROM scene_folders child
      INNER JOIN folder_tree ON child.parent_id = folder_tree.id
    )
    SELECT
      COALESCE(scenes.card_thumbnail_path, scenes.thumbnail_path) AS candidate_path,
      folder_tree.depth AS depth,
      scenes.file_path AS file_path
    FROM folder_tree
    INNER JOIN scenes ON scenes.scene_folder_id = folder_tree.id
    WHERE COALESCE(scenes.card_thumbnail_path, scenes.thumbnail_path) IS NOT NULL
      AND (${nsfwMode !== "off" ? sql`TRUE` : sql`scenes.is_nsfw IS NOT TRUE`})
    ORDER BY folder_tree.depth ASC, scenes.file_path ASC
    LIMIT 12
  `);
  return buildPreviewPathMap(
    (rows as unknown as Array<{
      candidate_path: string | null;
      depth: number;
      file_path: string | null;
    }>).map((row) => ({
      containerId: folderId,
      previewPath: row.candidate_path,
      depth: row.depth,
      filePath: row.file_path ?? "",
    })),
  ).get(folderId) ?? [];
}

async function fetchLibraryRootLabels(rootIds: string[]): Promise<Map<string, string>> {
  if (rootIds.length === 0) return new Map();
  const unique = [...new Set(rootIds)];
  const rows = await db
    .select({ id: libraryRoots.id, label: libraryRoots.label })
    .from(libraryRoots)
    .where(inArray(libraryRoots.id, unique));
  return new Map(rows.map((r) => [r.id, r.label]));
}

function toSceneFolderListItem(
  folder: typeof sceneFolders.$inferSelect,
  childFolderCount: number,
  previewThumbnailPaths: string[],
  libraryRootLabel: string,
) {
  return {
    id: folder.id,
    title: folder.title,
    customName: folder.customName,
    displayTitle: folder.customName ?? folder.title,
    folderPath: folder.folderPath,
    relativePath: folder.relativePath,
    parentId: folder.parentId,
    depth: folder.depth,
    isNsfw: folder.isNsfw,
    coverImagePath: folder.coverImagePath,
    directSceneCount: folder.directSceneCount,
    totalSceneCount: folder.totalSceneCount,
    visibleSfwSceneCount: folder.visibleSfwSceneCount,
    containsNsfwDescendants: folder.containsNsfwDescendants,
    childFolderCount,
    previewThumbnailPaths,
    libraryRootId: folder.libraryRootId,
    libraryRootLabel,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export async function listSceneFolders(query: {
  parent?: string;
  root?: string;
  search?: string;
  limit?: string;
  offset?: string;
  nsfw?: string;
}) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 60, 200);
  if (!(await hasSceneFolderSchema())) {
    return {
      items: [],
      total: 0,
      limit,
      offset,
    };
  }

  const conditions = [...buildHierarchyScopeConditions(sceneFolders.parentId, query)];

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(sceneFolders.title, term),
        ilike(sceneFolders.folderPath, term),
        ilike(sceneFolders.relativePath, term),
      )!,
    );
  }

  if (query.nsfw === "off") {
    conditions.push(eq(sceneFolders.isNsfw, false));
    conditions.push(sql`${sceneFolders.visibleSfwSceneCount} > 0`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sceneFolders)
    .where(where);

  const folders = await db
    .select()
    .from(sceneFolders)
    .where(where)
    .orderBy(asc(sceneFolders.title))
    .limit(limit)
    .offset(offset);

  const childCounts = await fetchFolderChildCounts(folders.map((folder) => folder.id));
  const rootLabels = await fetchLibraryRootLabels(folders.map((f) => f.libraryRootId));
  const items = await Promise.all(
    folders.map(async (folder) => {
      const previewThumbnailPaths = await fetchFolderPreviewPaths(folder.id, query.nsfw);
      return toSceneFolderListItem(
        folder,
        childCounts.get(folder.id) ?? 0,
        previewThumbnailPaths,
        rootLabels.get(folder.libraryRootId) ?? "",
      );
    }),
  );

  return {
    items,
    total: countResult.count,
    limit,
    offset,
  };
}

export async function getSceneFolderById(id: string, nsfwMode?: string) {
  await requireSceneFolderSchema();

  const [folder] = await db
    .select()
    .from(sceneFolders)
    .where(eq(sceneFolders.id, id))
    .limit(1);

  if (!folder) {
    throw new AppError(404, "Scene folder not found");
  }

  if (
    !isHierarchyNodeVisible(
      nsfwMode,
      folder.isNsfw,
      folder.visibleSfwSceneCount,
    )
  ) {
    throw new AppError(404, "Scene folder not found");
  }

  const children = await db
    .select()
    .from(sceneFolders)
    .where(eq(sceneFolders.parentId, id))
    .orderBy(asc(sceneFolders.title));

  const childCounts = await fetchFolderChildCounts(children.map((child) => child.id));
  const allRootIds = [folder.libraryRootId, ...children.map((c) => c.libraryRootId)];
  const rootLabels = await fetchLibraryRootLabels(allRootIds);
  const folderRootLabel = rootLabels.get(folder.libraryRootId) ?? "";

  const childItems = await Promise.all(
    children
      .filter((child) =>
        isHierarchyNodeVisible(nsfwMode, child.isNsfw, child.visibleSfwSceneCount),
      )
      .map(async (child) =>
        toSceneFolderListItem(
          child,
          childCounts.get(child.id) ?? 0,
          await fetchFolderPreviewPaths(child.id, nsfwMode),
          rootLabels.get(child.libraryRootId) ?? "",
        )),
  );

  const breadcrumbs = await buildHierarchyBreadcrumbs(
    folder.id,
    async (folderId) => {
      const [row] = await db
        .select({
          id: sceneFolders.id,
          title: sceneFolders.title,
          customName: sceneFolders.customName,
          parentId: sceneFolders.parentId,
        })
        .from(sceneFolders)
        .where(eq(sceneFolders.id, folderId))
        .limit(1);
      return row ?? null;
    },
  );

  return {
    ...toSceneFolderListItem(
      folder,
      childItems.length,
      await fetchFolderPreviewPaths(folder.id, nsfwMode),
      folderRootLabel,
    ),
    breadcrumbs: breadcrumbs.map((crumb) => ({
      id: crumb.id,
      title: crumb.title,
      displayTitle: ("customName" in crumb && crumb.customName) ? crumb.customName as string : crumb.title,
    })),
    children: childItems,
  };
}

export async function updateSceneFolder(
  id: string,
  patch: { isNsfw?: boolean; customName?: string | null },
) {
  await requireSceneFolderSchema();

  const [folder] = await db
    .select({ id: sceneFolders.id })
    .from(sceneFolders)
    .where(eq(sceneFolders.id, id))
    .limit(1);

  if (!folder) {
    throw new AppError(404, "Scene folder not found");
  }

  const updatePatch: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (patch.isNsfw !== undefined) updatePatch.isNsfw = patch.isNsfw;
  if (patch.customName !== undefined) {
    updatePatch.customName = patch.customName || null;
  }

  await db.update(sceneFolders).set(updatePatch).where(eq(sceneFolders.id, id));
  return { ok: true as const, id };
}

export async function setSceneFolderCover(id: string, buffer: Buffer) {
  await requireSceneFolderSchema();

  if (!buffer.length) {
    throw new AppError(400, "Empty file");
  }

  const [folder] = await db
    .select({ id: sceneFolders.id })
    .from(sceneFolders)
    .where(eq(sceneFolders.id, id))
    .limit(1);
  if (!folder) {
    throw new AppError(404, "Scene folder not found");
  }

  const dir = getGeneratedSceneFolderDir(id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, SCENE_FOLDER_COVER_FILE), buffer);

  const coverImagePath = sceneFolderCoverAssetPath(id);
  await db
    .update(sceneFolders)
    .set({ coverImagePath, updatedAt: new Date() })
    .where(eq(sceneFolders.id, id));

  return { ok: true as const, coverImagePath };
}

export async function clearSceneFolderCover(id: string) {
  await requireSceneFolderSchema();

  const [folder] = await db
    .select({ id: sceneFolders.id })
    .from(sceneFolders)
    .where(eq(sceneFolders.id, id))
    .limit(1);
  if (!folder) {
    throw new AppError(404, "Scene folder not found");
  }

  const coverPath = path.join(getGeneratedSceneFolderDir(id), SCENE_FOLDER_COVER_FILE);
  if (existsSync(coverPath)) {
    await unlink(coverPath);
  }

  await db
    .update(sceneFolders)
    .set({ coverImagePath: null, updatedAt: new Date() })
    .where(eq(sceneFolders.id, id));

  return { ok: true as const };
}
