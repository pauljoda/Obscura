import type { HierarchyBreadcrumbRow } from "./types";

export async function buildHierarchyBreadcrumbs(
  startId: string,
  loadById: (id: string) => Promise<HierarchyBreadcrumbRow | null>,
  maxDepth = 32,
): Promise<Array<{ id: string; title: string }>> {
  const breadcrumbs: Array<{ id: string; title: string }> = [];
  let currentId: string | null = startId;
  let remaining = maxDepth;

  while (currentId && remaining > 0) {
    const current = await loadById(currentId);
    if (!current) break;

    breadcrumbs.push({ id: current.id, title: current.title });
    currentId = current.parentId;
    remaining -= 1;
  }

  return breadcrumbs.reverse();
}
