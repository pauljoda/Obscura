<script module lang="ts">
  export type SortDir = "asc" | "desc";
  export type ViewMode = "grid" | "list" | "series";

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
</script>

<script lang="ts">
  import {
    SlidersHorizontal,
    ArrowUpDown,
    LayoutGrid,
    LayoutList,
    FolderOpen,
    Search as SearchIcon,
    ChevronDown,
    Check,
    Tag,
    RotateCcw,
    Users,
    CalendarRange,
    Building2,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { tagsVisibleInNsfwMode } from "$lib/nsfw-tags";
  import FilterChip from "./FilterChip.svelte";
  import FilterSection from "./FilterSection.svelte";
  import AlphabeticalFilterSection, {
    type AlphabeticalFilterSectionItem,
  } from "./AlphabeticalFilterSection.svelte";
  import FilterPresetDropdown, { type FilterPreset } from "./FilterPresetDropdown.svelte";

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
    defaultSortDir?: Record<string, SortDir>;
    /** Placeholder text for the search box. */
    searchPlaceholder?: string;
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
    defaultSortDir = {},
    searchPlaceholder = "Search videos...",
  }: Props = $props();

  let sortOpen = $state(false);
  let filterPanelOpen = $state(false);
  const nsfw = useNsfw();

  const currentSort = $derived(sortOptions.find((s) => s.value === sortBy));
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
    Boolean(onAddFilter) ||
      availableTags.length + availablePerformers.length + availableStudios.length > 0,
  );
</script>

