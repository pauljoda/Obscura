"use client";

import { useState } from "react";
import {
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  LayoutList,
  FolderTree,
  CalendarDays,
  X,
  Search,
  ChevronDown,
  Check,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { StudioItem, TagItem } from "../lib/api";

export type GalleryViewMode = "grid" | "list" | "browser" | "timeline";
export type GallerySortOption = "recent" | "title" | "date" | "rating" | "imageCount" | "created";
export type SortDir = "asc" | "desc";

const defaultSortDir: Record<GallerySortOption, SortDir> = {
  recent: "desc",
  title: "asc",
  date: "desc",
  rating: "desc",
  imageCount: "desc",
  created: "desc",
};

const sortOptions: { value: GallerySortOption; label: string }[] = [
  { value: "recent", label: "Recently Added" },
  { value: "date", label: "Date" },
  { value: "title", label: "Title A-Z" },
  { value: "rating", label: "Rating" },
  { value: "imageCount", label: "Image Count" },
];

interface GalleryFilterBarProps {
  viewMode: GalleryViewMode;
  onViewModeChange: (mode: GalleryViewMode) => void;
  sortBy: GallerySortOption;
  sortDir: SortDir;
  onSortChange: (sort: GallerySortOption, dir?: SortDir) => void;
  activeFilters: { label: string; value: string }[];
  onRemoveFilter: (index: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  availableStudios?: StudioItem[];
  availableTags?: TagItem[];
  onAddFilter?: (type: string, label: string, value: string) => void;
}

export function GalleryFilterBar({
  viewMode,
  onViewModeChange,
  sortBy,
  sortDir,
  onSortChange,
  activeFilters,
  onRemoveFilter,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search galleries...",
  availableStudios = [],
  availableTags = [],
  onAddFilter,
}: GalleryFilterBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const currentSort = sortOptions.find((s) => s.value === sortBy);

  return (
    <div className="space-y-0">
      <div className="surface-well flex items-center gap-2 px-3 py-2">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full bg-transparent pl-7 pr-3 py-1.5 text-[0.78rem] text-text-primary",
              "placeholder:text-text-disabled",
              "focus:outline-none",
              "transition-colors duration-fast"
            )}
          />
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 border-l border-border-subtle pl-2">
            {activeFilters.map((filter, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap"
              >
                <span className="text-accent-400/70">{filter.label}:</span>
                <span className="text-accent-200">{filter.value}</span>
                <button
                  onClick={() => onRemoveFilter(i)}
                  className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="h-5 w-px bg-border-subtle" />

        {/* Sort dropdown */}
        <div className="flex items-center">
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-2 py-1.5",
                "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
                "transition-colors duration-fast"
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{currentSort?.label}</span>
              <ChevronDown className="h-3 w-3 text-text-disabled" />
            </button>

            {sortOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 surface-elevated py-1">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        onSortChange(opt.value, defaultSortDir[opt.value]);
                        setSortOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-1.5 text-[0.72rem] text-left transition-colors duration-fast",
                        sortBy === opt.value
                          ? "text-text-accent bg-accent-950"
                          : "text-text-muted hover:text-text-primary hover:bg-surface-3"
                      )}
                    >
                      <Check className={cn("h-3 w-3", sortBy === opt.value ? "opacity-100" : "opacity-0")} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc")}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-sm",
              "text-text-muted hover:text-text-primary hover:bg-surface-2",
              "transition-colors duration-fast"
            )}
          >
            <ChevronDown className={cn("h-3.5 w-3.5", sortDir === "asc" && "rotate-180")} />
          </button>
        </div>

        {/* 4 View modes */}
        <div className="flex items-center rounded-sm border border-border-subtle overflow-hidden">
          {([
            { mode: "grid" as const, Icon: LayoutGrid },
            { mode: "list" as const, Icon: LayoutList },
            { mode: "browser" as const, Icon: FolderTree },
            { mode: "timeline" as const, Icon: CalendarDays },
          ]).map(({ mode, Icon }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                viewMode === mode
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* Filter panel toggle */}
        <button
          onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-2 py-1.5",
            "text-[0.72rem] transition-colors duration-fast",
            filterPanelOpen
              ? "text-text-accent bg-accent-950"
              : "text-text-muted hover:text-text-primary hover:bg-surface-2"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilters.length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-accent-800 text-[0.55rem] font-bold text-accent-200">
              {activeFilters.length}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {filterPanelOpen && (
        <div className="surface-well mt-px p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Type */}
            <div>
              <div className="text-kicker mb-2">Type</div>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: "folder", label: "Folder" },
                  { value: "zip", label: "Zip/CBZ" },
                  { value: "virtual", label: "Manual" },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => onAddFilter?.("type", "Type", type.value)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.label === "Type" && f.value === type.value)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="text-kicker mb-2">Tags</div>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => onAddFilter?.("tag", "Tag", tag.name)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.label === "Tag" && f.value === tag.name)
                        ? "tag-chip-info"
                        : "tag-chip-default hover:tag-chip-info"
                    )}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Studios */}
            <div>
              <div className="text-kicker mb-2">Studio</div>
              <div className="flex flex-wrap gap-1">
                {availableStudios.map((studio) => (
                  <button
                    key={studio.id}
                    onClick={() => onAddFilter?.("studio", "Studio", studio.id)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.label === "Studio" && f.value === studio.id)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent"
                    )}
                  >
                    {studio.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile active filters */}
      {activeFilters.length > 0 && (
        <div className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hidden">
          {activeFilters.map((filter, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap"
            >
              <span className="text-accent-400/70">{filter.label}:</span>
              <span className="text-accent-200">{filter.value}</span>
              <button
                onClick={() => onRemoveFilter(i)}
                className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
