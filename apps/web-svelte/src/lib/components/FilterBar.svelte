<script module lang="ts">
  export type SortDir = "asc" | "desc";
  export type ViewMode = "grid" | "list";
  export interface SortOption<T extends string = string> {
    value: T;
    label: string;
  }
  export interface ActiveFilter {
    label: string;
    value: string;
    type?: string;
  }
</script>

<script lang="ts">
  import {
    ArrowUpDown,
    LayoutGrid,
    LayoutList,
    Search as SearchIcon,
    ChevronDown,
    RotateCcw,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";

  interface Props {
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    sortBy: string;
    sortDir: SortDir;
    sortOptions: SortOption[];
    onSortChange: (sort: string, dir?: SortDir) => void;
    activeFilters?: ActiveFilter[];
    onRemoveFilter?: (index: number) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onClearFiltersAndSort?: () => void;
    canClearFiltersAndSort?: boolean;
    showViewToggle?: boolean;
  }

  let {
    viewMode = "grid",
    onViewModeChange,
    sortBy,
    sortDir,
    sortOptions,
    onSortChange,
    activeFilters = [],
    onRemoveFilter,
    searchQuery,
    onSearchChange,
    onClearFiltersAndSort,
    canClearFiltersAndSort = false,
    showViewToggle = true,
  }: Props = $props();

  let sortOpen = $state(false);
  let menuEl: HTMLDivElement | undefined = $state();

  const currentSort = $derived(sortOptions.find((s) => s.value === sortBy));

  function onDocClick(e: MouseEvent) {
    if (!sortOpen) return;
    if (menuEl && !menuEl.contains(e.target as Node)) sortOpen = false;
  }

  $effect(() => {
    if (sortOpen) {
      window.addEventListener("click", onDocClick, true);
      return () => window.removeEventListener("click", onDocClick, true);
    }
  });
</script>

<div class="surface-panel px-3 py-2.5 space-y-2">
  <div class="flex items-center gap-2 flex-wrap">
    <!-- Search -->
    <div class="relative flex-1 min-w-[200px] max-w-md">
      <SearchIcon
        class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled"
      />
      <input
        type="search"
        value={searchQuery}
        oninput={(e) => onSearchChange((e.currentTarget as HTMLInputElement).value)}
        placeholder="Search"
        class="w-full bg-surface-2 border border-border-default pl-8 pr-3 py-1.5 text-body-sm text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
      />
    </div>

    <!-- Sort dropdown -->
    <div class="relative" bind:this={menuEl}>
      <button
        type="button"
        onclick={() => (sortOpen = !sortOpen)}
        class="surface-well px-2.5 py-1.5 text-body-sm text-text-muted hover:text-text-primary transition-colors duration-fast inline-flex items-center gap-1.5"
      >
        <ArrowUpDown class="h-3.5 w-3.5" />
        <span>{currentSort?.label ?? "Sort"}</span>
        <ChevronDown class={cn("h-3 w-3 transition-transform", sortOpen && "rotate-180")} />
      </button>
      {#if sortOpen}
        <div
          class="absolute right-0 top-full mt-1 min-w-[200px] surface-panel z-40 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        >
          {#each sortOptions as opt (opt.value)}
            <button
              type="button"
              onclick={() => {
                onSortChange(opt.value);
                sortOpen = false;
              }}
              class={cn(
                "w-full text-left px-3 py-1.5 text-body-sm transition-colors duration-fast",
                opt.value === sortBy
                  ? "bg-accent-950 text-accent-200"
                  : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
              )}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Sort direction toggle -->
    <button
      type="button"
      onclick={() => onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc")}
      class="surface-well px-2 py-1.5 text-body-sm text-text-muted hover:text-text-primary transition-colors duration-fast"
      aria-label={`Sort direction: ${sortDir}`}
      title={`Sort direction: ${sortDir}`}
    >
      {sortDir === "asc" ? "↑" : "↓"}
    </button>

    {#if showViewToggle && onViewModeChange}
      <div class="ml-auto flex items-center surface-well overflow-hidden">
        <button
          type="button"
          onclick={() => onViewModeChange("grid")}
          class={cn(
            "px-2.5 py-1.5 transition-colors duration-fast",
            viewMode === "grid"
              ? "bg-accent-950 text-accent-200"
              : "text-text-muted hover:text-text-primary hover:bg-surface-2",
          )}
          aria-label="Grid view"
        >
          <LayoutGrid class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onclick={() => onViewModeChange("list")}
          class={cn(
            "px-2.5 py-1.5 transition-colors duration-fast border-l border-border-subtle",
            viewMode === "list"
              ? "bg-accent-950 text-accent-200"
              : "text-text-muted hover:text-text-primary hover:bg-surface-2",
          )}
          aria-label="List view"
        >
          <LayoutList class="h-3.5 w-3.5" />
        </button>
      </div>
    {/if}

    {#if canClearFiltersAndSort && onClearFiltersAndSort}
      <button
        type="button"
        onclick={onClearFiltersAndSort}
        class="surface-well px-2.5 py-1.5 text-body-sm text-text-muted hover:text-error-text transition-colors duration-fast inline-flex items-center gap-1"
        title="Clear filters + sort"
      >
        <RotateCcw class="h-3 w-3" />
        Reset
      </button>
    {/if}
  </div>

  {#if activeFilters.length > 0}
    <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border-subtle">
      {#each activeFilters as f, i (i + ":" + f.value)}
        <button
          type="button"
          onclick={() => onRemoveFilter?.(i)}
          class="inline-flex items-center gap-1 border border-border-accent/50 bg-accent-950 px-2 py-0.5 text-[0.7rem] text-accent-200 hover:border-error/50 hover:text-error-text transition-colors duration-fast"
        >
          {f.label}
          <span class="text-[0.65rem] opacity-70">×</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
