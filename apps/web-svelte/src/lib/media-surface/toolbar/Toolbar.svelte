<script lang="ts" generics="F extends string">
  import { SlidersHorizontal, RotateCcw } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import { tagsVisibleInNsfwMode } from "$lib/nsfw/tags";
  import type { Snippet } from "svelte";
  import type {
    AvailableFilterItems,
    FilterSectionSpec,
    SurfacePrefs,
    SortOption,
    SortDir,
    ViewModeSpec,
    ThumbSizeConfig,
  } from "$lib/media-surface/config";
  import type { FilterPreset } from "./PresetDropdown.svelte";
  import type { AlphabeticalFilterSectionItem } from "./AlphabeticalFilterSection.svelte";
  import SearchBox from "./SearchBox.svelte";
  import SortControl from "./SortControl.svelte";
  import ViewModeToggle from "./ViewModeToggle.svelte";
  import ActiveFilterChips from "./ActiveFilterChips.svelte";
  import ThumbSizeSlider from "./ThumbSizeSlider.svelte";
  import PresetDropdown from "./PresetDropdown.svelte";
  import FilterDrawer, { type FilterSectionKey } from "./FilterDrawer.svelte";

  interface Props {
    prefs: SurfacePrefs<F>;
    sortOptions: SortOption[];
    defaultSortDir?: Record<string, SortDir>;
    viewModes?: ViewModeSpec[];
    filterSections?: FilterSectionSpec<F>[];
    availableFilterItems?: AvailableFilterItems;
    searchPlaceholder?: string;
    searchDebounceMs?: number;
    thumbSize?: ThumbSizeConfig;
    presets?: FilterPreset[];
    /** Display formatter; receives the filter and returns the chip's display value. */
    formatFilterValue?: (filter: { type: F; value: string; label: string }) => string;
    canClearFiltersAndSort?: boolean;
    onSortChange: (sort: string, dir?: SortDir) => void;
    onViewModeChange: (mode: string) => void;
    onSearchChange: (next: string) => void;
    onAddFilter: (type: F, label: string, value: string) => void;
    onRemoveFilter: (index: number) => void;
    onColsChange?: (cols: number) => void;
    onApplyPreset?: (preset: FilterPreset) => void;
    onSavePreset?: (name: string) => void;
    onOverwritePreset?: (id: string) => void;
    onDeletePreset?: (id: string) => void;
    onClearFiltersAndSort?: () => void;
    /** Extra controls rendered at the right edge (Import / Upload / etc.). */
    extras?: Snippet<[{ prefs: SurfacePrefs<F> }]>;
  }

  let {
    prefs,
    sortOptions,
    defaultSortDir = {},
    viewModes,
    filterSections,
    availableFilterItems,
    searchPlaceholder = "Search...",
    searchDebounceMs = 300,
    thumbSize,
    presets = [],
    formatFilterValue,
    canClearFiltersAndSort = false,
    onSortChange,
    onViewModeChange,
    onSearchChange,
    onAddFilter,
    onRemoveFilter,
    onColsChange,
    onApplyPreset,
    onSavePreset,
    onOverwritePreset,
    onDeletePreset,
    onClearFiltersAndSort,
    extras,
  }: Props = $props();

  let drawerOpen = $state(false);
  const nsfw = useNsfw();

  // Determine which built-in section keys are enabled.
  const enabledSections = $derived.by<Set<FilterSectionKey>>(() => {
    const out = new Set<FilterSectionKey>();
    if (!filterSections) return out;
    for (const s of filterSections) {
      switch (s.kind) {
        case "enum":
          if (s.filterType === "resolution") out.add("resolution");
          else if (s.filterType === "codec") out.add("codec");
          else if (s.filterType === "duration") out.add("duration");
          break;
        case "rating":
          out.add("rating");
          break;
        case "date-range":
          out.add("date");
          break;
        case "alphabetical-id-list":
          if (s.source === "tags") out.add("tags");
          else if (s.source === "performers") out.add("performers");
          else if (s.source === "studios") out.add("studios");
          break;
      }
      if (s.filterType === "played" || s.filterType === "hasFile") out.add("playback");
      if (s.filterType === "organized" || s.filterType === "interactive")
        out.add("libraryFlags");
    }
    return out;
  });

  function visibleItems(
    raw: AvailableFilterItems[keyof AvailableFilterItems] | undefined,
  ): AlphabeticalFilterSectionItem[] {
    if (!raw) return [];
    const visible = tagsVisibleInNsfwMode(
      raw.map((r) => ({ id: r.id, name: r.name, isNsfw: r.isNsfw, videoCount: r.count ?? 0 })),
      nsfw.mode,
    );
    return visible
      .filter((r) => (r.videoCount ?? 0) > 0)
      .map((r) => ({ id: r.id, name: r.name, count: r.videoCount ?? 0 }));
  }

  const tagItems = $derived(visibleItems(availableFilterItems?.tags));
  const performerItems = $derived(visibleItems(availableFilterItems?.performers));
  const studioItems = $derived(visibleItems(availableFilterItems?.studios));

  const hasFilterPanel = $derived(
    enabledSections.size > 0 ||
      (filterSections?.length ?? 0) > 0,
  );

  const showInteractiveFilter = $derived(
    Boolean(filterSections?.some((s) => s.filterType === "interactive")),
  );

  // The chip strip wants `{label, value, type}`; map activeFilters
  // through the optional formatter to produce the displayed value.
  const displayFilters = $derived(
    prefs.activeFilters.map((f) => ({
      type: f.type as string,
      label: f.label,
      value: formatFilterValue
        ? formatFilterValue({ type: f.type, value: f.value, label: f.label })
        : f.value,
    })),
  );
