<script lang="ts">
  import {
    ArrowDownAZ,
    ArrowUpAZ,
    ChevronDown,
    Grid2x2,
    Grid3x3,
    LayoutGrid,
    List,
    RotateCcw,
    Search,
    SlidersHorizontal,
    X,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { FilterPreset } from "$lib/filter-presets";
  import type {
    EntityGridFilterOption,
    EntityGridSort,
    EntityGridSortDir,
    EntityGridViewMode,
  } from "$lib/entities/entity-grid";
  import EntityGridPresetDropdown from "./EntityGridPresetDropdown.svelte";

  interface Props {
    activeFilterIds: string[];
    activePresetId?: string | null;
    canClearFiltersAndSort: boolean;
    drawerOpen: boolean;
    filterOptions: EntityGridFilterOption[];
    maxScale: number;
    minScale: number;
    onActiveFilterIdsChange: (ids: string[]) => void;
    onApplyPreset: (preset: FilterPreset) => void;
    onClearFiltersAndSort: () => void;
    onDeletePreset: (id: string) => void;
    onDrawerOpenChange: (open: boolean) => void;
    onOverwritePreset: (id: string) => void;
    onQueryChange: (query: string) => void;
    onSavePreset: (name: string) => void;
    onScaleChange: (scale: number) => void;
    onSortByChange: (sortBy: EntityGridSort) => void;
    onSortDirChange: (sortDir: EntityGridSortDir) => void;
    onViewModeChange: (viewMode: EntityGridViewMode) => void;
    presets: FilterPreset[];
    query: string;
    scale: number;
    selectedCount: number;
    sortBy: EntityGridSort;
    sortDir: EntityGridSortDir;
    totalCount: number;
    visibleCount: number;
    viewMode: EntityGridViewMode;
  }

  let {
    activeFilterIds,
    activePresetId = null,
    canClearFiltersAndSort,
    drawerOpen,
    filterOptions,
    maxScale,
    minScale,
    onActiveFilterIdsChange,
    onApplyPreset,
    onClearFiltersAndSort,
    onDeletePreset,
    onDrawerOpenChange,
    onOverwritePreset,
    onQueryChange,
    onSavePreset,
    onScaleChange,
    onSortByChange,
    onSortDirChange,
    onViewModeChange,
    presets,
    query,
    scale,
    selectedCount,
    sortBy,
    sortDir,
    totalCount,
    visibleCount,
    viewMode,
  }: Props = $props();

  const activeFilters = $derived(
    activeFilterIds
      .map((id) => filterOptions.find((option) => option.id === id))
      .filter((option): option is EntityGridFilterOption => Boolean(option)),
  );

  function removeFilter(id: string) {
    onActiveFilterIdsChange(activeFilterIds.filter((filterId) => filterId !== id));
  }

  function parseScale(event: Event) {
    onScaleChange(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<div class="space-y-0">
  <div class="surface-well space-y-2 px-3 py-2">
    <div>
      <label class="search-box">
        <Search class="h-3.5 w-3.5 text-text-disabled" />
        <input
          type="search"
          placeholder="Search entities..."
          value={query}
          oninput={(event) => onQueryChange((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
    </div>

    <div class="flex items-center gap-2 overflow-x-auto">
      <div class="hidden min-w-0 items-center gap-1 xl:flex">
        {#each activeFilters.slice(0, 3) as option (option.id)}
          <button type="button" class="filter-chip" onclick={() => removeFilter(option.id)}>
            <span>{option.label}</span>
            <X class="h-3 w-3" />
          </button>
        {/each}
        {#if activeFilters.length > 3}
          <span class="count-chip">+{activeFilters.length - 3}</span>
        {/if}
      </div>

      {#if activeFilters.length > 0}
        <div class="hidden h-5 w-px bg-border-subtle sm:block"></div>
      {/if}

      <label class="sort-control">
        <span class="sr-only">Sort</span>
        <select
          value={sortBy}
          onchange={(event) => onSortByChange((event.currentTarget as HTMLSelectElement).value as EntityGridSort)}
        >
          <option value="title">Title</option>
          <option value="kind">Kind</option>
          <option value="rating">Rating</option>
        </select>
        <ChevronDown class="sort-chevron h-3.5 w-3.5" aria-hidden="true" />
      </label>

      <button
        type="button"
        class="icon-control"
        title={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
        aria-label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
        onclick={() => onSortDirChange(sortDir === "asc" ? "desc" : "asc")}
      >
        {#if sortDir === "asc"}
          <ArrowDownAZ class="h-3.5 w-3.5" />
        {:else}
          <ArrowUpAZ class="h-3.5 w-3.5" />
        {/if}
      </button>

      <div class="hidden items-center border-l border-border-subtle pl-1 sm:flex">
        <label class="thumb-size-control" title="Drag to change thumbnail size">
          <Grid2x2 class="h-3.5 w-3.5 shrink-0 text-text-disabled" />
          <span class="sr-only">Thumbnail columns</span>
          <input
            type="range"
            aria-label="Thumbnail columns"
            min={minScale}
            max={maxScale}
            step="1"
            value={scale}
            oninput={parseScale}
          />
          <Grid3x3 class="h-3 w-3 shrink-0 rotate-180 text-text-disabled" />
        </label>
      </div>

      <div class="view-toggle" aria-label="View mode">
        <button
          type="button"
          class:is-active={viewMode === "grid"}
          title="Grid view"
          aria-label="Grid view"
          aria-pressed={viewMode === "grid"}
          onclick={() => onViewModeChange("grid")}
        >
          <LayoutGrid class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class:is-active={viewMode === "list"}
          title="List view"
          aria-label="List view"
          aria-pressed={viewMode === "list"}
          onclick={() => onViewModeChange("list")}
        >
          <List class="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        class={cn(
          "flex items-center gap-1.5 px-2 py-1.5 text-[0.72rem] transition-colors duration-fast",
          drawerOpen
            ? "bg-accent-950 text-text-accent"
            : "text-text-muted hover:bg-surface-2 hover:text-text-primary",
        )}
        aria-expanded={drawerOpen}
        onclick={() => onDrawerOpenChange(!drawerOpen)}
      >
        <SlidersHorizontal class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Filters</span>
        {#if activeFilterIds.length > 0}
          <span class="filter-count">{activeFilterIds.length}</span>
        {/if}
      </button>

      <EntityGridPresetDropdown
        {activePresetId}
        {presets}
        {onApplyPreset}
        {onSavePreset}
        {onOverwritePreset}
        {onDeletePreset}
      />

      {#if canClearFiltersAndSort}
        <button
          type="button"
          title="Clear filters, sort, search, and saved preferences"
          class="flex items-center gap-1 px-2 py-1.5 text-[0.72rem] text-text-muted transition-colors duration-fast hover:bg-surface-2 hover:text-text-primary"
          onclick={onClearFiltersAndSort}
        >
          <RotateCcw class="h-3.5 w-3.5 shrink-0" />
          <span class="hidden sm:inline">Clear</span>
        </button>
      {/if}

      <div class="ml-auto hidden items-center gap-1.5 font-mono text-[0.68rem] text-text-disabled lg:flex">
        <span>{visibleCount}/{totalCount}</span>
        {#if selectedCount > 0}
          <span class="text-text-accent">{selectedCount} selected</span>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2 border-t border-border-subtle pt-1.5 sm:hidden">
      <span class="shrink-0 font-mono text-[0.6rem] uppercase tracking-wider text-text-disabled">Size</span>
      <label class="thumb-size-control flex-1 justify-end">
        <Grid2x2 class="h-3.5 w-3.5 shrink-0 text-text-disabled" />
        <input
          type="range"
          aria-label="Thumbnail columns"
          min={minScale}
          max={maxScale}
          step="1"
          value={scale}
          oninput={parseScale}
        />
        <Grid3x3 class="h-3 w-3 shrink-0 rotate-180 text-text-disabled" />
      </label>
    </div>
  </div>

  <div class="filter-scroll">
    {#if activeFilters.length > 0}
      <SlidersHorizontal class="h-3.5 w-3.5 shrink-0 text-text-disabled" />
      {#each activeFilters as option (option.id)}
        <button type="button" class="filter-chip" onclick={() => removeFilter(option.id)}>
          <span>{option.label}</span>
          <X class="h-3 w-3" />
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .search-box {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    height: 1.9rem;
    min-width: 0;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-1);
    box-shadow: inset 0 2px 6px rgb(0 0 0 / 0.45);
    padding: 0 0.55rem;
  }

  .search-box input {
    min-width: 0;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    font-size: 0.78rem;
    outline: 0;
  }

  .search-box input::placeholder {
    color: var(--color-text-disabled);
  }

  .sort-control,
  .icon-control {
    display: inline-flex;
    align-items: center;
    min-height: 1.85rem;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .sort-control:hover,
  .icon-control:hover,
  .icon-control:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .sort-control select {
    height: 1.85rem;
    border: 0;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    color: inherit;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    outline: 0;
    padding: 0 1.1rem 0 0.4rem;
    text-transform: uppercase;
  }

  .sort-control {
    position: relative;
    flex: 0 0 auto;
  }

  .sort-chevron {
    position: absolute;
    right: 0.2rem;
    color: currentColor;
    pointer-events: none;
  }

  .icon-control {
    justify-content: center;
    width: 1.85rem;
  }

  .filter-count {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1rem;
    min-width: 1rem;
    background: var(--color-accent-800);
    color: var(--color-accent-200);
    font-size: 0.55rem;
    font-weight: 700;
  }

  .thumb-size-control {
    display: flex;
    align-items: center;
    gap: 0.38rem;
    padding: 0.35rem 0.5rem;
    color: var(--color-text-muted);
  }

  .thumb-size-control input {
    width: 6rem;
    height: 14px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
  }

  .thumb-size-control input::-webkit-slider-runnable-track {
    height: 2px;
    background: var(--color-border-subtle);
  }

  .thumb-size-control input::-moz-range-track {
    height: 2px;
    background: var(--color-border-subtle);
  }

  .thumb-size-control input::-webkit-slider-thumb {
    width: 10px;
    height: 10px;
    margin-top: -4px;
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid var(--color-accent-500);
    background: var(--color-accent-500);
    box-shadow: 0 0 6px rgb(196 154 90 / 0.35);
  }

  .thumb-size-control input::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border: 1px solid var(--color-accent-500);
    background: var(--color-accent-500);
    box-shadow: 0 0 6px rgb(196 154 90 / 0.35);
  }

  .view-toggle {
    display: none;
    border-left: 1px solid var(--color-border-subtle);
    padding-left: 0.35rem;
  }

  .view-toggle button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.85rem;
    width: 1.85rem;
    color: var(--color-text-muted);
    transition:
      background-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .view-toggle button:not(:disabled):hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .view-toggle button.is-active {
    background: var(--color-accent-950);
    color: var(--color-text-accent);
  }

  .filter-scroll {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 0;
    overflow-x: auto;
    padding-top: 0.35rem;
  }

  .filter-chip,
  .count-chip {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: 0.68rem;
    line-height: 1;
    padding: 0.35rem 0.45rem;
    transition:
      border-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .filter-chip:hover {
    border-color: var(--color-border-accent);
    color: var(--color-text-accent);
  }

  .filter-chip span {
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (min-width: 640px) {
    .view-toggle {
      display: inline-flex;
    }
  }
</style>
