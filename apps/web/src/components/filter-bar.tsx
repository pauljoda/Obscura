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
  RotateCcw,
  Users,
  CalendarRange,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { PerformerItem, StudioItem, TagItem } from "../lib/api";
import { NsfwTagLabel, tagsVisibleInNsfwMode } from "./nsfw/nsfw-gate";
import { useNsfw } from "./nsfw/nsfw-context";
import type { SortDir, SortOption, ViewMode } from "../lib/scene-browse-types";

export type { SortDir, SortOption, ViewMode } from "../lib/scene-browse-types";

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
  activeFilters: { label: string; value: string; type?: string }[];
  onRemoveFilter: (index: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  availableStudios?: StudioItem[];
  availableTags?: TagItem[];
  /** Performers with at least one scene (for NSFW-aware filtering). */
  availablePerformers?: PerformerItem[];
  onAddFilter?: (type: string, label: string, value: string) => void;
  onClearFiltersAndSort?: () => void;
  canClearFiltersAndSort?: boolean;
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
  availablePerformers = [],
  onAddFilter,
  onClearFiltersAndSort,
  canClearFiltersAndSort = false,
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

      {/* Expandable filter panel */}
      {filterPanelOpen && (
        <div className="surface-well mt-px p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <FilterSection title="Resolution">
              <div className="flex flex-wrap gap-1">
                {["4K", "1080p", "720p", "480p"].map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => onAddFilter?.("resolution", "Resolution", res)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.type === "resolution" && f.value === res)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Rating">
              <div className="space-y-2">
                <div className="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled">
                  At least
                </div>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={`min-${n}`}
                      type="button"
                      onClick={() =>
                        onAddFilter?.("ratingMin", "Min rating", String(n))
                      }
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
                      key={`max-${n}`}
                      type="button"
                      onClick={() =>
                        onAddFilter?.("ratingMax", "Max rating", String(n))
                      }
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
            </FilterSection>

            <FilterSection title="Video date">
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
            </FilterSection>

            <FilterSection title="Duration">
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: "lt300", label: "< 5 min" },
                    { id: "300-900", label: "5–15 min" },
                    { id: "900-1800", label: "15–30 min" },
                    { id: "gte1800", label: "30+ min" },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onAddFilter?.("duration", "Duration", d.id)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.type === "duration" && f.value === d.id)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Playback & file">
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => onAddFilter?.("played", "Playback", "true")}
                  className={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    activeFilters.some((f) => f.type === "played" && f.value === "true")
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  Played
                </button>
                <button
                  type="button"
                  onClick={() => onAddFilter?.("played", "Playback", "false")}
                  className={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    activeFilters.some((f) => f.type === "played" && f.value === "false")
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  Unplayed
                </button>
                <button
                  type="button"
                  onClick={() => onAddFilter?.("hasFile", "File", "true")}
                  className={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    activeFilters.some((f) => f.type === "hasFile" && f.value === "true")
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  Has file
                </button>
                <button
                  type="button"
                  onClick={() => onAddFilter?.("hasFile", "File", "false")}
                  className={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    activeFilters.some((f) => f.type === "hasFile" && f.value === "false")
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  No file
                </button>
              </div>
            </FilterSection>

            <FilterSection title="Library flags">
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
                  Organized
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
                  Not organized
                </button>
                <button
                  type="button"
                  onClick={() => onAddFilter?.("interactive", "Interactive", "true")}
                  className={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    activeFilters.some((f) => f.type === "interactive" && f.value === "true")
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  Interactive
                </button>
                <button
                  type="button"
                  onClick={() => onAddFilter?.("interactive", "Interactive", "false")}
                  className={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    activeFilters.some((f) => f.type === "interactive" && f.value === "false")
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  Not interactive
                </button>
              </div>
            </FilterSection>

            <FilterSection title="Codec">
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: "h264", label: "H.264" },
                    { id: "hevc", label: "HEVC" },
                    { id: "av1", label: "AV1" },
                    { id: "vp9", label: "VP9" },
                    { id: "vp8", label: "VP8" },
                    { id: "mpeg4", label: "MPEG-4" },
                    { id: "prores", label: "ProRes" },
                    { id: "wmv", label: "WMV" },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onAddFilter?.("codec", "Codec", c.id)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.type === "codec" && f.value === c.id)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </FilterSection>

            <div className="md:col-span-2 xl:col-span-3">
              <TagFilterSection
                tags={availableTags}
                activeFilters={activeFilters}
                onAddFilter={onAddFilter}
              />
            </div>

            {availablePerformers.length > 0 && (
              <div className="md:col-span-2 xl:col-span-3">
                <PerformerFilterSection
                  performers={availablePerformers}
                  activeFilters={activeFilters}
                  onAddFilter={onAddFilter}
                />
              </div>
            )}

            <div className="md:col-span-2 xl:col-span-1">
              <FilterSection title="Studio">
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto tag-scroll-area">
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
              </FilterSection>
            </div>
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
  activeFilters: { label: string; value: string; type?: string }[];
  onAddFilter?: (type: string, label: string, value: string) => void;
}) {
  const { mode: nsfwMode } = useNsfw();
  const [tagSearch, setTagSearch] = useState("");

  const filteredTags = useMemo(() => {
    const visible = tagsVisibleInNsfwMode(tags, nsfwMode);
    const withScenes = visible.filter((t) => t.sceneCount > 0);
    if (!tagSearch.trim()) return withScenes;
    const q = tagSearch.toLowerCase();
    return withScenes.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, tagSearch, nsfwMode]);

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

  const totalWithScenes = tagsVisibleInNsfwMode(tags, nsfwMode).filter(
    (t) => t.sceneCount > 0,
  ).length;
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
                        (f) => (f.type === "tag" || f.label === "Tag") && f.value === tag.name,
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
                  (f) => (f.type === "tag" || f.label === "Tag") && f.value === tag.name,
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

function PerformerFilterSection({
  performers,
  activeFilters,
  onAddFilter,
}: {
  performers: PerformerItem[];
  activeFilters: { label: string; value: string; type?: string }[];
  onAddFilter?: (type: string, label: string, value: string) => void;
}) {
  const { mode: nsfwMode } = useNsfw();
  const [perfSearch, setPerfSearch] = useState("");

  const filteredPerformers = useMemo(() => {
    const visible = tagsVisibleInNsfwMode(performers, nsfwMode).filter((p) => p.sceneCount > 0);
    if (!perfSearch.trim()) return visible;
    const q = perfSearch.toLowerCase();
    return visible.filter((p) => p.name.toLowerCase().includes(q));
  }, [performers, nsfwMode, perfSearch]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-kicker">
          <Users className="h-3 w-3 text-text-disabled" />
          Performers
        </div>
        <span className="text-[0.6rem] font-mono text-text-disabled tabular-nums">
          {filteredPerformers.length}
        </span>
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-disabled pointer-events-none" />
        <input
          type="text"
          placeholder="Filter performers..."
          value={perfSearch}
          onChange={(e) => setPerfSearch(e.target.value)}
          className={cn(
            "w-full bg-surface-1 border border-border-subtle ",
            "pl-6 pr-2 py-1 text-[0.7rem] text-text-primary",
            "placeholder:text-text-disabled",
            "focus:outline-none focus:border-border-accent",
            "transition-colors duration-fast",
          )}
        />
        {perfSearch ? (
          <button
            type="button"
            onClick={() => setPerfSearch("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      <div className="max-h-40 overflow-y-auto tag-scroll-area flex flex-wrap gap-1">
        {filteredPerformers.length === 0 ? (
          <div className="flex items-center py-3 text-[0.68rem] text-text-disabled w-full justify-center">
            <Users className="h-3 w-3 mr-1.5 opacity-50" />
            {perfSearch ? "No matching performers" : "No performers"}
          </div>
        ) : (
          filteredPerformers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAddFilter?.("performer", "Performer", p.name)}
              className={cn(
                "tag-chip cursor-pointer transition-colors duration-fast",
                activeFilters.some((f) => f.type === "performer" && f.value === p.name)
                  ? "tag-chip-info"
                  : "tag-chip-default hover:tag-chip-info",
              )}
            >
              <NsfwTagLabel isNsfw={p.isNsfw}>{p.name}</NsfwTagLabel>
              <span className="text-text-disabled ml-1">{p.sceneCount}</span>
            </button>
          ))
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
