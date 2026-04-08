"use client";

import Link from "next/link";
import { Film, Image, Tag } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { TagCardData } from "./tag-card-data";
import { NsfwBlur, NsfwTagLabel } from "../nsfw/nsfw-gate";

interface TagEntityCardProps {
  tag: TagCardData;
  variant?: "list" | "cloud" | "compact";
  maxCount?: number;
  onSelect?: (href: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function TagEntityCard({
  tag,
  variant = "list",
  maxCount = 1,
  onSelect,
  selected,
  onToggleSelect,
}: TagEntityCardProps) {
  if (variant === "cloud") {
    const total = tag.sceneCount + tag.imageCount;
    const intensity = total / Math.max(1, maxCount);

    return (
      <Link
        href={tag.href}
        className={cn(
          "border px-2.5 py-1 transition-all duration-fast",
          "hover:border-border-accent hover:bg-accent-950 hover:text-text-accent hover:shadow-[0_0_12px_rgba(199,155,92,0.15)]",
          intensity > 0.6
            ? "border-border-accent text-accent-400 text-base font-medium bg-accent-950/30"
            : intensity > 0.3
              ? "border-border-default text-text-secondary text-sm"
              : "border-border-subtle text-text-muted text-xs",
        )}
      >
        <NsfwTagLabel isNsfw={tag.isNsfw ?? false}>{tag.name}</NsfwTagLabel>
        <span className="ml-1.5 text-text-disabled text-xs">{total}</span>
      </Link>
    );
  }

  if (variant === "compact") {
    return <TagCompactCard tag={tag} onSelect={onSelect} />;
  }

  return (
    <Link
      href={tag.href}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5",
        "border-b border-border-subtle/50",
        "hover:bg-surface-2 hover:text-text-accent transition-colors duration-fast",
        "break-inside-avoid",
      )}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.preventDefault(); onToggleSelect(tag.id); }}
          className="accent-[#c79b5c] h-3.5 w-3.5 cursor-pointer flex-shrink-0"
        />
      )}
      {tag.imagePath && (
        <NsfwBlur isNsfw={tag.isNsfw ?? false} className="flex-shrink-0 w-8 h-5 overflow-hidden bg-surface-3">
          <div className="flex-shrink-0 w-8 h-5 overflow-hidden bg-surface-3">
            <img src={tag.imagePath} alt="" className="w-full h-full object-cover" />
          </div>
        </NsfwBlur>
      )}
      <span className="text-[0.8rem] text-text-primary truncate flex-1">
        <NsfwTagLabel isNsfw={tag.isNsfw ?? false}>{tag.name}</NsfwTagLabel>
      </span>
      <span className="flex items-center gap-2 shrink-0 text-[0.65rem] font-mono text-text-disabled">
        {tag.sceneCount > 0 && (
          <span className="flex items-center gap-0.5">
            <Film className="h-2.5 w-2.5" />
            {tag.sceneCount}
          </span>
        )}
        {tag.imageCount > 0 && (
          <span className="flex items-center gap-0.5">
            <Image className="h-2.5 w-2.5" />
            {tag.imageCount}
          </span>
        )}
        {tag.sceneCount + tag.imageCount === 0 && <span className="text-text-disabled/50">—</span>}
      </span>
    </Link>
  );
}

function TagCompactCard({
  tag,
  onSelect,
}: {
  tag: TagCardData;
  onSelect?: (href: string) => void;
}) {
  const total = tag.sceneCount + tag.imageCount;
  const content = (
    <>
      <div className="shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-8 ">
        {tag.imagePath ? (
          <img src={tag.imagePath} alt="" className="h-full w-full object-cover" />
        ) : (
          <Tag className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">
          <NsfwTagLabel isNsfw={tag.isNsfw ?? false}>{tag.name}</NsfwTagLabel>
        </div>
        <div className="text-[0.68rem] text-text-muted truncate">
          {total} item{total !== 1 ? "s" : ""}
        </div>
      </div>
      <span className="shrink-0 tag-chip tag-chip-default text-[0.6rem]">tag</span>
    </>
  );

  if (onSelect) {
    return (
      <button
        onClick={() => onSelect(tag.href)}
        className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={tag.href}
      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
    >
      {content}
    </Link>
  );
}
