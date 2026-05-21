<script lang="ts">
  import { browser } from "$app/environment";
  import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    LoaderCircle,
    SearchX,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { createFilterPresets, type FilterPreset } from "$lib/filter-presets";
  import { usePageSnapshots } from "$lib/stores/page-snapshots.svelte";
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
  import {
    computeContainedScrollHeight,
    shouldContainWheelScroll,
  } from "./entity-grid-viewport.svelte";

  const DEFAULT_PAGE_SIZE = 250;
  const DEFAULT_PAGE_SIZE_OPTIONS = [100, 250, 500, 1000];

  interface Props {
    bulkActions?: EntityGridBulkAction[];
    cards: EntityThumbnailCard[];
    emptyMessage?: string;
    emptyTitle?: string;
    hasMore?: boolean;
    initialPageSize?: number;
    initialSortBy?: EntityGridSort;
    initialSortDir?: EntityGridSortDir;
    loading?: boolean;
    loadingMore?: boolean;
    loadMoreError?: string | null;
    loadMoreLabel?: string;
    maxScale?: number;
    minScale?: number;
    nsfwMode?: "show" | "off" | "blur";
    onLoadMore?: () => void | Promise<void>;
    onPageSizeChange?: (pageSize: number) => void;
    onRequestChange?: (request: EntityGridRequest) => void;
    onRenderedCountChange?: (renderedCount: number) => void;
    onSelectionChange?: (selectedIds: string[]) => void;
    pageSizeOptions?: number[];
    prefsKey?: string;
    selectable?: boolean;
    scrollBottomPadding?: number;
    scrollMaxHeight?: string | null | undefined;
    scrollMinHeight?: number;
  }

  let {
    bulkActions = [],
    cards,
    emptyMessage = "Try adjusting your search or filters.",
    emptyTitle = "Nothing present",
    hasMore = false,
    initialPageSize = DEFAULT_PAGE_SIZE,
    initialSortBy = "title",
    initialSortDir = "asc",
    loading = false,
    loadingMore = false,
    loadMoreError = null,
    loadMoreLabel = "Load more",
    maxScale = 12,
    minScale = 2,
    nsfwMode = "show",
    onLoadMore,
    onPageSizeChange,
    onRequestChange,
    onRenderedCountChange,
    onSelectionChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    prefsKey,
    selectable = true,
    scrollBottomPadding = 24,
    scrollMaxHeight = undefined,
    scrollMinHeight = 320,
  }: Props = $props();

  function storageKey(): string | null {
    return prefsKey ? `obscura:entity-grid:${prefsKey}` : null;
  }

  function presetStorageKey(): string | null {
    return prefsKey ? `obscura:entity-grid-presets:${prefsKey}` : null;
  }

  function pageSizeStorageKey(): string | null {
    return prefsKey ? `obscura:entity-grid-page-size:${prefsKey}` : null;
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

  function normalizePageSize(value: number): number {
    const numeric = Math.floor(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULT_PAGE_SIZE;
  }

  function loadPageSize(): number {
    const fallback = normalizePageSize(initialPageSize);
    if (!browser) return fallback;
    const key = pageSizeStorageKey();
    if (!key) return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return normalizePageSize(Number(raw));
  }

  let activeKind = $state(ENTITY_GRID_ALL_KINDS);
  let activePresetId = $state<string | null>(null);
  let drawerOpen = $state(false);
  let filterIds = $state<string[]>([]);
  let includeNsfw = $state(true);
  let presets = $state<FilterPreset[]>([]);
  let query = $state("");
  let pageIndex = $state(0);
  let pageSize = $state(DEFAULT_PAGE_SIZE);
  let pendingAdvanceAfterLoad = $state(false);
  let scale = $state(5);
  let selectedIds = $state<string[]>([]);
  let viewportEl: HTMLDivElement | undefined = $state();
  let measuredScrollMaxHeight = $state<string | null>(null);
  // svelte-ignore state_referenced_locally
  let sortBy = $state<EntityGridSort>(initialSortBy);
  // svelte-ignore state_referenced_locally
  let sortDir = $state<EntityGridSortDir>(initialSortDir);
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
  const effectiveScrollMaxHeight = $derived(scrollMaxHeight === undefined ? measuredScrollMaxHeight : scrollMaxHeight);
  const containsScroll = $derived(scrollMaxHeight !== null);
  const normalizedPageSizeOptions = $derived(
    Array.from(new Set([...pageSizeOptions, pageSize].map(normalizePageSize))).sort((a, b) => a - b),
  );
  const pageCount = $derived(Math.max(1, Math.ceil(visibleCards.length / pageSize)));
  const currentPageIndex = $derived(Math.min(pageIndex, pageCount - 1));
  const pageStart = $derived(visibleCards.length === 0 ? 0 : currentPageIndex * pageSize);
  const pageEnd = $derived(Math.min(visibleCards.length, pageStart + pageSize));
  const pagedCards = $derived(visibleCards.slice(pageStart, pageEnd));
  const canPageBack = $derived(currentPageIndex > 0);
  const canPageForward = $derived(currentPageIndex < pageCount - 1 || Boolean(hasMore && onLoadMore));

  interface EntityGridSnapshot {
    query: string;
    activeKind: string;
    filterIds: string[];
    includeNsfw: boolean;
    sortBy: EntityGridSort;
    sortDir: EntityGridSortDir;
    viewMode: EntityGridViewMode;
    selectedIds: string[];
    scale: number;
    pageIndex: number;
    pageSize: number;
  }

  const pageSnapshots = usePageSnapshots();

  onMount(() => {
    scale = loadScale();
    pageSize = loadPageSize();
    onPageSizeChange?.(pageSize);
    const key = presetStorageKey();
    if (key) presets = createFilterPresets(key).load();

    if (!prefsKey) return;
    return pageSnapshots.registerSurface<EntityGridSnapshot>(`entity-grid:${prefsKey}`, {
      capture: () => ({
        query,
        activeKind,
        filterIds: [...filterIds],
        includeNsfw,
        sortBy,
        sortDir,
        viewMode,
        selectedIds: [...selectedIds],
        scale,
        pageIndex: currentPageIndex,
        pageSize,
      }),
      restore: (snapshot) => {
        query = snapshot.query;
        activeKind = snapshot.activeKind;
        filterIds = snapshot.filterIds;
        includeNsfw = snapshot.includeNsfw;
        sortBy = snapshot.sortBy;
        sortDir = snapshot.sortDir;
        viewMode = snapshot.viewMode;
        selectedIds = snapshot.selectedIds;
        scale = snapshot.scale;
        pageSize = normalizePageSize(snapshot.pageSize ?? pageSize);
        pageIndex = Math.max(0, snapshot.pageIndex ?? 0);
        onPageSizeChange?.(pageSize);
        onSelectionChange?.(selectedIds);
      },
    });
  });

  onMount(() => {
    let raf: number | null = null;
    let observer: ResizeObserver | null = null;

    function measureViewport() {
      if (!viewportEl || scrollMaxHeight !== undefined) {
        measuredScrollMaxHeight = null;
        return;
      }

      measuredScrollMaxHeight = computeContainedScrollHeight({
        bottomPadding: scrollBottomPadding,
        minHeight: scrollMinHeight,
        top: viewportEl.getBoundingClientRect().top,
        viewportHeight: window.innerHeight,
      });
    }

    function scheduleMeasure() {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        measureViewport();
      });
    }

    observer = new ResizeObserver(scheduleMeasure);
    if (viewportEl) observer.observe(viewportEl);
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    window.addEventListener("scroll", scheduleMeasure, { capture: true, passive: true });
    queueMicrotask(measureViewport);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, { capture: true });
      if (raf !== null) cancelAnimationFrame(raf);
    };
  });

  $effect(() => {
    onRequestChange?.(request);
  });

  $effect(() => {
    onRenderedCountChange?.(pagedCards.length);
  });

  function persistScale(next: number) {
    scale = Math.min(maxScale, Math.max(minScale, next));
    const key = storageKey();
    if (browser && key) window.localStorage.setItem(key, String(scale));
  }

  function setActiveKind(kind: string) {
    activeKind = kind;
    activePresetId = null;
    pageIndex = 0;
    selectedIds = [];
    onSelectionChange?.(selectedIds);
  }

  function setFilterIds(ids: string[]) {
    filterIds = ids;
    activePresetId = null;
    pageIndex = 0;
  }

  function setIncludeNsfw(value: boolean) {
    includeNsfw = value;
    activePresetId = null;
    pageIndex = 0;
  }

  function setQuery(value: string) {
    query = value;
    activePresetId = null;
    pageIndex = 0;
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
    sortBy = preset.sortBy === "kind" || preset.sortBy === "rating" || preset.sortBy === "position" ? preset.sortBy : initialSortBy;
    sortDir = preset.sortDir;
    activePresetId = preset.id;
    pageIndex = 0;
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
    sortBy = initialSortBy;
    sortDir = initialSortDir;
    viewMode = "grid";
    pageIndex = 0;
    onSelectionChange?.(selectedIds);
  }

  function updateSelection(id: string, selected: boolean) {
    selectedIds = selected
      ? Array.from(new Set([...selectedIds, id]))
      : selectedIds.filter((selectedId) => selectedId !== id);
    onSelectionChange?.(selectedIds);
  }

  function containWheel(event: WheelEvent) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    if (
      shouldContainWheelScroll({
        clientHeight: target.clientHeight,
        deltaY: event.deltaY,
        scrollHeight: target.scrollHeight,
        scrollTop: target.scrollTop,
      })
    ) {
      event.preventDefault();
    }
  }

  function scrollPageToTop() {
    viewportEl?.scrollTo({ top: 0 });
  }

  function setPageIndex(next: number) {
    pageIndex = Math.max(0, Math.min(pageCount - 1, next));
    queueMicrotask(scrollPageToTop);
  }

  function setPageSize(value: number) {
    pageSize = normalizePageSize(value);
    pageIndex = 0;
    const key = pageSizeStorageKey();
    if (browser && key) window.localStorage.setItem(key, String(pageSize));
    onPageSizeChange?.(pageSize);
    queueMicrotask(scrollPageToTop);
  }

  async function goToNextPage() {
    if (currentPageIndex < pageCount - 1) {
      setPageIndex(currentPageIndex + 1);
      return;
    }

    if (!hasMore || !onLoadMore || loadingMore) return;
    const targetPage = currentPageIndex + 1;
    const targetStart = targetPage * pageSize;
    pendingAdvanceAfterLoad = true;
    try {
      while (visibleCards.length <= targetStart && hasMore) {
        const previousCount = visibleCards.length;
        await onLoadMore();
        if (visibleCards.length <= previousCount) break;
      }
      setPageIndex(targetPage);
    } finally {
      pendingAdvanceAfterLoad = false;
    }
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
        sortBy !== initialSortBy ||
        sortDir !== initialSortDir ||
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

  <div
    bind:this={viewportEl}
    class={["grid-viewport", containsScroll && "is-contained"]}
    style:--entity-grid-scroll-max-height={effectiveScrollMaxHeight ?? undefined}
    onwheel={containWheel}
  >
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
        {#each pagedCards as card (card.entity.id)}
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

    {#if !loading && visibleCards.length > 0}
      <nav class="pagination-bar" aria-label="Entity grid pagination">
        <span
          class="pagination-progress"
          aria-hidden="true"
          style:--progress="{Math.max(0, Math.min(1, pageCount > 1 ? (currentPageIndex + 1) / pageCount : 1)) * 100}%"
        ></span>

        <div class="page-readout" aria-live="polite">
          <span class="readout-label">SHOWING</span>
          <span class="readout-range">
            <strong>{pageStart + 1}–{pageEnd}</strong>
            <span class="readout-divider">/</span>
            <span class="readout-total">{visibleCards.length}{hasMore ? "+" : ""}</span>
          </span>
        </div>

        <div class="transport">
          <button
            type="button"
            class="transport-btn"
            title="First page"
            aria-label="First page"
            disabled={!canPageBack}
            onclick={() => setPageIndex(0)}
          >
            <ChevronsLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            class="transport-btn"
            title="Previous page"
            aria-label="Previous page"
            disabled={!canPageBack}
            onclick={() => setPageIndex(currentPageIndex - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span class="page-count" aria-hidden="true">
            <span class="page-count-current">{String(currentPageIndex + 1).padStart(String(pageCount).length, "0")}</span>
            <span class="page-count-sep">/</span>
            <span class="page-count-total">{pageCount}</span>
          </span>
          <span class="sr-only">Page {currentPageIndex + 1} / {pageCount}</span>
          <button
            type="button"
            class="transport-btn"
            title="Next page"
            aria-label="Next page"
            disabled={!canPageForward || Boolean(loadMoreError) || loadingMore || pendingAdvanceAfterLoad}
            onclick={() => void goToNextPage()}
          >
            {#if loadingMore || pendingAdvanceAfterLoad}
              <LoaderCircle class="is-spinning" aria-hidden="true" />
            {:else}
              <ChevronRight aria-hidden="true" />
            {/if}
          </button>
          <button
            type="button"
            class="transport-btn"
            title="Last loaded page"
            aria-label="Last loaded page"
            disabled={currentPageIndex >= pageCount - 1}
            onclick={() => setPageIndex(pageCount - 1)}
          >
            <ChevronsRight aria-hidden="true" />
          </button>
        </div>

        <label class="page-size-control">
          <span class="page-size-label">PER PAGE</span>
          <span class="page-size-field">
            <select
              aria-label="Per page"
              value={pageSize}
              onchange={(event) => setPageSize(Number((event.currentTarget as HTMLSelectElement).value))}
            >
              {#each normalizedPageSizeOptions as option (option)}
                <option value={option}>{option}</option>
              {/each}
            </select>
            <ChevronDown class="page-size-caret" aria-hidden="true" />
          </span>
        </label>

        {#if loadMoreError}
          <button
            type="button"
            class="retry-load"
            onclick={() => {
              if (onLoadMore) void onLoadMore();
            }}
          >
            Try again
          </button>
        {:else if hasMore && currentPageIndex >= pageCount - 1}
          <span class="more-hint" title={loadMoreLabel}>BUFFER ›</span>
        {/if}
      </nav>
    {/if}
  </div>
</section>

<style>
  .entity-grid {
    display: grid;
    gap: 0.85rem;
    min-height: 0;
    min-width: 0;
  }

  .grid-viewport {
    display: grid;
    gap: 0.85rem;
    min-height: 0;
  }

  .grid-viewport.is-contained {
    max-height: var(--entity-grid-scroll-max-height, calc(100dvh - 2rem));
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.35rem;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
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

  .pagination-bar {
    position: sticky;
    bottom: 0;
    z-index: 5;
    display: grid;
    grid-template-columns: minmax(0, auto) 1fr minmax(0, auto);
    align-items: center;
    gap: 0.85rem;
    border: 1px solid var(--color-border-default);
    border-top-color: rgb(196 154 90 / 0.22);
    background:
      linear-gradient(180deg, rgb(20 23 30 / 0.55), rgb(11 12 16 / 0.85)),
      color-mix(in srgb, var(--color-surface-2) 92%, transparent);
    box-shadow:
      0 -10px 28px rgb(0 0 0 / 0.45),
      inset 0 1px 0 rgb(255 255 255 / 0.04),
      inset 0 -1px 0 rgb(0 0 0 / 0.4);
    backdrop-filter: blur(14px) saturate(1.15);
    -webkit-backdrop-filter: blur(14px) saturate(1.15);
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    padding: 0.7rem 0.85rem;
    overflow: hidden;
  }

  .pagination-progress {
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    background:
      linear-gradient(
        to right,
        rgb(196 154 90 / 0.85) 0%,
        rgb(221 180 119 / 0.95) calc(var(--progress, 0%) - 0.5%),
        rgb(196 154 90 / 0.15) var(--progress, 0%),
        rgb(196 154 90 / 0.05) 100%
      );
    box-shadow: 0 0 12px rgb(196 154 90 / 0.35);
    pointer-events: none;
    transition: background var(--duration-normal) var(--ease-default);
  }

  .page-readout {
    display: inline-flex;
    align-items: baseline;
    gap: 0.55rem;
    min-width: 0;
    color: var(--color-text-muted);
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .readout-label {
    color: var(--color-text-disabled);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.18em;
  }

  .readout-range {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
    font-variant-numeric: tabular-nums;
  }

  .readout-range strong {
    color: var(--color-text-primary);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-shadow: 0 0 14px rgb(255 255 255 / 0.06);
  }

  .readout-divider {
    color: var(--color-text-disabled);
  }

  .readout-total {
    color: var(--color-text-muted);
  }

  .transport {
    display: inline-flex;
    justify-self: center;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.3rem;
    border: 1px solid rgb(0 0 0 / 0.45);
    background:
      linear-gradient(180deg, rgb(0 0 0 / 0.45), rgb(0 0 0 / 0.15));
    box-shadow:
      inset 0 1px 3px rgb(0 0 0 / 0.55),
      inset 0 -1px 0 rgb(255 255 255 / 0.02);
  }

  .transport-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 1.85rem;
    border: 1px solid rgb(255 255 255 / 0.05);
    background:
      linear-gradient(180deg, rgb(34 38 48 / 0.95), rgb(18 21 28 / 0.95));
    color: var(--color-text-muted);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.05),
      0 1px 2px rgb(0 0 0 / 0.35);
    transition:
      color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default),
      box-shadow var(--duration-fast) var(--ease-default),
      transform var(--duration-fast) var(--ease-mechanical),
      background var(--duration-fast) var(--ease-default);
  }

  .transport-btn:hover:not(:disabled) {
    border-color: rgb(196 154 90 / 0.4);
    color: var(--color-text-accent-bright);
    background:
      linear-gradient(180deg, rgb(44 36 22 / 0.95), rgb(28 22 12 / 0.95));
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.08),
      0 0 12px rgb(196 154 90 / 0.18);
  }

  .transport-btn:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 5px rgb(0 0 0 / 0.6),
      0 0 8px rgb(196 154 90 / 0.15);
  }

  .transport-btn:focus-visible {
    outline: none;
    border-color: rgb(196 154 90 / 0.7);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.08),
      0 0 0 2px rgb(196 154 90 / 0.25);
  }

  .transport-btn:disabled {
    cursor: not-allowed;
    color: var(--color-text-disabled);
    opacity: 0.38;
  }

  .transport :global(svg) {
    width: 0.95rem;
    height: 0.95rem;
  }

  .transport :global(.is-spinning) {
    animation: spin 0.85s linear infinite;
    color: var(--color-text-accent-bright);
  }

  .page-count {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    padding: 0 0.55rem;
    color: var(--color-text-disabled);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .page-count-current {
    color: var(--color-text-accent-bright);
    font-size: 0.84rem;
    font-weight: 600;
    text-shadow: 0 0 14px rgb(196 154 90 / 0.5);
  }

  .page-count-sep {
    color: var(--color-text-disabled);
  }

  .page-count-total {
    color: var(--color-text-muted);
  }

  .page-size-control {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    justify-self: end;
    color: var(--color-text-disabled);
    white-space: nowrap;
  }

  .page-size-label {
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.18em;
  }

  .page-size-field {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .page-size-field select {
    height: 1.85rem;
    border: 1px solid rgb(255 255 255 / 0.06);
    background:
      linear-gradient(180deg, rgb(34 38 48 / 0.95), rgb(18 21 28 / 0.95));
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.04),
      0 1px 2px rgb(0 0 0 / 0.3);
    color: var(--color-text-primary);
    font: inherit;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    padding: 0 1.7rem 0 0.65rem;
    appearance: none;
    -webkit-appearance: none;
    transition:
      border-color var(--duration-fast) var(--ease-default),
      box-shadow var(--duration-fast) var(--ease-default);
  }

  .page-size-field select:hover,
  .page-size-field select:focus-visible {
    outline: none;
    border-color: rgb(196 154 90 / 0.45);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.06),
      0 0 0 2px rgb(196 154 90 / 0.15);
  }

  .page-size-field :global(.page-size-caret) {
    position: absolute;
    right: 0.5rem;
    width: 0.8rem;
    height: 0.8rem;
    color: var(--color-text-disabled);
    pointer-events: none;
  }

  .more-hint {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-text-accent);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.18em;
  }

  .retry-load {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.85rem;
    border: 1px solid rgb(204 120 128 / 0.4);
    background: rgb(40 18 22 / 0.65);
    color: var(--color-error-text);
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    padding: 0 0.85rem;
    transition: background var(--duration-fast) var(--ease-default);
  }

  .retry-load:hover {
    background: rgb(54 22 28 / 0.85);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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

  @media (max-width: 720px) {
    .pagination-bar {
      grid-template-columns: 1fr auto;
      grid-template-areas:
        "readout  size"
        "transport transport";
      row-gap: 0.6rem;
      padding: 0.65rem 0.7rem 0.7rem;
    }

    .page-readout {
      grid-area: readout;
      font-size: 0.62rem;
    }

    .readout-range strong {
      font-size: 0.72rem;
    }

    .page-size-control {
      grid-area: size;
    }

    .transport {
      grid-area: transport;
      justify-self: stretch;
      justify-content: space-between;
      padding: 0.25rem 0.35rem;
    }

    .transport-btn {
      flex: 0 0 auto;
    }

    .page-count {
      flex: 1 1 auto;
      justify-content: center;
      padding: 0 0.25rem;
    }
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
