"use client";

import { useMemo } from "react";
import { FolderOpen, Folder, Images } from "lucide-react";
import { buildHierarchyTree } from "@obscura/ui/lib/tree";
import type { GalleryListItemDto } from "@obscura/contracts";
import { useNsfw } from "./nsfw/nsfw-context";
import { HierarchyBrowser } from "./shared/hierarchy-browser";

interface GalleryBrowserProps {
  galleries: GalleryListItemDto[];
}

// Re-export tree types for backward compatibility
export type { TreeNode as GalleryTreeNode } from "@obscura/ui/lib/tree";

/** @deprecated Use buildHierarchyTree from @obscura/ui/lib/tree directly */
export function buildGalleryTree(galleries: GalleryListItemDto[]) {
  return buildHierarchyTree(
    galleries.map((g) => ({ ...g, parentId: g.parentId ?? null })),
    (a, b) => a.title.localeCompare(b.title),
  );
}

export function GalleryBrowser({ galleries }: GalleryBrowserProps) {
  const { mode: nsfwMode } = useNsfw();

  const tree = useMemo(
    () =>
      buildHierarchyTree(
        galleries.map((g) => ({ ...g, parentId: g.parentId ?? null })),
        (a, b) => a.title.localeCompare(b.title),
      ),
    [galleries],
  );

  return (
    <HierarchyBrowser<GalleryListItemDto>
      tree={tree}
      getHref={(g) => `/galleries/${g.id}`}
      getTitle={(g) => g.title}
      isHidden={nsfwMode === "off" ? (g) => g.isNsfw === true : undefined}
      renderBadge={(g) => (
        <span className="flex items-center gap-1 text-[0.65rem] text-text-muted flex-shrink-0">
          <Images className="h-3 w-3" />
          {g.imageCount}
        </span>
      )}
      expandedIcon={FolderOpen}
      collapsedIcon={Folder}
      emptyState={
        <div className="surface-well flex flex-col items-center justify-center py-16 text-center px-4">
          <FolderOpen className="h-8 w-8 text-text-disabled mb-2" />
          <h3 className="text-base font-medium font-heading text-text-secondary mb-1">No galleries found</h3>
          <p className="text-text-muted text-sm max-w-xs">
            Try adjusting your filters or run a library scan to discover galleries.
          </p>
        </div>
      }
    />
  );
}
