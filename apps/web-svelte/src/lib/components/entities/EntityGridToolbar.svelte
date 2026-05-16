<script lang="ts">
  import {
    ArrowUpDown,
    Check,
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
  import { entityGridFilterFromId } from "$lib/entities/entity-grid";
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

  const SORT_LABELS: Record<EntityGridSort, string> = {
    title: "Title",
    kind: "Kind",
    position: "Position",
    rating: "Rating",
  };

  const SORT_OPTIONS: { value: EntityGridSort; label: string }[] = [
    { value: "title", label: "Title" },
    { value: "kind", label: "Kind" },
    { value: "position", label: "Position" },
    { value: "rating", label: "Rating" },
  ];

  let sortOpen = $state(false);

  const activeFilters = $derived(
    activeFilterIds
      .map((id) => entityGridFilterFromId(id, filterOptions))
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
  <div class="surface-well px-3 py-2 toolbar-root">
    <!-- Stacked search: shown when toolbar container is narrow -->
    <div class="search-stacked">
      <label class="search-box">
        <Search class="h-3.5 w-3.5 text-text-disabled shrink-0" />
        <input
          type="search"
          placeholder="Search..."
          value={query}
          oninput={(event) => onQueryChange((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
    </div>

    <div class="flex items-center gap-2">
      <!-- Inline search: shown when toolbar container is wide enough -->
      <div class="search-inline">
        <label class="search-box">
          <Search class="h-3.5 w-3.5 text-text-disabled shrink-0" />
          <input
            type="search"
            placeholder="Search..."
            value={query}
            oninput={(event) => onQueryChange((event.currentTarget as HTMLInputElement).value)}
          />
        </label>
      </div>

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

      <!-- Custom sort dropdown -->
      <div class="relative">
        <button
          type="button"
          class="sort-btn"
          onclick={() => (sortOpen = !sortOpen)}
        >
          <ArrowUpDown class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
          <ChevronDown class="h-3 w-3 text-text-disabled" />
        </button>

        {#if sortOpen}
          <button
            type="button"
            class="fixed inset-0 z-40"
            aria-label="Close sort menu"
            onclick={() => (sortOpen = false)}
          ></button>
          <div class="sort-menu">
            {#each SORT_OPTIONS as opt (opt.value)}
              <button
                type="button"
                class={cn("sort-menu-item", sortBy === opt.value && "is-active")}
                onclick={() => {
                  onSortByChange(opt.value);
                  sortOpen = false;
                }}
              >
                <Check class={cn("h-3 w-3", sortBy === opt.value ? "opacity-100" : "opacity-0")} />
                {opt.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <button
        type="button"
        class="icon-control"
        title={sortDir === "asc" ? "Ascending — click to reverse" : "Descending — click to reverse"}
        aria-label={`Sort direction: ${sortDir}`}
        onclick={() => onSortDirChange(sortDir === "asc" ? "desc" : "asc")}
      >
        <ChevronDown class={cn("h-3.5 w-3.5", sortDir === "asc" && "rotate-180")} />
      </button>

      <div class="ml-auto flex items-center gap-2">
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

        <div class="hidden items-center gap-1.5 font-mono text-[0.68rem] text-text-disabled lg:flex">
          <span>{visibleCount}/{totalCount}</span>
          {#if selectedCount > 0}
            <span class="text-text-accent">{selectedCount} selected</span>
          {/if}
        </div>
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
  .toolbar-root {
    container-type: inline-size;
  }

  .search-stacked {
    display: block;
    margin-bottom: 0.5rem;
  }

  .search-inline {
    display: none;
    flex: 1;
    min-width: 0;
  }

  @container (min-width: 1000px) {
    .search-stacked {
      display: none;
    }

    .search-inline {
      display: block;
    }
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    height: 1.8rem;
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
    font-size: 0.72rem;
    outline: 0;
  }

  .search-box input::placeholder {
    color: var(--color-text-disabled);
  }

  .sort-btn,
  .icon-control {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 1.85rem;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    padding: 0 0.4rem;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .sort-btn:hover,
  .icon-control:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .icon-control {
    justify-content: center;
    width: 1.85rem;
    padding: 0;
  }

  .sort-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 0.25rem);
    z-index: 50;
    min-width: 10rem;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-3);
    box-shadow:
      0 4px 16px rgb(0 0 0 / 0.45),
      0 1px 4px rgb(0 0 0 / 0.2);
    padding: 0.25rem 0;
  }

  .sort-menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.38rem 0.75rem;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    text-align: left;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .sort-menu-item:hover {
    background: var(--color-surface-4, var(--color-surface-3));
    color: var(--color-text-primary);
  }

  .sort-menu-item.is-active {
    background: var(--color-accent-950);
    color: var(--color-text-accent);
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