<div class="space-y-0">
  <!-- Main toolbar -->
  <div class="surface-well px-3 py-2 space-y-2 sm:space-y-0">
    <!-- Search — own row on mobile -->
    <div class="relative sm:hidden">
      <SearchIcon
        class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none"
      />
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={searchQuery}
        oninput={(e) => onSearchChange((e.currentTarget as HTMLInputElement).value)}
        class={cn(
          "w-full bg-surface-2 border border-border-subtle pl-7 pr-3 py-1.5 text-[0.78rem] text-text-primary",
          "placeholder:text-text-disabled",
          "focus:outline-none focus:border-accent-500",
          "transition-colors duration-fast",
        )}
      />
    </div>

    <!-- Controls row -->
    <div class="flex items-center gap-2">
      <!-- Search — inline on desktop -->
      <div class="relative flex-1 min-w-0 hidden sm:block">
        <SearchIcon
          class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none"
        />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          oninput={(e) => onSearchChange((e.currentTarget as HTMLInputElement).value)}
          class={cn(
            "w-full bg-transparent pl-7 pr-3 py-1.5 text-[0.78rem] text-text-primary",
            "placeholder:text-text-disabled",
            "focus:outline-none",
            "transition-colors duration-fast",
          )}
        />
      </div>

      <!-- Active filter chips -->
      {#if activeFilters.length > 0}
        <div class="hidden sm:flex items-center gap-1.5 border-l border-border-subtle pl-2">
          {#each activeFilters as filter, i (i + ":" + filter.value)}
            <FilterChip
              label={filter.label}
              value={filter.value}
              onRemove={() => onRemoveFilter?.(i)}
            />
          {/each}
        </div>
      {/if}

      <!-- Divider -->
      <div class="hidden sm:block h-5 w-px bg-border-subtle"></div>

      <!-- Sort dropdown + direction toggle -->
      <div class="flex items-center">
        <div class="relative">
          <button
            type="button"
            onclick={() => (sortOpen = !sortOpen)}
            class={cn(
              "flex items-center gap-1.5 px-2 py-1.5",
              "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
              "transition-colors duration-fast",
            )}
          >
            <ArrowUpDown class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">{currentSort?.label}</span>
            <ChevronDown class="h-3 w-3 text-text-disabled" />
          </button>

          {#if sortOpen}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="fixed inset-0 z-40" onclick={() => (sortOpen = false)}></div>
            <div class="absolute right-0 top-full mt-1 z-50 w-44 surface-elevated py-1">
              {#each sortOptions as opt (opt.value)}
                <button
                  type="button"
                  onclick={() => {
                    onSortChange(opt.value, defaultSortDir[opt.value]);
                    sortOpen = false;
                  }}
                  class={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 text-[0.72rem] text-left transition-colors duration-fast",
                    sortBy === opt.value
                      ? "text-text-accent bg-accent-950"
                      : "text-text-muted hover:text-text-primary hover:bg-surface-3",
                  )}
                >
                  <Check class={cn("h-3 w-3", sortBy === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Direction toggle -->
        <button
          type="button"
          onclick={() => onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc")}
          title={sortDir === "asc" ? "Ascending — click to reverse" : "Descending — click to reverse"}
          class={cn(
            "flex h-7 w-7 items-center justify-center",
            "text-text-muted hover:text-text-primary hover:bg-surface-2",
            "transition-colors duration-fast",
          )}
          aria-label={`Sort direction ${sortDir}`}
        >
          <ChevronDown class={cn("h-3.5 w-3.5", sortDir === "asc" && "rotate-180")} />
        </button>
      </div>

      {#if showViewToggle && onViewModeChange}
        <div class="flex items-center border border-border-subtle overflow-hidden">
          <button
            type="button"
            title="Grid view"
            aria-label="Grid view"
            onclick={() => onViewModeChange("grid")}
            class={cn(
              "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
              viewMode === "grid"
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2",
            )}
          >
            <LayoutGrid class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="List view"
            aria-label="List view"
            onclick={() => onViewModeChange("list")}
            class={cn(
              "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
              viewMode === "list"
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2",
            )}
          >
            <LayoutList class="h-3.5 w-3.5" />
          </button>
          {#if showSeriesView}
            <button
              type="button"
              title="Series view"
              aria-label="Series view"
              onclick={() => onViewModeChange("series")}
              class={cn(
                "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                viewMode === "series"
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2",
              )}
            >
              <FolderOpen class="h-3.5 w-3.5" />
            </button>
          {/if}
        </div>
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
        <FilterPresetDropdown
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
  </div>

  {#if filterPanelOpen}
    <div class="surface-well mt-px p-3">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <FilterSection title="Resolution">
          {#snippet children()}
            <div class="flex flex-wrap gap-1">
              {#each ["4K", "1080p", "720p", "480p"] as res}
                <button
                  type="button"
                  onclick={() => onAddFilter?.("resolution", "Resolution", res)}
                  class={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    panelFilters.some((f) => f.type === "resolution" && f.value === res)
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  {res}
                </button>
              {/each}
            </div>
          {/snippet}
        </FilterSection>

        <FilterSection title="Rating">
          {#snippet children()}
            <div class="space-y-2">
              <div class="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled">
                At least
              </div>
              <div class="flex flex-wrap gap-1">
                {#each [1, 2, 3, 4, 5] as n (n)}
                  <button
                    type="button"
                    onclick={() => onAddFilter?.("ratingMin", "Min rating", String(n))}
                    class={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      panelFilters.some((f) => f.type === "ratingMin" && f.value === String(n))
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    {n}★+
                  </button>
                {/each}
              </div>
              <div class="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled">
                At most
              </div>
              <div class="flex flex-wrap gap-1">
                {#each [1, 2, 3, 4, 5] as n (n)}
                  <button
                    type="button"
                    onclick={() => onAddFilter?.("ratingMax", "Max rating", String(n))}
                    class={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      panelFilters.some((f) => f.type === "ratingMax" && f.value === String(n))
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    ≤{n}★
                  </button>
                {/each}
              </div>
            </div>
          {/snippet}
        </FilterSection>

        <FilterSection title="Video date">
          {#snippet children()}
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 text-[0.7rem] text-text-muted">
                <CalendarRange class="h-3 w-3 shrink-0 text-text-disabled" />
                <span class="font-mono text-[0.6rem] uppercase tracking-wider">From</span>
                <input
                  type="date"
                  class="flex-1 min-w-0 bg-surface-1 border border-border-subtle px-2 py-1 text-[0.72rem] text-text-primary focus:outline-none focus:border-border-accent"
                  onchange={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value;
                    if (v) onAddFilter?.("dateFrom", "Date from", v);
                  }}
                />
              </label>
              <label class="flex items-center gap-2 text-[0.7rem] text-text-muted">
                <CalendarRange class="h-3 w-3 shrink-0 text-text-disabled" />
                <span class="font-mono text-[0.6rem] uppercase tracking-wider">To</span>
                <input
                  type="date"
                  class="flex-1 min-w-0 bg-surface-1 border border-border-subtle px-2 py-1 text-[0.72rem] text-text-primary focus:outline-none focus:border-border-accent"
                  onchange={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value;
                    if (v) onAddFilter?.("dateTo", "Date to", v);
                  }}
                />
              </label>
            </div>
          {/snippet}
        </FilterSection>

        <FilterSection title="Duration">
          {#snippet children()}
            <div class="flex flex-wrap gap-1">
              {#each [{ id: "lt300", label: "< 5 min" }, { id: "300-900", label: "5–15 min" }, { id: "900-1800", label: "15–30 min" }, { id: "gte1800", label: "30+ min" }] as d (d.id)}
                <button
                  type="button"
                  onclick={() => onAddFilter?.("duration", "Duration", d.id)}
                  class={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    panelFilters.some((f) => f.type === "duration" && f.value === d.id)
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  {d.label}
                </button>
              {/each}
            </div>
          {/snippet}
        </FilterSection>

        <FilterSection title="Playback & file">
          {#snippet children()}
            <div class="flex flex-wrap gap-1">
              {#each [{ type: "played", value: "true", label: "Played" }, { type: "played", value: "false", label: "Unplayed" }, { type: "hasFile", value: "true", label: "Has file" }, { type: "hasFile", value: "false", label: "No file" }] as item (`${item.type}-${item.value}`)}
                <button
                  type="button"
                  onclick={() =>
                    onAddFilter?.(
                      item.type,
                      item.type === "played" ? "Playback" : "File",
                      item.value,
                    )}
                  class={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    panelFilters.some((f) => f.type === item.type && f.value === item.value)
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  {item.label}
                </button>
              {/each}
            </div>
          {/snippet}
        </FilterSection>

        <FilterSection title="Library flags">
          {#snippet children()}
            <div class="flex flex-wrap gap-1">
              {#each [{ type: "organized", value: "true", label: "Organized" }, { type: "organized", value: "false", label: "Not organized" }, { type: "interactive", value: "true", label: "Interactive" }, { type: "interactive", value: "false", label: "Not interactive" }] as item (`${item.type}-${item.value}`)}
                <button
                  type="button"
                  onclick={() =>
                    onAddFilter?.(
                      item.type,
                      item.type === "organized" ? "Organized" : "Interactive",
                      item.value,
                    )}
                  class={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    panelFilters.some((f) => f.type === item.type && f.value === item.value)
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  {item.label}
                </button>
              {/each}
            </div>
          {/snippet}
        </FilterSection>

        <FilterSection title="Codec">
          {#snippet children()}
            <div class="flex flex-wrap gap-1">
              {#each [{ id: "h264", label: "H.264" }, { id: "hevc", label: "HEVC" }, { id: "av1", label: "AV1" }, { id: "vp9", label: "VP9" }, { id: "vp8", label: "VP8" }, { id: "mpeg4", label: "MPEG-4" }, { id: "prores", label: "ProRes" }, { id: "wmv", label: "WMV" }] as c (c.id)}
                <button
                  type="button"
                  onclick={() => onAddFilter?.("codec", "Codec", c.id)}
                  class={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    panelFilters.some((f) => f.type === "codec" && f.value === c.id)
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  {c.label}
                </button>
              {/each}
            </div>
          {/snippet}
        </FilterSection>

        {#if tagItems.length > 0}
          <div class="md:col-span-2 xl:col-span-3">
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
                )}
              onToggle={(item) => onAddFilter?.("tag", "Tag", item.name)}
            />
          </div>
        {/if}

        {#if performerItems.length > 0}
          <div class="md:col-span-2 xl:col-span-3">
            <AlphabeticalFilterSection
              title="Performers"
              icon={Users}
              items={performerItems}
              searchPlaceholder="Filter performers..."
              emptyIcon={Users}
              emptyLabel="performers"
              chipVariant="info"
              isActive={(item) =>
                panelFilters.some((f) => f.type === "performer" && f.value === item.name)}
              onToggle={(item) => onAddFilter?.("performer", "Performer", item.name)}
            />
          </div>
        {/if}

        {#if studioItems.length > 0}
          <div class="md:col-span-2 xl:col-span-3">
            <AlphabeticalFilterSection
              title="Studios"
              icon={Building2}
              items={studioItems}
              searchPlaceholder="Filter studios..."
              emptyIcon={Building2}
              emptyLabel="studios"
              chipVariant="accent"
              isActive={(item) =>
                panelFilters.some((f) => f.type === "studio" && f.value === item.id)}
              onToggle={(item) => onAddFilter?.("studio", "Studio", item.id)}
            />
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Mobile active filters row -->
  {#if activeFilters.length > 0}
    <div
      class="flex sm:hidden items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hidden"
    >
      {#each activeFilters as filter, i (i + ":" + filter.value)}
        <FilterChip label={filter.label} value={filter.value} onRemove={() => onRemoveFilter?.(i)} />
      {/each}
    </div>
  {/if}
</div>
