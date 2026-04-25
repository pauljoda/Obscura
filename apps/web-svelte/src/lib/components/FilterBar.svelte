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
  import {
    SlidersHorizontal,
    ArrowUpDown,
    LayoutGrid,
    LayoutList,
    Rows3,
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
  import { cn, dur, ease, scaleChip } from "@obscura/ui-svelte";
  import { flip } from "svelte/animate";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import { tagsVisibleInNsfwMode } from "$lib/nsfw/tags";
  import type { Snippet } from "svelte";
  import FilterChip from "./FilterChip.svelte";
  import FilterSection from "./FilterSection.svelte";
  import ThumbSizeSlider from "$lib/media-surface/toolbar/ThumbSizeSlider.svelte";
  import AlphabeticalFilterSection, {
    type AlphabeticalFilterSectionItem,
  } from "./AlphabeticalFilterSection.svelte";
  import FilterPresetDropdown, { type FilterPreset } from "./FilterPresetDropdown.svelte";

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
    /** Placeholder text for the search box. */
    searchPlaceholder?: string;
    /** Integrated thumbnail-size slider. Renders inline on desktop and on its own row on mobile. */
    thumbSize?: ThumbSizeConfig;
    /** Extra sections rendered at the top of the filter drawer. */
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
    Boolean(customFilterSections) ||
      Boolean(onAddFilter) ||
      availableTags.length + availablePerformers.length + availableStudios.length > 0,
  );
  const enabledSections = $derived(new Set(filterSections));
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
          {#each activeFilters as filter, i (filter.type + ":" + filter.value)}
            <span
              class="inline-flex"
              animate:flip={{ duration: dur.fast, easing: ease.mechanical }}
              in:scaleChip
              out:scaleChip
            >
              <FilterChip
                label={filter.label}
                value={filter.value}
                onRemove={() => onRemoveFilter?.(i)}
              />
            </span>
          {/each}
        </div>
      {/if}

      <!-- Divider -->
      <div class="hidden sm:block h-5 w-px bg-border-subtle"></div>

      {#if showSortControls}
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
              <button
                type="button"
                class="fixed inset-0 z-40"
                aria-label="Close sort menu"
                onclick={() => (sortOpen = false)}
              ></button>
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
          {#if showFeedView}
            <button
              type="button"
              title="Feed view"
              aria-label="Feed view"
              onclick={() => onViewModeChange("feed")}
              class={cn(
                "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                viewMode === "feed"
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2",
              )}
            >
              <Rows3 class="h-3.5 w-3.5" />
            </button>
          {/if}
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
    <div class="surface-well mt-px p-3">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {#if customFilterSections}
          {@render customFilterSections({ panelFilters })}
        {/if}
        {#if enabledSections.has("resolution")}
          <FilterSection title="Resolution">
            {#snippet children()}
              <div class="flex flex-wrap gap-1">
                {#each ["4K", "1080p", "720p", "480p"] as res (res)}
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
        {/if}

        {#if enabledSections.has("rating")}
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
        {/if}

        {#if enabledSections.has("date")}
        <FilterSection title="Date">
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
        {/if}

        {#if enabledSections.has("duration")}
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
        {/if}

        {#if enabledSections.has("playback")}
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
        {/if}

        {#if enabledSections.has("libraryFlags")}
        <FilterSection title="Library flags">
          {#snippet children()}
            <div class="flex flex-wrap gap-1">
              {#each [
                { type: "organized", value: "true", label: "Organized" },
                { type: "organized", value: "false", label: "Not organized" },
                ...(showInteractiveFilter
                  ? [
                      { type: "interactive", value: "true", label: "Interactive" },
                      { type: "interactive", value: "false", label: "Not interactive" },
                    ]
                  : []),
              ] as item (`${item.type}-${item.value}`)}
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
        {/if}

        {#if enabledSections.has("codec")}
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
        {/if}

        {#if enabledSections.has("tags") && tagItems.length > 0}
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

        {#if enabledSections.has("performers") && performerItems.length > 0}
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

        {#if enabledSections.has("studios") && studioItems.length > 0}
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
      {#each activeFilters as filter, i (filter.type + ":" + filter.value)}
        <span
          class="inline-flex"
          animate:flip={{ duration: dur.fast, easing: ease.mechanical }}
          in:scaleChip
          out:scaleChip
        >
          <FilterChip label={filter.label} value={filter.value} onRemove={() => onRemoveFilter?.(i)} />
        </span>
      {/each}
    </div>
  {/if}
</div>
