"use client";

import { SlidersHorizontal, ArrowUpDown, LayoutGrid, LayoutList, X } from "lucide-react";
import { cn } from "@obscura/ui";

export function FilterBar() {
  return (
    <div className="surface-well flex items-center gap-3 px-3 py-2">
      {/* Active filters area */}
      <div className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hidden">
        <span className="text-text-disabled text-sm whitespace-nowrap">
          Add filters...
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 border-l border-border-subtle pl-3">
        {/* Sort */}
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1.5",
            "text-text-muted text-xs hover:text-text-primary hover:bg-surface-2",
            "transition-colors duration-fast"
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Recent</span>
        </button>

        {/* View mode */}
        <div className="flex items-center rounded-md border border-border-subtle">
          <button className="flex h-7 w-7 items-center justify-center text-text-accent bg-accent-950 rounded-l-md">
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-7 w-7 items-center justify-center text-text-muted hover:text-text-primary rounded-r-md transition-colors duration-fast">
            <LayoutList className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Filter panel toggle */}
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1.5",
            "text-text-muted text-xs hover:text-text-primary hover:bg-surface-2",
            "transition-colors duration-fast"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filter</span>
        </button>
      </div>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  value: string;
  onRemove?: () => void;
}

export function FilterChip({ label, value, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border-accent bg-accent-950 px-2 py-1 text-xs">
      <span className="text-text-muted">{label}:</span>
      <span className="text-text-primary">{value}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 text-text-muted hover:text-text-accent transition-colors duration-fast"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
