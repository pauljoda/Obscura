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

<div class="toolbar-shell">
  <div class="toolbar-root">
    <div class="search-row">
      <label class="search-box">
        <Search class="search-icon" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search the library…"
          value={query}
          oninput={(event) => onQueryChange((event.currentTarget as HTMLInputElement).value)}
        />
        {#if query}
          <button
            type="button"
            class="search-clear"
            title="Clear search"
            aria-label="Clear search"
            onclick={() => onQueryChange("")}
          >
            <X class="h-3 w-3" />
          </button>
        {/if}
      </label>

      <span class="count-readout" aria-live="polite">
        <span class="count-shown">{visibleCount}</span>
        <span class="count-divider">/</span>
        <span class="count-total">{totalCount}</span>
        {#if selectedCount > 0}
          <span class="count-selected">· {selectedCount} SEL</span>
        {/if}
      </span>
    </div>

    <div class="controls-row">
      <div class="control-cluster">
        <div class="relative">
          <button
            type="button"
            class="ctrl-btn ctrl-sort"
            onclick={() => (sortOpen = !sortOpen)}
          >
            <ArrowUpDown class="h-3.5 w-3.5" />
            <span class="ctrl-label">{SORT_LABELS[sortBy]}</span>
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
          class="ctrl-btn ctrl-icon"
          title={sortDir === "asc" ? "Ascending — click to reverse" : "Descending — click to reverse"}
          aria-label={`Sort direction: ${sortDir}`}
          onclick={() => onSortDirChange(sortDir === "asc" ? "desc" : "asc")}
        >
          <ChevronDown class={cn("h-3.5 w-3.5 dir-arrow", sortDir === "asc" && "is-up")} />
        </button>

        <span class="cluster-divider" aria-hidden="true"></span>

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

        <label class="thumb-size-control" title="Drag to change thumbnail size">
          <Grid2x2 class="thumb-size-icon thumb-size-icon-min" aria-hidden="true" />
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
          <Grid3x3 class="thumb-size-icon thumb-size-icon-max" aria-hidden="true" />
        </label>
      </div>

      <div class="control-cluster control-cluster-trailing">
        <button
          type="button"
          class={cn("ctrl-btn ctrl-filters", drawerOpen && "is-active")}
          aria-expanded={drawerOpen}
          onclick={() => onDrawerOpenChange(!drawerOpen)}
        >
          <SlidersHorizontal class="h-3.5 w-3.5" />
          <span class="ctrl-label">Filters</span>
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
            class="ctrl-btn ctrl-clear"
            onclick={onClearFiltersAndSort}
          >
            <RotateCcw class="h-3.5 w-3.5 shrink-0" />
            <span class="ctrl-label">Clear</span>
          </button>
        {/if}
      </div>
    </div>
  </div>

  <div class="filter-scroll" class:is-active={activeFilters.length > 0} aria-live="polite">
    {#if activeFilters.length > 0}
      <span class="filter-chip-label" aria-hidden="true">
        <SlidersHorizontal class="h-3 w-3 shrink-0" />
        ACTIVE
      </span>
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
  /*
   * The toolbar pins to the top of the layout's scrolling container so the
   * search box, sort/filter controls, and the active filter chip row stay
   * reachable as soon as the page scrolls past their natural position —
   * mirroring how the pagination strip locks to the bottom of the same
   * container.
   *
   * The shell carries an opaque base color (`--color-bg`) under the glass
   * panel so cards scrolling behind the docked toolbar can never bleed
   * through the blurred fill. `padding-top: 0.5rem` offsets the visible
   * glass panel from the top edge, mirroring the pagination shell below.
   *
   * The interior `.toolbar-root` panel uses the same glass recipe as the
   * pagination bar (semi-transparent surface tint + `backdrop-filter`) so
   * the two docked strips read as one continuous floating material above
   * the grid.
   *
   * Interactive controls share a single set of border / background / inset
   * tokens defined just below, so the search box, ctrl buttons, view
   * toggle, and thumbnail-size slider all read as the same family of
   * material chips instead of mismatched outlines.
   */
  .toolbar-shell {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-top: 0.5rem;
    background: var(--color-bg);

    --ctrl-border: rgb(255 255 255 / 0.07);
    --ctrl-border-hover: rgb(196 154 90 / 0.32);
    --ctrl-border-active: rgb(196 154 90 / 0.45);
    --ctrl-bg:
      linear-gradient(180deg, rgb(28 32 42 / 0.55), rgb(16 19 26 / 0.7));
    --ctrl-bg-hover:
      linear-gradient(180deg, rgb(46 38 24 / 0.75), rgb(28 22 12 / 0.9));
    --ctrl-bg-active:
      linear-gradient(180deg, rgb(60 46 24 / 0.92), rgb(36 28 16 / 0.95));
    --ctrl-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.05),
      0 1px 2px rgb(0 0 0 / 0.25);
    --ctrl-shadow-hover:
      inset 0 1px 0 rgb(255 255 255 / 0.07),
      0 0 12px rgb(196 154 90 / 0.14);
    --ctrl-shadow-active:
      inset 0 1px 0 rgb(196 154 90 / 0.12),
      0 0 18px rgb(196 154 90 / 0.18);
  }

  .toolbar-root {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-top-color: rgb(196 154 90 / 0.22);
    background:
      linear-gradient(180deg, rgb(20 23 30 / 0.55), rgb(11 12 16 / 0.85)),
      color-mix(in srgb, var(--color-surface-2) 92%, transparent);
    backdrop-filter: blur(14px) saturate(1.15);
    -webkit-backdrop-filter: blur(14px) saturate(1.15);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.04),
      inset 0 -1px 0 rgb(0 0 0 / 0.35),
      0 10px 28px rgb(0 0 0 / 0.45);
    padding: 0.7rem 0.75rem;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
  }

  .search-box {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    height: 2.1rem;
    border: 1px solid var(--ctrl-border);
    background:
      linear-gradient(180deg, rgb(8 10 14 / 0.72), rgb(12 14 20 / 0.78));
    box-shadow:
      inset 0 2px 6px rgb(0 0 0 / 0.45),
      inset 0 -1px 0 rgb(255 255 255 / 0.025);
    padding: 0 0.65rem;
    transition:
      border-color var(--duration-fast) var(--ease-default),
      box-shadow var(--duration-fast) var(--ease-default);
  }

  .search-box:focus-within {
    border-color: rgb(196 154 90 / 0.45);
    box-shadow:
      inset 0 2px 8px rgb(0 0 0 / 0.55),
      0 0 0 1px rgb(196 154 90 / 0.18),
      0 0 18px rgb(196 154 90 / 0.08);
  }

  .search-box :global(.search-icon) {
    width: 0.95rem;
    height: 0.95rem;
    color: var(--color-text-disabled);
    flex-shrink: 0;
  }

  .search-box:focus-within :global(.search-icon) {
    color: var(--color-text-accent);
  }

  .search-box input {
    min-width: 0;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    font-family: var(--font-inter, "Inter Variable", sans-serif);
    font-size: 0.82rem;
    letter-spacing: 0.005em;
    outline: 0;
  }

  .search-box input::placeholder {
    color: var(--color-text-disabled);
    font-style: italic;
  }

  /* Hide the native WebKit/Chromium search clear so it doesn't collide with our
     own brass-styled clear button. */
  .search-box input::-webkit-search-cancel-button,
  .search-box input::-webkit-search-decoration {
    appearance: none;
    -webkit-appearance: none;
    display: none;
  }

  .search-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-disabled);
    flex-shrink: 0;
    transition:
      color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default);
  }

  .search-clear:hover {
    color: var(--color-text-accent);
    border-color: rgb(196 154 90 / 0.3);
  }

  .count-readout {
    display: none;
    align-items: baseline;
    gap: 0.35rem;
    flex-shrink: 0;
    color: var(--color-text-disabled);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .count-shown {
    color: var(--color-text-primary);
    font-size: 0.78rem;
    font-weight: 600;
    text-shadow: 0 0 12px rgb(255 255 255 / 0.06);
  }

  .count-divider {
    color: var(--color-text-disabled);
  }

  .count-total {
    color: var(--color-text-muted);
  }

  .count-selected {
    color: var(--color-text-accent);
    text-shadow: 0 0 10px rgb(196 154 90 / 0.4);
  }

  @media (min-width: 720px) {
    .count-readout {
      display: inline-flex;
    }
  }

  /*
   * Two clusters share one wrapping row. The trailing cluster uses
   * `margin-left: auto` so it always hugs the right edge — both when the
   * row has spare width and when the leading cluster wraps and pushes
   * trailing to its own line. Without this, `justify-content: space-between`
   * collapses to `flex-start` once items wrap, leaving the trailing cluster
   * stranded against the left edge with empty space on the right.
   */
  .controls-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.4rem;
    min-width: 0;
  }

  .control-cluster {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .control-cluster-trailing {
    margin-left: auto;
    justify-content: flex-end;
  }

  .cluster-divider {
    display: inline-block;
    width: 1px;
    height: 1.1rem;
    background: linear-gradient(
      to bottom,
      transparent,
      rgb(255 255 255 / 0.08),
      transparent
    );
    margin: 0 0.15rem;
  }

  .ctrl-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    height: 2rem;
    min-height: 2rem;
    border: 1px solid var(--ctrl-border);
    background: var(--ctrl-bg);
    box-shadow: var(--ctrl-shadow);
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    padding: 0 0.6rem;
    transition:
      background var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default),
      box-shadow var(--duration-fast) var(--ease-default);
  }

  .ctrl-btn:hover {
    border-color: var(--ctrl-border-hover);
    background: var(--ctrl-bg-hover);
    color: var(--color-text-primary);
    box-shadow: var(--ctrl-shadow-hover);
  }

  .ctrl-btn:focus-visible {
    outline: none;
    border-color: rgb(196 154 90 / 0.7);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.05),
      0 0 0 2px rgb(196 154 90 / 0.2);
  }

  .ctrl-btn.is-active {
    border-color: var(--ctrl-border-active);
    background: var(--ctrl-bg-active);
    color: var(--color-text-accent-bright);
    box-shadow: var(--ctrl-shadow-active);
  }

  .ctrl-label {
    display: none;
  }

  @media (min-width: 520px) {
    .ctrl-label {
      display: inline;
    }
  }

  .ctrl-icon {
    width: 2rem;
    justify-content: center;
    padding: 0;
  }

  :global(.dir-arrow) {
    transition: transform var(--duration-normal) var(--ease-mechanical);
  }

  :global(.dir-arrow.is-up) {
    transform: rotate(180deg);
  }

  .sort-menu {
    position: absolute;
    left: 0;
    top: calc(100% + 0.3rem);
    z-index: 50;
    min-width: 10rem;
    border: 1px solid rgb(196 154 90 / 0.18);
    background:
      linear-gradient(180deg, rgb(24 28 38 / 0.96), rgb(14 17 22 / 0.98));
    box-shadow:
      0 12px 36px rgb(0 0 0 / 0.55),
      0 0 0 1px rgb(0 0 0 / 0.3),
      inset 0 1px 0 rgb(255 255 255 / 0.04);
    backdrop-filter: blur(16px);
    padding: 0.3rem 0;
  }

  .sort-menu-item {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.45rem 0.85rem;
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.74rem;
    letter-spacing: 0.04em;
    text-align: left;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .sort-menu-item:hover {
    background: rgb(255 255 255 / 0.04);
    color: var(--color-text-primary);
  }

  .sort-menu-item.is-active {
    background: linear-gradient(90deg, rgb(196 154 90 / 0.15), transparent);
    color: var(--color-text-accent-bright);
  }

  .filter-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1rem;
    min-width: 1rem;
    border: 1px solid rgb(196 154 90 / 0.4);
    background: linear-gradient(180deg, rgb(196 154 90 / 0.9), rgb(140 108 50 / 0.95));
    color: #1a1408;
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0;
    box-shadow: 0 0 10px rgb(196 154 90 / 0.35);
    padding: 0 0.25rem;
  }

  .thumb-size-control {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.55rem;
    height: 2rem;
    border: 1px solid var(--ctrl-border);
    background:
      linear-gradient(180deg, rgb(8 10 14 / 0.7), rgb(12 14 20 / 0.75));
    box-shadow:
      inset 0 2px 5px rgb(0 0 0 / 0.45),
      inset 0 -1px 0 rgb(255 255 255 / 0.025);
    color: var(--color-text-muted);
  }

  .thumb-size-control :global(.thumb-size-icon) {
    color: var(--color-text-disabled);
    flex-shrink: 0;
  }

  .thumb-size-control :global(.thumb-size-icon-min) {
    width: 0.78rem;
    height: 0.78rem;
  }

  .thumb-size-control :global(.thumb-size-icon-max) {
    width: 0.9rem;
    height: 0.9rem;
    transform: rotate(180deg);
  }

  .thumb-size-control input {
    width: 5rem;
    height: 14px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
  }

  .thumb-size-control input::-webkit-slider-runnable-track {
    height: 2px;
    background: linear-gradient(
      to right,
      rgb(196 154 90 / 0.5),
      rgb(196 154 90 / 0.05)
    );
    box-shadow: inset 0 0 4px rgb(0 0 0 / 0.6);
  }

  .thumb-size-control input::-moz-range-track {
    height: 2px;
    background: linear-gradient(
      to right,
      rgb(196 154 90 / 0.5),
      rgb(196 154 90 / 0.05)
    );
  }

  .thumb-size-control input::-webkit-slider-thumb {
    width: 11px;
    height: 11px;
    margin-top: -4.5px;
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid rgb(244 220 170);
    background: radial-gradient(circle at 30% 30%, #f3e6cc, #c79b5c 65%);
    box-shadow:
      0 0 6px rgb(196 154 90 / 0.55),
      0 0 12px rgb(196 154 90 / 0.25),
      inset 0 1px 0 rgb(255 255 255 / 0.3);
  }

  .thumb-size-control input::-moz-range-thumb {
    width: 11px;
    height: 11px;
    border: 1px solid rgb(244 220 170);
    background: radial-gradient(circle at 30% 30%, #f3e6cc, #c79b5c 65%);
    box-shadow:
      0 0 6px rgb(196 154 90 / 0.55),
      0 0 12px rgb(196 154 90 / 0.25);
  }

  .thumb-size-control input:focus-visible {
    outline: none;
  }

  .thumb-size-control input:focus-visible::-webkit-slider-thumb {
    box-shadow:
      0 0 0 3px rgb(196 154 90 / 0.25),
      0 0 12px rgb(196 154 90 / 0.4);
  }

  .view-toggle {
    display: inline-flex;
    align-items: center;
    height: 2rem;
    border: 1px solid var(--ctrl-border);
    background: var(--ctrl-bg);
    box-shadow: var(--ctrl-shadow);
  }

  .view-toggle button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 2rem;
    background: transparent;
    color: var(--color-text-muted);
    transition:
      background var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .view-toggle button:not(:disabled):hover {
    background: rgb(255 255 255 / 0.04);
    color: var(--color-text-primary);
  }

  .view-toggle button.is-active {
    background: var(--ctrl-bg-active);
    color: var(--color-text-accent-bright);
    box-shadow:
      inset 0 0 12px rgb(196 154 90 / 0.18),
      inset 0 1px 0 rgb(196 154 90 / 0.1);
  }

  /*
   * The filter chip strip reserves its height even when no filters are
   * active so the cards below don't jump when chips appear or disappear.
   * The brass accent rail + label only fade in alongside chips, but the
   * row's vertical footprint stays constant.
   */
  .filter-scroll {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    overflow-x: auto;
    padding: 0 0.1rem;
    scrollbar-width: thin;
    min-height: 1.85rem;
    border-left: 2px solid transparent;
    transition: border-color var(--duration-fast) var(--ease-default);
  }

  .filter-scroll.is-active {
    border-left-color: rgb(196 154 90 / 0.35);
    padding-left: 0.55rem;
  }

  .filter-chip-label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
    color: var(--color-text-disabled);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.16em;
  }

  .filter-chip {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.4rem;
    height: 1.6rem;
    border: 1px solid rgb(255 255 255 / 0.06);
    background:
      linear-gradient(180deg, rgb(28 32 42 / 0.85), rgb(16 19 26 / 0.95));
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.66rem;
    line-height: 1;
    padding: 0 0.5rem;
    transition:
      border-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default),
      background var(--duration-fast) var(--ease-default);
  }

  .filter-chip:hover {
    border-color: rgb(204 120 128 / 0.5);
    background:
      linear-gradient(180deg, rgb(54 22 28 / 0.85), rgb(34 14 18 / 0.95));
    color: rgb(255 184 184);
  }

  .filter-chip span {
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /*
   * On narrow viewports the labels collapse to icons (below 520px) and the
   * thumb-size slider shrinks so the leading cluster fits in one row.
   * The trailing cluster keeps `margin-left: auto` to stay flush right —
   * never stranded against the left edge with empty space to its right.
   */
  @media (max-width: 520px) {
    .toolbar-root {
      padding: 0.6rem 0.6rem;
    }

    .thumb-size-control {
      gap: 0.35rem;
      padding: 0 0.45rem;
    }

    .thumb-size-control input {
      width: 3.25rem;
    }
  }
</style>
