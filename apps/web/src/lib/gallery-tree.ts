import type { GalleryListItemDto } from "@obscura/contracts";

export interface GalleryTreeNode {
  gallery: GalleryListItemDto;
  children: GalleryTreeNode[];
}

export function buildGalleryTree(galleries: GalleryListItemDto[]): GalleryTreeNode[] {
  const nodeMap = new Map<string, GalleryTreeNode>();
  const roots: GalleryTreeNode[] = [];

  // Create nodes
  for (const gallery of galleries) {
    nodeMap.set(gallery.id, { gallery, children: [] });
  }

  // Build tree
  for (const gallery of galleries) {
    const node = nodeMap.get(gallery.id)!;
    if (gallery.parentId && nodeMap.has(gallery.parentId)) {
      nodeMap.get(gallery.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children alphabetically
  const sortChildren = (nodes: GalleryTreeNode[]) => {
    nodes.sort((a, b) => a.gallery.title.localeCompare(b.gallery.title));
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}