</script>

<div class="space-y-0">
  <div class="surface-well px-3 py-2 space-y-2 sm:space-y-0">
    <!-- Mobile: search on its own row -->
    <div class="sm:hidden">
      <SearchBox
        value={prefs.search}
        placeholder={searchPlaceholder}
        debounceMs={searchDebounceMs}
        onChange={onSearchChange}
        variant="block"
      />
    </div>

    <div class="flex items-center gap-2">
      <div class="hidden sm:block flex-1 min-w-0">
        <SearchBox
          value={prefs.search}
          placeholder={searchPlaceholder}
          debounceMs={searchDebounceMs}
          onChange={onSearchChange}
          variant="inline"
        />
      </div>

      <ActiveFilterChips
        filters={displayFilters}
        onRemove={onRemoveFilter}
        variant="inline"
      />

      <div class="hidden sm:block h-5 w-px bg-border-subtle"></div>

      <SortControl
        sortBy={prefs.sortBy}
        sortDir={prefs.sortDir}
        {sortOptions}
        {defaultSortDir}
        {onSortChange}
      />

      {#if thumbSize && onColsChange}
        <div class="hidden sm:flex items-center border-l border-border-subtle pl-1">
          <ThumbSizeSlider
            value={prefs.cols ?? thumbSize.default}
            min={thumbSize.min}
            max={thumbSize.max}
            onChange={onColsChange}
            label={thumbSize.label ?? "Thumbnail size"}
          />
        </div>
      {/if}

      {#if viewModes && viewModes.length > 1}
        <ViewModeToggle
          value={prefs.viewMode}
          modes={viewModes}
          onChange={onViewModeChange}
        />
      {/if}

      {#if hasFilterPanel}
        <button
          type="button"
          onclick={() => (drawerOpen = !drawerOpen)}
          class={cn(
            "flex items-center gap-1.5 px-2 py-1.5",
            "text-[0.72rem] transition-colors duration-fast",
            drawerOpen
              ? "text-text-accent bg-accent-950"
              : "text-text-muted hover:text-text-primary hover:bg-surface-2",
          )}
        >
          <SlidersHorizontal class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">Filters</span>
          {#if prefs.activeFilters.length > 0}
            <span
              class="flex h-4 w-4 items-center justify-center bg-accent-800 text-[0.55rem] font-bold text-accent-200"
            >
              {prefs.activeFilters.length}
            </span>
          {/if}
        </button>
      {/if}

      {#if onSavePreset}
        <PresetDropdown
          {presets}
          activePresetId={prefs.activePresetId ?? null}
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

      {#if extras}
        {@render extras({ prefs })}
      {/if}
    </div>

    {#if thumbSize && onColsChange}
      <div class="sm:hidden flex items-center gap-2 pt-1.5 border-t border-border-subtle">
        <span class="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled shrink-0">
          {thumbSize.label ?? "Size"}
        </span>
        <div class="flex-1 flex items-center justify-end">
          <ThumbSizeSlider
            value={prefs.cols ?? thumbSize.default}
            min={thumbSize.min}
            max={thumbSize.max}
            onChange={onColsChange}
            label={thumbSize.label ?? "Thumbnail size"}
          />
        </div>
      </div>
    {/if}
  </div>

  {#if drawerOpen}
    <FilterDrawer
      enabledSections={enabledSections}
      panelFilters={prefs.activeFilters as Array<{ type?: string; label: string; value: string }>}
      onAddFilter={(type, label, value) => onAddFilter(type as F, label, value)}
      tagItems={tagItems}
      performerItems={performerItems}
      studioItems={studioItems}
      showInteractiveFilter={showInteractiveFilter}
    />
  {/if}

  <ActiveFilterChips
    filters={displayFilters}
    onRemove={onRemoveFilter}
    variant="scroll"
  />
</div>
