"use client";

import Link from "next/link";
import { Check, Film, Image, Tag } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { TagCardData } from "./tag-card-data";
import { NsfwBlur, NsfwShowModeChip, NsfwTagLabel } from "../nsfw/nsfw-gate";

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
    const total = tag.videoCount + tag.imageCount;
    const intensity = total / Math.max(1, maxCount);

    return (
      <Link
        href={tag.href}
        className={cn(
          "inline-flex max-w-full min-w-0 items-center gap-1.5 border px-2.5 py-1 transition-all duration-fast",
          "hover:border-border-accent hover:bg-accent-950 hover:text-text-accent hover:shadow-[0_0_12px_rgba(199,155,92,0.15)]",
          intensity > 0.6
            ? "border-border-accent text-accent-400 text-base font-medium bg-accent-950/30"
            : intensity > 0.3
              ? "border-border-default text-text-secondary text-sm"
              : "border-border-subtle text-text-muted text-xs",
        )}
      >
        <span className="min-w-0 truncate">
          <NsfwTagLabel isNsfw={tag.isNsfw ?? false}>{tag.name}</NsfwTagLabel>
        </span>
        <NsfwShowModeChip isNsfw={tag.isNsfw} compact className="shrink-0" />
        <span className="shrink-0 text-text-disabled text-xs tabular-nums">{total}</span>
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
        "group flex w-full min-w-0 items-center gap-2.5 px-3 py-2",
        "border border-transparent hover:border-border-accent/30",
        "bg-surface-1 hover:bg-surface-2 hover:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)]",
        "transition-all duration-fast break-inside-avoid mb-1",
        selected && "border-border-accent bg-accent-950/20 shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)]"
      )}
    >
      {onToggleSelect && (
        <div 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(tag.id); }}
          className={cn(
            "flex items-center justify-center h-4 w-4 border transition-colors duration-fast cursor-pointer shrink-0",
            selected 
              ? "border-border-accent bg-accent-500 text-surface-1 shadow-[0_0_6px_rgba(199,155,92,0.4)]" 
              : "border-border-subtle bg-surface-3 text-transparent group-hover:border-border-default",
            !selected && "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </div>
      )}
      {tag.imagePath && (
        <NsfwBlur isNsfw={tag.isNsfw ?? false} className="flex-shrink-0 w-8 h-5 overflow-hidden bg-surface-3 shadow-well">
          <div className="flex-shrink-0 w-8 h-5 overflow-hidden bg-surface-3">
            <img src={tag.imagePath} alt="" className="w-full h-full object-cover" />
          </div>
        </NsfwBlur>
      )}
      <span className={cn(
        "min-w-0 flex-1 truncate text-[0.8rem] transition-colors duration-fast",
        selected ? "text-text-primary font-medium" : "text-text-secondary group-hover:text-text-primary"
      )}>
        <NsfwTagLabel isNsfw={tag.isNsfw ?? false}>{tag.name}</NsfwTagLabel>
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <NsfwShowModeChip isNsfw={tag.isNsfw} compact />
        <span className="flex items-center gap-2 text-[0.65rem] font-mono text-text-disabled">
        {tag.videoCount > 0 && (
          <span className="flex items-center gap-1">
            <Film className="h-2.5 w-2.5 opacity-70" />
            {tag.videoCount}
          </span>
        )}
        {tag.imageCount > 0 && (
          <span className="flex items-center gap-1">
            <Image className="h-2.5 w-2.5 opacity-70" />
            {tag.imageCount}
          </span>
        )}
        {tag.videoCount + tag.imageCount === 0 && <span className="text-text-disabled/40">—</span>}
        </span>
      </div>
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
  const total = tag.videoCount + tag.imageCount;
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
