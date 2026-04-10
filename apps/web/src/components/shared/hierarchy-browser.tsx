"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FolderOpen, Folder } from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import type { TreeNode } from "@obscura/ui/lib/tree";

export interface HierarchyBrowserProps<T> {
  tree: TreeNode<T>[];
  /** Build the href for a tree node */
  getHref: (data: T) => string;
  /** Get the display title for a node */
  getTitle: (data: T) => string;
  /** Whether a node should be hidden (e.g., NSFW filtering) */
  isHidden?: (data: T) => boolean;
  /** Render a count/badge on the right side of a row */
  renderBadge?: (data: T) => React.ReactNode;
  /** Icon for expanded folders (default: FolderOpen) */
  expandedIcon?: React.ComponentType<{ className?: string }>;
  /** Icon for collapsed folders (default: Folder) */
  collapsedIcon?: React.ComponentType<{ className?: string }>;
  /** Empty state content */
  emptyState?: React.ReactNode;
}

export function HierarchyBrowser<T>({
  tree,
  getHref,
  getTitle,
  isHidden,
  renderBadge,
  expandedIcon: ExpandedIcon = FolderOpen,
  collapsedIcon: CollapsedIcon = Folder,
  emptyState,
}: HierarchyBrowserProps<T>) {
  const visibleTree = isHidden
    ? tree.filter((node) => !isHidden(node.data))
    : tree;

  if (visibleTree.length === 0) {
    return (
      emptyState ?? (
        <div className="surface-well flex flex-col items-center justify-center py-16 text-center px-4">
          <FolderOpen className="h-8 w-8 text-text-disabled mb-2" />
          <h3 className="text-base font-medium font-heading text-text-secondary mb-1">
            No items found
          </h3>
          <p className="text-text-muted text-sm max-w-xs">
            Try adjusting your filters or run a library scan to discover items.
          </p>
        </div>
      )
    );
  }

  return (
    <div className="surface-well">
      {visibleTree.map((node) => (
        <TreeRow<T>
          key={getHref(node.data)}
          node={node}
          depth={0}
          getHref={getHref}
          getTitle={getTitle}
          isHidden={isHidden}
          renderBadge={renderBadge}
          expandedIcon={ExpandedIcon}
          collapsedIcon={CollapsedIcon}
        />
      ))}
    </div>
  );
}

interface TreeRowProps<T> {
  node: TreeNode<T>;
  depth: number;
  getHref: (data: T) => string;
  getTitle: (data: T) => string;
  isHidden?: (data: T) => boolean;
  renderBadge?: (data: T) => React.ReactNode;
  expandedIcon: React.ComponentType<{ className?: string }>;
  collapsedIcon: React.ComponentType<{ className?: string }>;
}

function TreeRow<T>({
  node,
  depth,
  getHref,
  getTitle,
  isHidden,
  renderBadge,
  expandedIcon: ExpandedIcon,
  collapsedIcon: CollapsedIcon,
}: TreeRowProps<T>) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  if (isHidden?.(node.data)) {
    return null;
  }

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
            className="flex h-5 w-5 items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Folder icon */}
        {expanded && hasChildren ? (
          <ExpandedIcon className="h-4 w-4 text-accent-500 flex-shrink-0" />
        ) : (
          <CollapsedIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
        )}

        {/* Title link */}
        <Link
          href={getHref(node.data)}
          className="flex-1 min-w-0 text-[0.78rem] text-text-primary hover:text-text-accent truncate transition-colors"
        >
          {getTitle(node.data)}
        </Link>

        {/* Badge */}
        {renderBadge?.(node.data)}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeRow<T>
              key={getHref(child.data)}
              node={child}
              depth={depth + 1}
              getHref={getHref}
              getTitle={getTitle}
              isHidden={isHidden}
              renderBadge={renderBadge}
              expandedIcon={ExpandedIcon}
              collapsedIcon={CollapsedIcon}
            />
          ))}
        </div>
      )}
    </div>
  );
}
