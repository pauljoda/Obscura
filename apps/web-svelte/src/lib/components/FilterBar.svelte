<script module lang="ts">
  export type SortDir = "asc" | "desc";
  export type ViewMode = "grid" | "list" | "series" | "feed";

  export interface SortOption<T extends string = string> {
    value: T;
    label: string;
  }

  export interface ActiveFilter {
    label: string;
    value: string;
    type?: string;
  }

  export interface RawActiveFilter {
    label: string;
    value: string;
    type: string;
  }

  export interface AvailableItem {
    id: string;
    name: string;
    videoCount?: number;
    isNsfw?: boolean;
  }

  export type FilterSectionKey =
    | "resolution"
    | "rating"
    | "date"
    | "duration"
    | "playback"
    | "libraryFlags"
    | "codec"
    | "tags"
    | "performers"
    | "studios";
</script>

<script lang="ts">
  /**
   * Adapter that preserves the existing FilterBar public API while
   * delegating to the role-organized media-surface/toolbar/* pieces.
   *
   * New consumers should compose the toolbar pieces directly via
   * MediaSurface; this adapter remains so the seven existing list
   * pages keep working until each one migrates. After all routes
   * migrate, the file is deleted (commit 20).
   */
  import {
    SlidersHorizontal,
    LayoutGrid,
    LayoutList,
    Rows3,
    FolderOpen,
    RotateCcw,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import { tagsVisibleInNsfwMode } from "$lib/nsfw/tags";
  import type { Snippet } from "svelte";
  import ThumbSizeSlider from "$lib/v1/media-surface/toolbar/ThumbSizeSliderV1.svelte";
  import { type AlphabeticalFilterSectionItem } from "$lib/v1/media-surface/toolbar/AlphabeticalFilterSectionV1.svelte";
  import PresetDropdown, {
    type FilterPreset,
  } from "$lib/v1/media-surface/toolbar/PresetDropdownV1.svelte";
  import SearchBox from "$lib/v1/media-surface/toolbar/SearchBoxV1.svelte";
  import SortControl from "$lib/v1/media-surface/toolbar/SortControlV1.svelte";
  import ViewModeToggle from "$lib/v1/media-surface/toolbar/ViewModeToggleV1.svelte";
  import ActiveFilterChips from "$lib/v1/media-surface/toolbar/ActiveFilterChipsV1.svelte";
  import FilterDrawer, {
    type FilterSectionKey as DrawerSectionKey,
  } from "$lib/v1/media-surface/toolbar/FilterDrawerV1.svelte";

  export interface ThumbSizeConfig {
    value: number;
    min: number;
    max: number;
    onChange: (next: number) => void;
    label?: string;
  }

  interface Props {
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    sortBy: string;
    sortDir: SortDir;
    sortOptions: SortOption[];
    onSortChange: (sort: string, dir?: SortDir) => void;
    activeFilters?: ActiveFilter[];
    rawActiveFilters?: RawActiveFilter[];
    onRemoveFilter?: (index: number) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    availableStudios?: AvailableItem[];
    availableTags?: AvailableItem[];
    availablePerformers?: AvailableItem[];
    onAddFilter?: (type: string, label: string, value: string) => void;
    onClearFiltersAndSort?: () => void;
    canClearFiltersAndSort?: boolean;
    presets?: FilterPreset[];
    activePresetId?: string | null;
    onApplyPreset?: (preset: FilterPreset) => void;
    onSavePreset?: (name: string) => void;
    onOverwritePreset?: (id: string) => void;
    onDeletePreset?: (id: string) => void;
    showViewToggle?: boolean;
    showSeriesView?: boolean;
    showFeedView?: boolean;
    showSortControls?: boolean;
    defaultSortDir?: Record<string, SortDir>;
    filterSections?: FilterSectionKey[];
    showInteractiveFilter?: boolean;
    searchPlaceholder?: string;
    thumbSize?: ThumbSizeConfig;
    customFilterSections?: Snippet<[{ panelFilters: (ActiveFilter | RawActiveFilter)[] }]>;
  }

  let {
    viewMode = "grid",
    onViewModeChange,
    sortBy,
    sortDir,
    sortOptions,
    onSortChange,
    activeFilters = [],
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
    activePresetId = null,
    onApplyPreset,
    onSavePreset,
    onOverwritePreset,
    onDeletePreset,
    showViewToggle = true,
    showSeriesView = false,
    showFeedView = false,
    showSortControls = true,
    defaultSortDir = {},
    filterSections = [
      "resolution",
      "rating",
      "date",
      "duration",
      "playback",
      "libraryFlags",
      "codec",
      "tags",
      "performers",
      "studios",
    ],
    showInteractiveFilter = true,
    searchPlaceholder = "Search videos...",
    thumbSize,
    customFilterSections,
  }: Props = $props();

  let filterPanelOpen = $state(false);
  const nsfw = useNsfw();

  const panelFilters = $derived(rawActiveFilters ?? activeFilters);

  const tagItems = $derived.by<AlphabeticalFilterSectionItem[]>(() => {
    const visible = tagsVisibleInNsfwMode(availableTags, nsfw.mode);
    return visible
      .filter((t) => (t.videoCount ?? 0) > 0)
      .map((t) => ({ id: t.id, name: t.name, count: t.videoCount ?? 0 }));
  });

  const performerItems = $derived.by<AlphabeticalFilterSectionItem[]>(() => {
    const visible = tagsVisibleInNsfwMode(availablePerformers, nsfw.mode);
    return visible
      .filter((p) => (p.videoCount ?? 0) > 0)
      .map((p) => ({ id: p.id, name: p.name, count: p.videoCount ?? 0 }));
  });

  const studioItems = $derived.by<AlphabeticalFilterSectionItem[]>(() => {
    const visible = tagsVisibleInNsfwMode(availableStudios, nsfw.mode);
    return visible
      .filter((s) => (s.videoCount ?? 0) > 0)
      .map((s) => ({ id: s.id, name: s.name, count: s.videoCount ?? 0 }));
  });

  const hasFilterPanel = $derived(
    Boolean(customFilterSections) ||
      Boolean(onAddFilter) ||
      availableTags.length + availablePerformers.length + availableStudios.length > 0,
  );
  const enabledSections = $derived(new Set<DrawerSectionKey>(filterSections));

  const viewModeSpecs = $derived(
    [
      { mode: "grid" as ViewMode, icon: LayoutGrid, label: "Grid view" },
      { mode: "list" as ViewMode, icon: LayoutList, label: "List view" },
      ...(showFeedView
        ? [{ mode: "feed" as ViewMode, icon: Rows3, label: "Feed view" }]
        : []),
      ...(showSeriesView
        ? [{ mode: "series" as ViewMode, icon: FolderOpen, label: "Series view" }]
        : []),
    ],
  );
</script>

<div class="space-y-0">
  <div class="surface-well px-3 py-2 space-y-2 sm:space-y-0">
    <!-- Search — own row on mobile -->
    <div class="sm:hidden">
      <SearchBox
        value={searchQuery}
        placeholder={searchPlaceholder}
        onChange={onSearchChange}
        variant="block"
      />
    </div>

    <!-- Controls row -->
    <div class="flex items-center gap-2">
      <!-- Search — inline on desktop -->
      <div class="hidden sm:block flex-1 min-w-0">
        <SearchBox
          value={searchQuery}
          placeholder={searchPlaceholder}
          onChange={onSearchChange}
          variant="inline"
        />
      </div>

      <ActiveFilterChips
        filters={activeFilters}
        onRemove={(i) => onRemoveFilter?.(i)}
        variant="inline"
      />

      <div class="hidden sm:block h-5 w-px bg-border-subtle"></div>

      {#if showSortControls}
        <SortControl
          {sortBy}
          {sortDir}
          {sortOptions}
          {defaultSortDir}
          {onSortChange}
        />
      {/if}

      {#if thumbSize}
        <div class="hidden sm:flex items-center border-l border-border-subtle pl-1">
          <ThumbSizeSlider
            value={thumbSize.value}
            min={thumbSize.min}
            max={thumbSize.max}
            onChange={thumbSize.onChange}
            label={thumbSize.label ?? "Thumbnail size"}
          />
        </div>
      {/if}

      {#if showViewToggle && onViewModeChange}
        <ViewModeToggle
          value={viewMode}
          modes={viewModeSpecs}
          onChange={(m) => onViewModeChange(m as ViewMode)}
        />
      {/if}

      {#if hasFilterPanel}
        <button
          type="button"
          onclick={() => (filterPanelOpen = !filterPanelOpen)}
          class={cn(
            "flex items-center gap-1.5 px-2 py-1.5",
            "text-[0.72rem] transition-colors duration-fast",
            filterPanelOpen
              ? "text-text-accent bg-accent-950"
              : "text-text-muted hover:text-text-primary hover:bg-surface-2",
          )}
        >
          <SlidersHorizontal class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">Filters</span>
          {#if activeFilters.length > 0}
            <span
              class="flex h-4 w-4 items-center justify-center bg-accent-800 text-[0.55rem] font-bold text-accent-200"
            >
              {activeFilters.length}
            </span>
          {/if}
        </button>
      {/if}

      {#if onSavePreset}
        <PresetDropdown
          {presets}
          {activePresetId}
          {onApplyPreset}
          {onSavePreset}
          {onOverwritePreset}
          {onDeletePreset}
        />
      {/if}

      {#if canClearFiltersAndSort && onClearFiltersAndSort}
        <button
          type="button"
          onclick={onClearFiltersAndSort}
          title="Clear filters, sort, search, and saved preferences"
          class={cn(
            "flex items-center gap-1 px-2 py-1.5",
            "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
            "transition-colors duration-fast",
          )}
        >
          <RotateCcw class="h-3.5 w-3.5 shrink-0" />
          <span class="hidden sm:inline">Clear</span>
        </button>
      {/if}
    </div>

    {#if thumbSize}
      <!-- Size slider — own row on mobile for comfortable touch targets -->
      <div class="sm:hidden flex items-center gap-2 pt-1.5 border-t border-border-subtle">
        <span
          class="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled shrink-0"
        >
          {thumbSize.label ?? "Size"}
        </span>
        <div class="flex-1 flex items-center justify-end">
          <ThumbSizeSlider
            value={thumbSize.value}
            min={thumbSize.min}
            max={thumbSize.max}
            onChange={thumbSize.onChange}
            label={thumbSize.label ?? "Thumbnail size"}
          />
        </div>
      </div>
    {/if}
  </div>

  {#if filterPanelOpen}
    <FilterDrawer
      enabledSections={enabledSections}
      panelFilters={panelFilters}
      onAddFilter={(type, label, value) => onAddFilter?.(type, label, value)}
      tagItems={tagItems}
      performerItems={performerItems}
      studioItems={studioItems}
      showInteractiveFilter={showInteractiveFilter}
      customSections={customFilterSections}
    />
  {/if}

  <ActiveFilterChips
    filters={activeFilters}
    onRemove={(i) => onRemoveFilter?.(i)}
    variant="scroll"
  />
</div>
