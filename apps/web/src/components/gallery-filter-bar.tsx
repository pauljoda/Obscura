"use client";

import { useState } from "react";
import {
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  LayoutList,
  FolderTree,
  CalendarDays,
  CalendarRange,
  X,
  Search,
  ChevronDown,
  Check,
  RotateCcw,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { StudioItem, TagItem } from "../lib/api";
import { NsfwTagLabel, tagsVisibleInNsfwMode } from "./nsfw/nsfw-gate";
import { useNsfw } from "./nsfw/nsfw-context";
import type { GallerySortOption, GalleryViewMode, SortDir } from "../lib/gallery-browse-types";

export type { GallerySortOption, GalleryViewMode, SortDir } from "../lib/gallery-browse-types";

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
  activeFilters: { label: string; value: string; type?: string }[];
  onRemoveFilter: (index: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  availableStudios?: StudioItem[];
  availableTags?: TagItem[];
  /** When empty, studio row is omitted. */
  showStudioFilter?: boolean;
  onAddFilter?: (type: string, label: string, value: string) => void;
  /** Reset sort, search, tag/type filters, and view mode; clears saved cookie on parent. */
  onClearFiltersAndSort?: () => void;
  canClearFiltersAndSort?: boolean;
}

const viewModes: { mode: GalleryViewMode; Icon: typeof LayoutGrid; title: string }[] = [
  { mode: "grid", Icon: LayoutGrid, title: "Grid" },
  { mode: "list", Icon: LayoutList, title: "List" },
  { mode: "browser", Icon: FolderTree, title: "Browser" },
  { mode: "timeline", Icon: CalendarDays, title: "Timeline" },
];

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
  showStudioFilter = true,
  onAddFilter,
  onClearFiltersAndSort,
  canClearFiltersAndSort = false,
}: GalleryFilterBarProps) {
  const { mode: nsfwMode } = useNsfw();
  const galleryFilterTagsVisible = tagsVisibleInNsfwMode(availableTags, nsfwMode);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const currentSort = sortOptions.find((s) => s.value === sortBy);

  return (
    <div className="space-y-0">
      {/* Search row — full width on mobile */}
      <div className="surface-well flex items-center gap-2 px-3 py-2">
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

        {/* Active filter chips — desktop only inline */}
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
      </div>

      {/* Controls row — sort, view modes, filters */}
      <div className="surface-well mt-px flex items-center gap-2 px-3 py-1.5">
        {/* Sort dropdown + direction */}
        <div className="flex items-center">
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5",
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
                <div className="absolute left-0 top-full mt-1 z-50 w-44 surface-elevated py-1">
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
              "flex h-7 w-7 items-center justify-center ",
              "text-text-muted hover:text-text-primary hover:bg-surface-2",
              "transition-colors duration-fast"
            )}
          >
            <ChevronDown className={cn("h-3.5 w-3.5", sortDir === "asc" && "rotate-180")} />
          </button>
        </div>

        <div className="flex-1" />

        {/* View modes */}
        <div className="flex items-center border border-border-subtle overflow-hidden">
          {viewModes.map(({ mode, Icon, title }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              title={title}
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
            "flex items-center gap-1.5 px-2 py-1.5",
            "text-[0.72rem] transition-colors duration-fast",
            filterPanelOpen
              ? "text-text-accent bg-accent-950"
              : "text-text-muted hover:text-text-primary hover:bg-surface-2"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilters.length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center bg-accent-800 text-[0.55rem] font-bold text-accent-200">
              {activeFilters.length}
            </span>
          )}
        </button>

        {canClearFiltersAndSort && onClearFiltersAndSort && (
          <button
            type="button"
            onClick={onClearFiltersAndSort}
            title="Clear filters, sort, search, and saved preferences"
            className={cn(
              "flex items-center gap-1 px-2 py-1.5",
              "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
              "transition-colors duration-fast"
            )}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Filter panel */}
      {filterPanelOpen && (
        <div className="surface-well mt-px p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <div className="text-kicker mb-2">Gallery Type</div>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: "folder", label: "Folder" },
                  { value: "zip", label: "Zip/CBZ" },
                  { value: "virtual", label: "Manual" },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => onAddFilter?.("type", "Type", type.value)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.type === "type" && f.value === type.value)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-kicker mb-2">Rating</div>
              <div className="space-y-2">
                <div className="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled">
                  At least
                </div>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={`g-min-${n}`}
                      type="button"
                      onClick={() => onAddFilter?.("ratingMin", "Min rating", String(n))}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        activeFilters.some((f) => f.type === "ratingMin" && f.value === String(n))
                          ? "tag-chip-accent"
                          : "tag-chip-default hover:tag-chip-accent",
                      )}
                    >
                      {n}★+
                    </button>
                  ))}
                </div>
                <div className="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled">
                  At most
                </div>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={`g-max-${n}`}
                      type="button"
                      onClick={() => onAddFilter?.("ratingMax", "Max rating", String(n))}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        activeFilters.some((f) => f.type === "ratingMax" && f.value === String(n))
                          ? "tag-chip-accent"
                          : "tag-chip-default hover:tag-chip-accent",
                      )}
                    >
                      ≤{n}★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="text-kicker mb-2">Gallery date</div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[0.7rem] text-text-muted">
                  <CalendarRange className="h-3 w-3 shrink-0 text-text-disabled" />
                  <span className="font-mono text-[0.6rem] uppercase tracking-wider">From</span>
                  <input
                    type="date"
                    className="flex-1 min-w-0 bg-surface-1 border border-border-subtle px-2 py-1 text-[0.72rem] text-text-primary focus:outline-none focus:border-border-accent"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) onAddFilter?.("dateFrom", "Date from", v);
                    }}
                  />
                </label>
                <label className="flex items-center gap-2 text-[0.7rem] text-text-muted">
                  <CalendarRange className="h-3 w-3 shrink-0 text-text-disabled" />
                  <span className="font-mono text-[0.6rem] uppercase tracking-wider">To</span>
                  <input
                    type="date"
                    className="flex-1 min-w-0 bg-surface-1 border border-border-subtle px-2 py-1 text-[0.72rem] text-text-primary focus:outline-none focus:border-border-accent"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) onAddFilter?.("dateTo", "Date to", v);
                    }}
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="text-kicker mb-2">Image count</div>
              <div className="flex flex-wrap gap-1">
                {[
                  { v: "1", label: "1+" },
                  { v: "5", label: "5+" },
                  { v: "10", label: "10+" },
                  { v: "25", label: "25+" },
                  { v: "50", label: "50+" },
                ].map((x) => (
                  <button
                    key={x.v}
                    type="button"
                    onClick={() => onAddFilter?.("imageCountMin", "Min images", x.v)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.type === "imageCountMin" && f.value === x.v)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-kicker mb-2">Organized</div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => onAddFilter?.("organized", "Organized", "true")}
                  className={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    activeFilters.some((f) => f.type === "organized" && f.value === "true")
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => onAddFilter?.("organized", "Organized", "false")}
                  className={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    activeFilters.some((f) => f.type === "organized" && f.value === "false")
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  No
                </button>
              </div>
            </div>

            {showStudioFilter && availableStudios.length > 0 && (
              <div className="md:col-span-2 xl:col-span-1">
                <div className="text-kicker mb-2">Studio</div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto tag-scroll-area">
                  {availableStudios.map((studio) => (
                    <button
                      key={studio.id}
                      type="button"
                      onClick={() => onAddFilter?.("studio", "Studio", studio.id)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        activeFilters.some((f) => f.type === "studio" && f.value === studio.id)
                          ? "tag-chip-accent"
                          : "tag-chip-default hover:tag-chip-accent",
                      )}
                    >
                      {studio.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {galleryFilterTagsVisible.length > 0 && (
              <div className="md:col-span-2 xl:col-span-3">
                <div className="text-kicker mb-2">Tags</div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {galleryFilterTagsVisible.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onAddFilter?.("tag", "Tag", tag.name)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        activeFilters.some((f) => f.type === "tag" && f.value === tag.name)
                          ? "tag-chip-info"
                          : "tag-chip-default hover:tag-chip-info",
                      )}
                    >
                      <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
