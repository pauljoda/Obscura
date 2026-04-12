import type { HierarchyBreadcrumbRow } from "./types";

export async function buildHierarchyBreadcrumbs<Row extends HierarchyBreadcrumbRow>(
  startId: string,
  loadById: (id: string) => Promise<Row | null>,
  maxDepth = 32,
): Promise<Array<Omit<Row, "parentId">>> {
  const breadcrumbs: Array<Omit<Row, "parentId">> = [];
  let currentId: string | null = startId;
  let remaining = maxDepth;

  while (currentId && remaining > 0) {
    const current = await loadById(currentId);
    if (!current) break;

    const { parentId: _parentId, ...crumb } = current;
    breadcrumbs.push(crumb);
    currentId = current.parentId;
    remaining -= 1;
  }

  return breadcrumbs.reverse();
}
