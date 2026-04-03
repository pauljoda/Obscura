"use client";

import { useState } from "react";
import {
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  LayoutList,
  X,
  Search,
  ChevronDown,
  Check,
} from "lucide-react";
import { cn } from "@obscura/ui";

export type ViewMode = "grid" | "list";
export type SortOption = "recent" | "title" | "duration" | "size" | "rating";

interface FilterBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  activeFilters: { label: string; value: string }[];
  onRemoveFilter: (index: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recently Added" },
  { value: "title", label: "Title A-Z" },
  { value: "duration", label: "Duration" },
  { value: "size", label: "File Size" },
  { value: "rating", label: "Rating" },
];

export function FilterBar({
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  activeFilters,
  onRemoveFilter,
  searchQuery,
  onSearchChange,
}: FilterBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const currentSort = sortOptions.find((s) => s.value === sortBy);

  return (
    <div className="space-y-0">
      {/* Main toolbar */}
      <div className="surface-well flex items-center gap-2 px-3 py-2">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none" />
          <input
            type="text"
            placeholder="Search scenes..."
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
              <FilterChip
                key={i}
                label={filter.label}
                value={filter.value}
                onRemove={() => onRemoveFilter(i)}
              />
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="h-5 w-px bg-border-subtle" />

        {/* Sort dropdown */}
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
              <div
                className="fixed inset-0 z-40"
                onClick={() => setSortOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-44 surface-elevated py-1">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onSortChange(opt.value);
                      setSortOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 text-[0.72rem] text-left transition-colors duration-fast",
                      sortBy === opt.value
                        ? "text-text-accent bg-accent-950"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-3"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3 w-3",
                        sortBy === opt.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* View mode */}
        <div className="flex items-center rounded-sm border border-border-subtle overflow-hidden">
          <button
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
              viewMode === "grid"
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
              viewMode === "list"
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2"
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
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

      {/* Expandable filter panel */}
      {filterPanelOpen && (
        <div className="surface-well mt-px p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FilterSection title="Resolution">
              <div className="flex flex-wrap gap-1">
                {["4K", "1080p", "720p", "480p"].map((res) => (
                  <button
                    key={res}
                    className="tag-chip tag-chip-default hover:tag-chip-accent transition-colors duration-fast cursor-pointer"
                  >
                    {res}
                  </button>
                ))}
              </div>
            </FilterSection>
            <FilterSection title="Tags">
              <div className="flex flex-wrap gap-1">
                {["Outdoor", "Interview", "BTS", "Solo", "Group", "POV"].map(
                  (tag) => (
                    <button
                      key={tag}
                      className="tag-chip tag-chip-default hover:tag-chip-info transition-colors duration-fast cursor-pointer"
                    >
                      {tag}
                    </button>
                  )
                )}
              </div>
            </FilterSection>
            <FilterSection title="Studio">
              <div className="flex flex-wrap gap-1">
                {["Studio Alpha", "Studio Beta", "Studio Gamma"].map((s) => (
                  <button
                    key={s}
                    className="tag-chip tag-chip-default hover:tag-chip-accent transition-colors duration-fast cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </FilterSection>
          </div>
        </div>
      )}

      {/* Mobile active filters row */}
      {activeFilters.length > 0 && (
        <div className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hidden">
          {activeFilters.map((filter, i) => (
            <FilterChip
              key={i}
              label={filter.label}
              value={filter.value}
              onRemove={() => onRemoveFilter(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-kicker mb-2">{title}</div>
      {children}
    </div>
  );
}

function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap">
      <span className="text-accent-400/70">{label}:</span>
      <span className="text-accent-200">{value}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
