"use client";

import { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  LayoutList,
  FolderOpen,
  Search,
  ChevronDown,
  Check,
  Tag,
  RotateCcw,
  Users,
  CalendarRange,
  Building2,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { PerformerItem, StudioItem, TagItem } from "../lib/api";
import { useNsfw } from "./nsfw/nsfw-context";
import { tagsVisibleInNsfwMode } from "./nsfw/nsfw-gate";
import type { SortDir, SortOption, ViewMode } from "../lib/scene-browse-types";
import { FilterSection } from "./filters/filter-section";
import { FilterChip } from "./filters/filter-chip";
import {
  AlphabeticalFilterSection,
  type AlphabeticalFilterSectionItem,
} from "./filters/alphabetical-filter-section";
import type { FilterPreset } from "../lib/filter-presets";
import { FilterPresetDropdown } from "./filters/filter-preset-dropdown";

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
  /** Display-friendly filters shown as chips in the toolbar. */
  activeFilters: { label: string; value: string; type?: string }[];
  /** Raw filters used for panel highlight checks (raw IDs/values). */
  rawActiveFilters?: { label: string; value: string; type: string }[];
  onRemoveFilter: (index: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  availableStudios?: StudioItem[];
  availableTags?: TagItem[];
  availablePerformers?: PerformerItem[];
  onAddFilter?: (type: string, label: string, value: string) => void;
  onClearFiltersAndSort?: () => void;
  canClearFiltersAndSort?: boolean;
  presets?: FilterPreset[];
  activePresetId?: string | null;
  onApplyPreset?: (preset: FilterPreset) => void;
  onSavePreset?: (name: string) => void;
  onOverwritePreset?: (id: string) => void;
  onDeletePreset?: (id: string) => void;
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
  rawActiveFilters,
  onRemoveFilter,
  searchQuery,
  onSearchChange,
  availableStudios = [],
  availableTags = [],
  availablePerformers = [],
  onAddFilter,
  onClearFiltersAndSort,
  canClearFiltersAndSort = false,
  presets = [],
  activePresetId,
  onApplyPreset,
  onSavePreset,
  onOverwritePreset,
  onDeletePreset,
}: FilterBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const { mode: nsfwMode } = useNsfw();

  const currentSort = sortOptions.find((s) => s.value === sortBy);

  // Use raw filters for panel highlight checks (raw IDs), display filters for toolbar chips
  const panelFilters = rawActiveFilters ?? activeFilters;

  const tagItems: AlphabeticalFilterSectionItem[] = useMemo(() => {
    const visible = tagsVisibleInNsfwMode(availableTags, nsfwMode);
    return visible
      .filter((t) => t.sceneCount > 0)
      .map((t) => ({ id: t.id, name: t.name, count: t.sceneCount }));
  }, [availableTags, nsfwMode]);

  const performerItems: AlphabeticalFilterSectionItem[] = useMemo(() => {
    const visible = tagsVisibleInNsfwMode(availablePerformers, nsfwMode);
    return visible
      .filter((p) => p.sceneCount > 0)
      .map((p) => ({ id: p.id, name: p.name, count: p.sceneCount }));
  }, [availablePerformers, nsfwMode]);

  const studioItems: AlphabeticalFilterSectionItem[] = useMemo(() => {
    const visible = tagsVisibleInNsfwMode(availableStudios, nsfwMode);
    return visible
      .filter((s) => s.sceneCount > 0)
      .map((s) => ({ id: s.id, name: s.name, count: s.sceneCount }));
  }, [availableStudios, nsfwMode]);

  return (
    <div className="space-y-0">
      {/* Main toolbar */}
      <div className="surface-well px-3 py-2 space-y-2 sm:space-y-0">
        {/* Search — own row on mobile */}
        <div className="relative sm:hidden">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none" />
          <input
            type="text"
            placeholder="Search scenes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full bg-surface-2 border border-border-subtle pl-7 pr-3 py-1.5 text-[0.78rem] text-text-primary",
              "placeholder:text-text-disabled",
              "focus:outline-none focus:border-accent-500",
              "transition-colors duration-fast",
            )}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {/* Search — inline on desktop */}
          <div className="relative flex-1 min-w-0 hidden sm:block">
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
                "transition-colors duration-fast",
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
          <div className="hidden sm:block h-5 w-px bg-border-subtle" />

        {/* Sort dropdown + direction toggle */}
        <div className="flex items-center">
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5",
                "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
                "transition-colors duration-fast",
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
                          : "text-text-muted hover:text-text-primary hover:bg-surface-3",
                      )}
                    >
                      <Check
                        className={cn(
                          "h-3 w-3",
                          sortBy === opt.value ? "opacity-100" : "opacity-0",
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
            title={sortDir === "asc" ? "Ascending \u2014 click to reverse" : "Descending \u2014 click to reverse"}
            className={cn(
              "flex h-7 w-7 items-center justify-center",
              "text-text-muted hover:text-text-primary hover:bg-surface-2",
              "transition-colors duration-fast",
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
            title="Grid view"
            aria-label="Grid view"
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
              viewMode === "grid"
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            title="List view"
            aria-label="List view"
            onClick={() => onViewModeChange("list")}
            className={cn(
              "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
              viewMode === "list"
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2",
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
          <button
            title="Series view"
            aria-label="Series view"
            onClick={() => onViewModeChange("folders")}
            className={cn(
              "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
              viewMode === "folders"
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2",
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
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
              : "text-text-muted hover:text-text-primary hover:bg-surface-2",
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

        {/* Preset dropdown */}
        {onSavePreset && (
          <FilterPresetDropdown
            presets={presets}
            activePresetId={activePresetId ?? null}
            onApplyPreset={onApplyPreset}
            onSavePreset={onSavePreset}
            onOverwritePreset={onOverwritePreset}
            onDeletePreset={onDeletePreset}
          />
        )}

        {canClearFiltersAndSort && onClearFiltersAndSort && (
          <button
            type="button"
            onClick={onClearFiltersAndSort}
            title="Clear filters, sort, search, and saved preferences"
            className={cn(
              "flex items-center gap-1 px-2 py-1.5",
              "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
              "transition-colors duration-fast",
            )}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
        </div>
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
                      panelFilters.some((f) => f.type === "resolution" && f.value === res)
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
                      onClick={() => onAddFilter?.("ratingMin", "Min rating", String(n))}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        panelFilters.some((f) => f.type === "ratingMin" && f.value === String(n))
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
                      onClick={() => onAddFilter?.("ratingMax", "Max rating", String(n))}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        panelFilters.some((f) => f.type === "ratingMax" && f.value === String(n))
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
                    { id: "300-900", label: "5\u201315 min" },
                    { id: "900-1800", label: "15\u201330 min" },
                    { id: "gte1800", label: "30+ min" },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onAddFilter?.("duration", "Duration", d.id)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      panelFilters.some((f) => f.type === "duration" && f.value === d.id)
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
                {(
                  [
                    { type: "played", value: "true", label: "Played" },
                    { type: "played", value: "false", label: "Unplayed" },
                    { type: "hasFile", value: "true", label: "Has file" },
                    { type: "hasFile", value: "false", label: "No file" },
                  ] as const
                ).map((item) => (
                  <button
                    key={`${item.type}-${item.value}`}
                    type="button"
                    onClick={() =>
                      onAddFilter?.(
                        item.type,
                        item.type === "played" ? "Playback" : "File",
                        item.value,
                      )
                    }
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      panelFilters.some((f) => f.type === item.type && f.value === item.value)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Library flags">
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { type: "organized", value: "true", label: "Organized" },
                    { type: "organized", value: "false", label: "Not organized" },
                    { type: "interactive", value: "true", label: "Interactive" },
                    { type: "interactive", value: "false", label: "Not interactive" },
                  ] as const
                ).map((item) => (
                  <button
                    key={`${item.type}-${item.value}`}
                    type="button"
                    onClick={() =>
                      onAddFilter?.(
                        item.type,
                        item.type === "organized" ? "Organized" : "Interactive",
                        item.value,
                      )
                    }
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      panelFilters.some((f) => f.type === item.type && f.value === item.value)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
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
                      panelFilters.some((f) => f.type === "codec" && f.value === c.id)
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </FilterSection>

            {tagItems.length > 0 && (
              <div className="md:col-span-2 xl:col-span-3">
                <AlphabeticalFilterSection
                  title="Tags"
                  icon={Tag}
                  items={tagItems}
                  searchPlaceholder="Filter tags..."
                  emptyIcon={Tag}
                  emptyLabel="tags"
                  chipVariant="info"
                  isActive={(item) =>
                    panelFilters.some(
                      (f) => (f.type === "tag" || f.label === "Tag") && f.value === item.name,
                    )
                  }
                  onToggle={(item) => onAddFilter?.("tag", "Tag", item.name)}
                />
              </div>
            )}

            {performerItems.length > 0 && (
              <div className="md:col-span-2 xl:col-span-3">
                <AlphabeticalFilterSection
                  title="Performers"
                  icon={Users}
                  items={performerItems}
                  searchPlaceholder="Filter performers..."
                  emptyIcon={Users}
                  emptyLabel="performers"
                  chipVariant="info"
                  isActive={(item) =>
                    panelFilters.some((f) => f.type === "performer" && f.value === item.name)
                  }
                  onToggle={(item) => onAddFilter?.("performer", "Performer", item.name)}
                />
              </div>
            )}

            {studioItems.length > 0 && (
              <div className="md:col-span-2 xl:col-span-3">
                <AlphabeticalFilterSection
                  title="Studios"
                  icon={Building2}
                  items={studioItems}
                  searchPlaceholder="Filter studios..."
                  emptyIcon={Building2}
                  emptyLabel="studios"
                  chipVariant="accent"
                  isActive={(item) =>
                    panelFilters.some((f) => f.type === "studio" && f.value === item.id)
                  }
                  onToggle={(item) => onAddFilter?.("studio", "Studio", item.id)}
                />
              </div>
            )}
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
