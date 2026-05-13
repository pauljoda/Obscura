<script lang="ts">
  import { browser } from "$app/environment";
  import { SearchX } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { createFilterPresets, type FilterPreset } from "$lib/filter-presets";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";
  import {
    ENTITY_GRID_ALL_KINDS,
    applyEntityGridState,
    buildCapabilityFilterOptions,
    buildEntityKindTabs,
    entityGridRequestFromState,
    entityGridFilterFromId,
    type EntityGridRequest,
    type EntityGridSort,
    type EntityGridSortDir,
    type EntityGridViewMode,
    type EntityGridBulkAction,
  } from "$lib/entities/entity-grid";
  import type { EntityThumbnailCard } from "$lib/entities/entity-thumbnail";
  import EntityGridFilterDrawer from "./EntityGridFilterDrawer.svelte";
  import EntityGridTabs from "./EntityGridTabs.svelte";
  import EntityGridToolbar from "./EntityGridToolbar.svelte";

  interface Props {
    bulkActions?: EntityGridBulkAction[];
    cards: EntityThumbnailCard[];
    emptyMessage?: string;
    emptyTitle?: string;
    loading?: boolean;
    maxScale?: number;
    minScale?: number;
    nsfwMode?: "show" | "off" | "blur";
    onRequestChange?: (request: EntityGridRequest) => void;
    onSelectionChange?: (selectedIds: string[]) => void;
    prefsKey?: string;
    selectable?: boolean;
  }

  let {
    bulkActions = [],
    cards,
    emptyMessage = "Try adjusting your search or filters.",
    emptyTitle = "Nothing present",
    loading = false,
    maxScale = 12,
    minScale = 2,
    nsfwMode = "show",
    onRequestChange,
    onSelectionChange,
    prefsKey,
    selectable = true,
  }: Props = $props();

  function storageKey(): string | null {
    return prefsKey ? `obscura:entity-grid:${prefsKey}` : null;
  }

  function presetStorageKey(): string | null {
    return prefsKey ? `obscura:entity-grid-presets:${prefsKey}` : null;
  }

  function loadScale(): number {
    const fallbackScale = 5;
    if (!browser) return fallbackScale;
    const key = storageKey();
    if (!key) return fallbackScale;
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallbackScale;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.min(maxScale, Math.max(minScale, parsed)) : fallbackScale;
  }

  let activeKind = $state(ENTITY_GRID_ALL_KINDS);
  let activePresetId = $state<string | null>(null);
  let drawerOpen = $state(false);
  let filterIds = $state<string[]>([]);
  let includeNsfw = $state(true);
  let presets = $state<FilterPreset[]>([]);
  let query = $state("");
  let scale = $state(5);
  let selectedIds = $state<string[]>([]);
  let sortBy = $state<EntityGridSort>("title");
  let sortDir = $state<EntityGridSortDir>("asc");
  let viewMode = $state<EntityGridViewMode>("grid");

  const gridState = $derived({
    activeKind,
    filterIds,
    includeNsfw: nsfwMode === "show" && includeNsfw,
    query,
    sortBy,
    sortDir,
  });
  const tabs = $derived(buildEntityKindTabs(cards, { includeNsfw: gridState.includeNsfw }));
  const filterOptions = $derived(buildCapabilityFilterOptions(cards));
  const visibleCards = $derived(applyEntityGridState(cards, gridState, filterOptions));
  const selectedCount = $derived(selectedIds.length);
  const request = $derived(entityGridRequestFromState(gridState, filterOptions));

  onMount(() => {
    scale = loadScale();
    const key = presetStorageKey();
    if (key) presets = createFilterPresets(key).load();
  });

  $effect(() => {
    onRequestChange?.(request);
  });

  function persistScale(next: number) {
    scale = Math.min(maxScale, Math.max(minScale, next));
    const key = storageKey();
    if (browser && key) window.localStorage.setItem(key, String(scale));
  }

  function setActiveKind(kind: string) {
    activeKind = kind;
    activePresetId = null;
    selectedIds = [];
    onSelectionChange?.(selectedIds);
  }

  function setFilterIds(ids: string[]) {
    filterIds = ids;
    activePresetId = null;
  }

  function setIncludeNsfw(value: boolean) {
    includeNsfw = value;
    activePresetId = null;
  }

  function setQuery(value: string) {
    query = value;
    activePresetId = null;
  }

  function setSortBy(value: EntityGridSort) {
    sortBy = value;
    activePresetId = null;
  }

  function setSortDir(value: EntityGridSortDir) {
    sortDir = value;
    activePresetId = null;
  }

  function setViewMode(value: EntityGridViewMode) {
    viewMode = value;
  }

  function savePresets(next: FilterPreset[]) {
    presets = next;
    const key = presetStorageKey();
    if (key) createFilterPresets(key).save(next);
  }

  function filterToPresetEntry(id: string) {
    const option = entityGridFilterFromId(id, filterOptions);
    return {
      label: option?.label ?? id,
      type: option?.capabilityKind ?? "capability",
      value: id,
    };
  }

  function currentPresetShape(id: string, name: string): FilterPreset {
    return {
      id,
      name,
      filters: filterIds.map(filterToPresetEntry),
      sortBy,
      sortDir,
    };
  }

  function applyPreset(preset: FilterPreset) {
    filterIds = preset.filters
      .map((filter) => filter.value)
      .filter((id) => Boolean(entityGridFilterFromId(id, filterOptions)));
    sortBy = preset.sortBy === "kind" || preset.sortBy === "rating" ? preset.sortBy : "title";
    sortDir = preset.sortDir;
    activePresetId = preset.id;
  }

  function savePreset(name: string) {
    const id = `entity-grid-preset-${Date.now().toString(36)}`;
    const next = [currentPresetShape(id, name), ...presets].slice(0, 20);
    activePresetId = id;
    savePresets(next);
  }

  function overwritePreset(id: string) {
    const existing = presets.find((preset) => preset.id === id);
    if (!existing) return;
    savePresets(presets.map((preset) => (preset.id === id ? currentPresetShape(id, existing.name) : preset)));
    activePresetId = id;
  }

  function deletePreset(id: string) {
    savePresets(presets.filter((preset) => preset.id !== id));
    if (activePresetId === id) activePresetId = null;
  }

  function clearFiltersAndSort() {
    activeKind = ENTITY_GRID_ALL_KINDS;
    activePresetId = null;
    filterIds = [];
    includeNsfw = true;
    query = "";
    selectedIds = [];
    sortBy = "title";
    sortDir = "asc";
    viewMode = "grid";
    onSelectionChange?.(selectedIds);
  }

  function updateSelection(id: string, selected: boolean) {
    selectedIds = selected
      ? Array.from(new Set([...selectedIds, id]))
      : selectedIds.filter((selectedId) => selectedId !== id);
    onSelectionChange?.(selectedIds);
  }
