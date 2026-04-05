"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, FolderOpen, Folder, Images } from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import { buildGalleryTree, type GalleryTreeNode } from "../lib/gallery-tree";
import type { GalleryListItemDto } from "@obscura/contracts";

interface GalleryBrowserProps {
  galleries: GalleryListItemDto[];
}

export function GalleryBrowser({ galleries }: GalleryBrowserProps) {
  const tree = useMemo(() => buildGalleryTree(galleries), [galleries]);

  if (tree.length === 0) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen className="h-8 w-8 text-text-disabled mb-2" />
        <p className="text-text-muted text-sm">No galleries found</p>
      </div>
    );
  }

  return (
    <div className="surface-well">
      {tree.map((node) => (
        <TreeRow key={node.gallery.id} node={node} depth={0} />
      ))}
    </div>
  );
}

function TreeRow({ node, depth }: { node: GalleryTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2 transition-colors duration-fast border-b border-border-subtle"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-5 w-5 items-center justify-center rounded-sm text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Folder icon */}
        {expanded && hasChildren ? (
          <FolderOpen className="h-4 w-4 text-accent-500 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-text-muted flex-shrink-0" />
        )}

        {/* Title link */}
        <Link
          href={`/galleries/${node.gallery.id}`}
          className="flex-1 min-w-0 text-[0.78rem] text-text-primary hover:text-text-accent truncate transition-colors"
        >
          {node.gallery.title}
        </Link>

        {/* Image count */}
        <span className="flex items-center gap-1 text-[0.65rem] text-text-muted flex-shrink-0">
          <Images className="h-3 w-3" />
          {node.gallery.imageCount}
        </span>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeRow key={child.gallery.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
