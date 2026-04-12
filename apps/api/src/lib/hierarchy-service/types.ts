export interface HierarchyScopeQuery {
  parent?: string;
  root?: string;
  search?: string;
}

export interface HierarchyBreadcrumbRow {
  id: string;
  title: string;
  customName?: string | null;
  parentId: string | null;
}

export interface PreviewCandidate {
  containerId: string;
  previewPath: string | null;
  depth: number;
  filePath: string;
}