</script>

<section class="entity-grid" style:--col-count={scale}>
  <EntityGridToolbar
    activeFilterIds={filterIds}
    {activePresetId}
    canClearFiltersAndSort={Boolean(
      activeKind !== ENTITY_GRID_ALL_KINDS ||
        filterIds.length > 0 ||
        !includeNsfw ||
        query ||
        sortBy !== "title" ||
        sortDir !== "asc" ||
        selectedIds.length > 0,
    )}
    {drawerOpen}
    {filterOptions}
    {maxScale}
    {minScale}
    onActiveFilterIdsChange={setFilterIds}
    onApplyPreset={applyPreset}
    onClearFiltersAndSort={clearFiltersAndSort}
    onDeletePreset={deletePreset}
    onDrawerOpenChange={(open) => (drawerOpen = open)}
    onOverwritePreset={overwritePreset}
    onQueryChange={setQuery}
    onSavePreset={savePreset}
    onScaleChange={persistScale}
    onSortByChange={setSortBy}
    onSortDirChange={setSortDir}
    onViewModeChange={setViewMode}
    {presets}
    {query}
    {scale}
    {selectedCount}
    {sortBy}
    {sortDir}
    totalCount={cards.length}
    visibleCount={visibleCards.length}
    {viewMode}
  />

  {#if drawerOpen}
    <EntityGridFilterDrawer
      activeFilterIds={filterIds}
      {filterOptions}
      onActiveFilterIdsChange={setFilterIds}
    />
  {/if}

  <EntityGridTabs
    {activeKind}
    onActiveKindChange={setActiveKind}
    {tabs}
    totalCount={cards.length}
  />

  {#if selectedIds.length > 0}
    <div class="bulk-bar" role="status" aria-live="polite">
      <span>{selectedIds.length} selected</span>
      <div class="bulk-actions">
        <button
          type="button"
          onclick={() => {
            selectedIds = visibleCards.map((c) => c.entity.id);
            onSelectionChange?.(selectedIds);
          }}
        >
          Select all
        </button>
        {#each bulkActions as action (action.id)}
          <button
            type="button"
            class:danger={action.tone === "danger"}
            onclick={() => action.onRun(selectedIds)}
          >
            {action.label}
          </button>
        {/each}
        <button type="button" onclick={() => {
          selectedIds = [];
          onSelectionChange?.(selectedIds);
        }}>
          Clear selection
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="loading-grid" aria-label="Loading entities" aria-busy="true">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="skeleton-card">
          <div class="skeleton-media"></div>
          <div class="skeleton-body">
            <span></span>
            <small></small>
            <em></em>
          </div>
        </div>
      {/each}
    </div>
  {:else if visibleCards.length > 0}
    <div class="cards" class:is-list={viewMode === "list"} aria-label="Entities">
      {#each visibleCards as card (card.entity.id)}
        <EntityThumbnail
          {card}
          layout={viewMode}
          {selectable}
          selected={selectedIds.includes(card.entity.id)}
          onSelectedChange={(selected) => updateSelection(card.entity.id, selected)}
        />
      {/each}
    </div>
  {:else}
    <div class="empty" role="status">
      <span class="empty-icon">
        <SearchX aria-hidden="true" />
      </span>
      <strong>{emptyTitle}</strong>
      <span>{emptyMessage}</span>
    </div>
  {/if}
</section>

<style>
  .entity-grid {
    display: grid;
    gap: 0.85rem;
    min-width: 0;
  }

  .cards,
  .loading-grid {
    display: grid;
    grid-template-columns: repeat(
      max(1, min(calc(var(--col-count, 5) - 1), 4)),
      minmax(0, 1fr)
    );
    gap: 0.75rem;
    align-items: start;
    overflow-anchor: none;
    contain: layout paint;
    transition: grid-template-columns 240ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .cards.is-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .skeleton-card {
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-1);
    box-shadow: inset 0 2px 8px rgb(0 0 0 / 0.3);
  }

  .skeleton-media {
    aspect-ratio: 16 / 9;
    background:
      linear-gradient(90deg, transparent, rgb(255 255 255 / 0.08), transparent),
      var(--color-surface-2);
    background-size: 200% 100%;
    animation: shimmer 1.15s linear infinite;
  }

  .skeleton-body {
    display: grid;
    gap: 0.55rem;
    padding: 0.75rem;
  }

  .skeleton-body span,
  .skeleton-body small,
  .skeleton-body em {
    display: block;
    height: 0.72rem;
    background: var(--color-surface-3);
    opacity: 0.72;
  }

  .skeleton-body span {
    width: 76%;
    height: 1rem;
  }

  .skeleton-body small {
    width: 54%;
  }

  .skeleton-body em {
    width: 38%;
  }

  @keyframes shimmer {
    from {
      background-position: 100% 0;
    }

    to {
      background-position: -100% 0;
    }
  }

  .empty {
    display: grid;
    gap: 0.35rem;
    min-height: 12rem;
    place-content: center;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-1);
    box-shadow: inset 0 2px 8px rgb(0 0 0 / 0.3);
    color: var(--color-text-muted);
    text-align: center;
  }

  .empty-icon {
    display: grid;
    place-items: center;
    justify-self: center;
    width: 2rem;
    height: 2rem;
    color: var(--color-text-disabled);
  }

  .empty-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .bulk-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-1);
    box-shadow: inset 0 2px 8px rgb(0 0 0 / 0.3);
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.7rem;
    padding: 0.55rem 0.7rem;
  }

  .bulk-bar > span {
    color: var(--color-text-accent);
    text-transform: uppercase;
  }

  .bulk-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: flex-end;
  }

  .bulk-actions button {
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: 0.68rem;
    padding: 0.32rem 0.5rem;
    transition:
      border-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .bulk-actions button:hover {
    border-color: var(--color-border-accent);
    color: var(--color-text-accent);
  }

  .bulk-actions button.danger:hover {
    border-color: var(--color-error-border, rgb(179 79 86 / 0.5));
    color: var(--color-error-text);
  }

  .empty strong {
    color: var(--color-text-primary);
    font-family: var(--font-heading, Geist, sans-serif);
    font-size: 1.1rem;
  }

  .empty span {
    font-size: 0.85rem;
  }

  @media (min-width: 640px) {
    .cards,
    .loading-grid {
      grid-template-columns: repeat(max(1, min(var(--col-count, 5), 4)), minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    .cards,
    .loading-grid {
      grid-template-columns: repeat(var(--col-count, 5), minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cards,
    .loading-grid {
      transition: none;
    }
  }
</style>
