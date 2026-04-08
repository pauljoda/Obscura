"use client";

import { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  LayoutList,
  X,
  Search,
  ChevronDown,
  Check,
  Tag,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { StudioItem, TagItem } from "../lib/api";
import { NsfwTagLabel } from "./nsfw/nsfw-gate";

export type ViewMode = "grid" | "list";
export type SortOption = "recent" | "title" | "duration" | "size" | "rating" | "date" | "plays";
export type SortDir = "asc" | "desc";

const defaultSortDir: Record<SortOption, SortDir> = {
  recent: "desc",
  title: "asc",
  duration: "desc",
  size: "desc",
  rating: "desc",
  date: "desc",
  plays: "desc",
};

interface FilterBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortOption;
  sortDir: SortDir;
  onSortChange: (sort: SortOption, dir?: SortDir) => void;
  activeFilters: { label: string; value: string }[];
  onRemoveFilter: (index: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  availableStudios?: StudioItem[];
  availableTags?: TagItem[];
  onAddFilter?: (type: string, label: string, value: string) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recently Added" },
  { value: "date", label: "Video date" },
  { value: "title", label: "Title A-Z" },
  { value: "duration", label: "Duration" },
  { value: "size", label: "File Size" },
  { value: "rating", label: "Rating" },
  { value: "plays", label: "Most Played" },
];

export function FilterBar({
  viewMode,
  onViewModeChange,
  sortBy,
  sortDir,
  onSortChange,
  activeFilters,
  onRemoveFilter,
  searchQuery,
  onSearchChange,
  availableStudios = [],
  availableTags = [],
  onAddFilter,
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

        {/* Sort dropdown + direction toggle */}
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
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setSortOpen(false)}
                />
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

          {/* Direction toggle */}
          <button
            onClick={() => onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc")}
            title={sortDir === "asc" ? "Ascending — click to reverse" : "Descending — click to reverse"}
            className={cn(
              "flex h-7 w-7 items-center justify-center ",
              "text-text-muted hover:text-text-primary hover:bg-surface-2",
              "transition-colors duration-fast"
            )}
          >
            {sortDir === "asc" ? (
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* View mode */}
        <div className="flex items-center border border-border-subtle overflow-hidden">
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
      </div>

      {/* Expandable filter panel */}
      {filterPanelOpen && (
        <div className="surface-well mt-px p-3">
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-4">
            <FilterSection title="Resolution">
              <div className="flex flex-wrap gap-1">
                {["4K", "1080p", "720p", "480p"].map((res) => (
                  <button
                    key={res}
                    onClick={() =>
                      onAddFilter?.("resolution", "Resolution", res)
                    }
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some(
                        (f) => f.label === "Resolution" && f.value === res
                      )
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent"
                    )}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </FilterSection>
            <TagFilterSection
              tags={availableTags}
              activeFilters={activeFilters}
              onAddFilter={onAddFilter}
            />
            <FilterSection title="Studio">
              <div className="flex flex-wrap gap-1">
                {availableStudios.map((studio) => (
                  <button
                    key={studio.id}
                    onClick={() =>
                      onAddFilter?.("studio", "Studio", studio.id)
                    }
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some(
                        (f) =>
                          f.label === "Studio" && f.value === studio.id
                      )
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent"
                    )}
                  >
                    {studio.name}
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

function TagFilterSection({
  tags,
  activeFilters,
  onAddFilter,
}: {
  tags: TagItem[];
  activeFilters: { label: string; value: string }[];
  onAddFilter?: (type: string, label: string, value: string) => void;
}) {
  const [tagSearch, setTagSearch] = useState("");

  const filteredTags = useMemo(() => {
    const withScenes = tags.filter((t) => t.sceneCount > 0);
    if (!tagSearch.trim()) return withScenes;
    const q = tagSearch.toLowerCase();
    return withScenes.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, tagSearch]);

  // Group alphabetically when we have many tags
  const grouped = useMemo(() => {
    if (filteredTags.length <= 24) return null;
    const groups: Record<string, TagItem[]> = {};
    for (const tag of filteredTags) {
      const letter = tag.name[0]?.toUpperCase() || "#";
      (groups[letter] ??= []).push(tag);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTags]);

  const totalWithScenes = tags.filter((t) => t.sceneCount > 0).length;
  const showSearch = totalWithScenes > 12;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-kicker">Tags</div>
        <span className="text-[0.6rem] font-mono text-text-disabled tabular-nums">
          {filteredTags.length !== totalWithScenes
            ? `${filteredTags.length} / ${totalWithScenes}`
            : totalWithScenes}
        </span>
      </div>

      {/* Tag search — only shown when there are enough tags to warrant it */}
      {showSearch && (
        <div className="relative mb-2">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-disabled pointer-events-none" />
          <input
            type="text"
            placeholder="Filter tags..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            className={cn(
              "w-full bg-surface-1 border border-border-subtle ",
              "pl-6 pr-2 py-1 text-[0.7rem] text-text-primary",
              "placeholder:text-text-disabled",
              "focus:outline-none focus:border-border-accent",
              "transition-colors duration-fast"
            )}
          />
          {tagSearch && (
            <button
              onClick={() => setTagSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Scrollable tag list */}
      <div className="max-h-48 overflow-y-auto tag-scroll-area">
        {filteredTags.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-[0.68rem] text-text-disabled">
            <Tag className="h-3 w-3 mr-1.5 opacity-50" />
            {tagSearch ? "No matching tags" : "No tags available"}
          </div>
        ) : grouped ? (
          /* Alphabetically grouped layout for large lists */
          <div className="space-y-2">
            {grouped.map(([letter, letterTags]) => (
              <div key={letter}>
                <div className="sticky top-0 z-10 text-[0.55rem] font-mono font-semibold text-text-disabled uppercase tracking-widest px-0.5 py-0.5 bg-surface-2/90 backdrop-blur-sm border-b border-border-subtle mb-1">
                  {letter}
                </div>
                <div className="flex flex-wrap gap-1">
                  {letterTags.map((tag) => (
                    <TagChipButton
                      key={tag.id}
                      tag={tag}
                      active={activeFilters.some(
                        (f) => f.label === "Tag" && f.value === tag.name
                      )}
                      onClick={() => onAddFilter?.("tag", "Tag", tag.name)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat layout for smaller lists */
          <div className="flex flex-wrap gap-1">
            {filteredTags.map((tag) => (
              <TagChipButton
                key={tag.id}
                tag={tag}
                active={activeFilters.some(
                  (f) => f.label === "Tag" && f.value === tag.name
                )}
                onClick={() => onAddFilter?.("tag", "Tag", tag.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TagChipButton({
  tag,
  active,
  onClick,
}: {
  tag: TagItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "tag-chip cursor-pointer transition-colors duration-fast",
        active
          ? "tag-chip-info"
          : "tag-chip-default hover:tag-chip-info"
      )}
    >
      <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
      <span className="text-text-disabled ml-1">{tag.sceneCount}</span>
    </button>
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
