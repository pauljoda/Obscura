/**
 * @deprecated Import buildHierarchyTree from @obscura/ui/lib/tree directly.
 * This file remains for backward compatibility.
 */
import type { GalleryListItemDto } from "@obscura/contracts";
import { buildHierarchyTree, type TreeNode } from "@obscura/ui/lib/tree";

export interface GalleryTreeNode {
  gallery: GalleryListItemDto;
  children: GalleryTreeNode[];
}

export function buildGalleryTree(galleries: GalleryListItemDto[]): GalleryTreeNode[] {
  const tree = buildHierarchyTree(
    galleries.map((g) => ({ ...g, parentId: g.parentId ?? null })),
    (a, b) => a.title.localeCompare(b.title),
  );

  // Convert TreeNode<T> to legacy GalleryTreeNode shape
  function convert(nodes: TreeNode<GalleryListItemDto>[]): GalleryTreeNode[] {
    return nodes.map((n) => ({
      gallery: n.data,
      children: convert(n.children),
    }));
  }

  return convert(tree);
}
