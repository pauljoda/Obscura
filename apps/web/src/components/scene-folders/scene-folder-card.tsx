"use client";

import Link from "next/link";
import { FolderOpen, HardDrive, Images } from "lucide-react";
import type { SceneFolderListItemDto } from "@obscura/contracts";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../../lib/api";
import { EntityPreviewMedia } from "../shared/entity-preview-media";
import { NsfwShowModeChip } from "../nsfw/nsfw-gate";

interface SceneFolderCardProps {
  folder: SceneFolderListItemDto;
  href: string;
  compact?: boolean;
}

export function SceneFolderCard({ folder, href, compact }: SceneFolderCardProps) {
  return (
    <Link
      href={href}
      className="group surface-card overflow-hidden transition-colors duration-fast hover:border-border-accent"
    >
      <EntityPreviewMedia
        title={folder.displayTitle}
        mode="cover-or-cycle"
        coverImage={toApiUrl(folder.coverImagePath, folder.updatedAt)}
        previewImages={folder.previewThumbnailPaths
          .map((path) => toApiUrl(path, folder.updatedAt))
          .filter(Boolean) as string[]}
        className={compact ? "aspect-video" : "aspect-[4/3]"}
      >
        <NsfwShowModeChip
          isNsfw={folder.isNsfw}
          className="absolute bottom-2 right-2 z-10 pointer-events-none"
        />
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-white/90 backdrop-blur-sm">
          <Images className="h-3 w-3" />
          {folder.visibleSfwSceneCount}
        </div>
      </EntityPreviewMedia>

      <div className={cn("px-2.5", compact ? "space-y-0.5 py-1.5" : "space-y-1.5 py-2.5")}>
        <div className="flex items-center gap-2">
          <FolderOpen className={cn("flex-shrink-0 text-text-accent", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          <h3 className={cn("truncate font-medium text-text-primary", compact ? "text-[0.75rem]" : "text-[0.82rem]")}>
            {folder.displayTitle}
          </h3>
        </div>
        <div className={cn("flex items-center gap-2 text-text-muted", compact ? "text-[0.62rem]" : "text-[0.68rem]")}>
          <span>
            {folder.visibleSfwSceneCount} scene
            {folder.visibleSfwSceneCount === 1 ? "" : "s"}
          </span>
          {folder.childFolderCount > 0 ? (
            <span>
              {folder.childFolderCount} subfolder
              {folder.childFolderCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        {!compact && folder.libraryRootLabel ? (
          <div className="flex items-center gap-1.5 text-[0.65rem] text-text-disabled">
            <HardDrive className="h-3 w-3" />
            <span className="truncate">{folder.libraryRootLabel}</span>
          </div>
        ) : null}
        {!compact && folder.containsNsfwDescendants && !folder.isNsfw ? (
          <div className="text-[0.65rem] text-text-disabled">
            Mixed-content folder
          </div>
        ) : null}
      </div>
    </Link>
  );
}
