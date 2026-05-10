<script lang="ts" generics="T extends { id: string }, F extends string">
  import { onMount, untrack } from "svelte";
  import type {
    MediaSurfaceConfig,
    SurfacePrefs,
    SortDir,
    BodyLayout,
  } from "./config";
  import { createPaginatedCollection } from "./pagination/paginated-collection.svelte";
  import InfiniteLoadTrigger from "./pagination/InfiniteLoadTrigger.svelte";
  import Toolbar from "./toolbar/Toolbar.svelte";
  import {
    createSurfacePrefs,
    type SurfacePrefsFormFactor,
    surfacePresetsKey,
  } from "./prefs/surface-prefs.svelte";
  import { encodeSurfacePrefs } from "./prefs/prefs-codec";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";
  import { prefersReducedMotion } from "$lib/hooks/prefers-reduced-motion.svelte";
  import ThumbnailGrid from "./body/ThumbnailGrid.svelte";
  import ListBody from "./body/ListBody.svelte";
  import FeedBody from "./body/FeedBody.svelte";
  import MasonryBody from "./body/MasonryBody.svelte";
  import EmptyState from "./body/EmptyState.svelte";
  import BulkActionBar from "$lib/components/BulkActionBar.svelte";

  interface Props {
    config: MediaSurfaceConfig<T, F>;
    /**
     * Optional base query params merged into every fetch (e.g. NSFW
     * mode, season number). Pages that need to forward route-scoped
     * filter context use this; nothing in here is persisted.
     */
    baseFetchParams?: Record<string, unknown>;
    /** Legacy prefs key to read once and migrate from. */
    legacyPrefsKey?: string;
    /** Mobile/desktop prefs loaded by SvelteKit before this component mounts. */
    initialPrefsByFormFactor?: Partial<
      Record<SurfacePrefsFormFactor, Partial<SurfacePrefs<F>> | null>
    >;
    /** Display formatter for filter chips (e.g. resolve studio id → name). */
    formatFilterValue?: (filter: { type: F; value: string; label: string }) => string;
    /** Called whenever the selection set changes. */
    onSelectionChange?: (ids: ReadonlySet<string>) => void;
  }

  let {
    config,
    baseFetchParams,
    legacyPrefsKey,
    initialPrefsByFormFactor,
    formatFilterValue,
    onSelectionChange,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  const prefsStore = createSurfacePrefs<F>({
    config,
    initial: null,
    initialByFormFactor: initialPrefsByFormFactor,
    legacyKey: legacyPrefsKey,
  });
  // svelte-ignore state_referenced_locally
  const presetsApi = createServerPresets(surfacePresetsKey(config.surfaceId));

  const reducedMotion = prefersReducedMotion();
  let randomSortSeed = $state(createRandomSortSeed());

  function createRandomSortSeed(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function prefsForFetch(): SurfacePrefs<F> {
    const prefs = prefsStore.current;
    if (prefs.sortBy !== "randomized") return prefs;
    return {
      ...prefs,
      extras: {
        ...(prefs.extras ?? {}),
        randomSeed: randomSortSeed,
      },
    };
  }

  // svelte-ignore state_referenced_locally
  const coll = createPaginatedCollection<T>({
    pageSize: config.pageSize,
    initial: config.initial,
    getKey: config.getKey,
    fetcher: ({ offset, limit, signal }) =>
      config.fetcher({ offset, limit, signal, prefs: prefsForFetch() }),
  });

  // Re-hydrate when config.initial changes (e.g. SvelteKit load re-runs
  // after filter prefs change and the server returns a fresh first page).
  $effect(() => {
    const initial = config.initial;
    if (initial) {
      untrack(() => {
        coll.hydrate(initial);
        if (lastPrefsSignature !== "" && shouldRefetchAfterHydrate()) {
          coll.reset();
          void coll.loadMore();
        }
      });
    }
  });

  // Refetch whenever filter-bearing prefs change *after* the initial
  // hydration. We compare against a signature so we only fire when the
  // actual values shift, not on every store mutation.
  let lastPrefsSignature = $state<string>("");
  $effect(() => {
    const prefs = prefsStore.current;
    const sig = JSON.stringify({
      sort: prefs.sortBy,
      dir: prefs.sortDir,
      randomSeed: prefs.sortBy === "randomized" ? randomSortSeed : undefined,
      search: prefs.search,
      filters: prefs.activeFilters,
      view: prefs.viewMode,
    });
    if (sig === lastPrefsSignature) return;
    if (lastPrefsSignature === "") {
      lastPrefsSignature = sig;
      if (
        config.initial &&
        (prefs.sortBy === "randomized" || shouldVerifyHydratedFilteredPage())
      ) {
        untrack(() => {
          coll.reset();
          void coll.loadMore();
        });
      }
      return;
    }
    lastPrefsSignature = sig;
    coll.reset();
    void coll.loadMore();
  });

  onMount(() => {
    let disposed = false;
    void (async () => {
      await prefsStore.load();
      if (disposed || (config.initial && config.initial.items.length > 0)) return;
      void coll.loadMore();
    })();
    void presetsApi.load();
    return () => {
      disposed = true;
      coll.dispose();
    };
  });

  // ── Toolbar callbacks ────────────────────────────────────────────────
  function onSortChange(sort: string, dir?: SortDir) {
    if (sort === "randomized") {
      randomSortSeed = createRandomSortSeed();
    }
    prefsStore.update({
      sortBy: sort,
      sortDir: dir ?? prefsStore.current.sortDir,
      activePresetId: undefined,
    } as Partial<SurfacePrefs<F>>);
  }

  function onViewModeChange(mode: string) {
    prefsStore.update({ viewMode: mode } as Partial<SurfacePrefs<F>>);
  }

  function onSearchChange(next: string) {
    prefsStore.update({ search: next, activePresetId: undefined } as Partial<SurfacePrefs<F>>);
  }

  function onColsChange(cols: number) {
    prefsStore.update({ cols } as Partial<SurfacePrefs<F>>);
  }

  const exclusiveTypes = $derived(config.exclusiveFilterTypes ?? new Set<F>());

  function onAddFilter(type: F, label: string, value: string) {
    const current = prefsStore.current.activeFilters;
    let next: typeof current;
    if (exclusiveTypes.has(type)) {
      next = [...current.filter((f) => f.type !== type), { type, label, value }];
    } else {
      const idx = current.findIndex((f) => f.type === type && f.value === value);
      if (idx >= 0) {
        next = current.filter((_, i) => i !== idx);
      } else {
        next = [...current, { type, label, value }];
      }
    }
    prefsStore.update({
      activeFilters: next,
      activePresetId: undefined,
    } as Partial<SurfacePrefs<F>>);
  }

  function onRemoveFilter(index: number) {
    const next = prefsStore.current.activeFilters.filter((_, i) => i !== index);
    prefsStore.update({
      activeFilters: next,
      activePresetId: undefined,
    } as Partial<SurfacePrefs<F>>);
  }

  function isDefaultPrefs(p: SurfacePrefs<F>): boolean {
    const d = defaultPrefs();
    return (
      p.viewMode === d.viewMode &&
      p.sortBy === d.sortBy &&
      p.sortDir === d.sortDir &&
      p.search === d.search &&
      p.activeFilters.length === 0
    );
  }
  const canClear = $derived(!isDefaultPrefs(prefsStore.current));

  function onClearFiltersAndSort() {
    prefsStore.set(defaultPrefs());
  }

  function defaultPrefs(): SurfacePrefs<F> {
    return {
      ...config.defaultPrefs,
      cols: config.thumbSize?.min ?? config.defaultPrefs.cols,
    };
  }

  function shouldRefetchAfterHydrate(): boolean {
    const prefs = prefsStore.current;
    const d = defaultPrefs();
    return (
      prefs.sortBy !== d.sortBy ||
      prefs.sortDir !== d.sortDir ||
      prefs.search !== d.search ||
      prefs.activeFilters.length > 0
    );
  }

  function shouldVerifyHydratedFilteredPage(): boolean {
    const prefs = prefsStore.current;
    const d = defaultPrefs();
    return prefs.search !== d.search || prefs.activeFilters.length > 0;
  }

  // ── Presets ──────────────────────────────────────────────────────────
  function onApplyPreset(preset: FilterPreset) {
    prefsStore.set({
      ...defaultPrefs(),
      sortBy: preset.sortBy ?? defaultPrefs().sortBy,
      sortDir: (preset.sortDir as SortDir | undefined) ?? defaultPrefs().sortDir,
      activeFilters: (preset.filters ?? []) as SurfacePrefs<F>["activeFilters"],
      activePresetId: preset.id,
      viewMode: prefsStore.current.viewMode,
      cols: prefsStore.current.cols,
    });
  }

  function onSavePreset(name: string) {
    const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const p = prefsStore.current;
    const preset: FilterPreset = {
      id,
      name,
      sortBy: p.sortBy,
      sortDir: p.sortDir,
      filters: p.activeFilters as FilterPreset["filters"],
    };
    presetsApi.save([...presetsApi.presets, preset]);
    prefsStore.update({ activePresetId: id } as Partial<SurfacePrefs<F>>);
  }

  function onOverwritePreset(id: string) {
    const p = prefsStore.current;
    presetsApi.save(
      presetsApi.presets.map((existing) =>
        existing.id === id
          ? {
              ...existing,
              sortBy: p.sortBy,
              sortDir: p.sortDir,
              filters: p.activeFilters as FilterPreset["filters"],
            }
          : existing,
      ),
    );
  }

  function onDeletePreset(id: string) {
    presetsApi.save(presetsApi.presets.filter((existing) => existing.id !== id));
    if (prefsStore.current.activePresetId === id) {
      prefsStore.update({ activePresetId: undefined } as Partial<SurfacePrefs<F>>);
    }
  }

  // ── Bulk selection ───────────────────────────────────────────────────
  let selectedIds = $state.raw<Set<string>>(new Set());
  let bulkBusy = $state(false);
  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
    onSelectionChange?.(next);
  }
  function clearSelection() {
    selectedIds = new Set();
    onSelectionChange?.(selectedIds);
  }
  function toggleSelectAllVisible() {
    const visibleIds = coll.items.map((item) => (config.getKey ?? ((x: T) => x.id))(item));
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    selectedIds = allSelected ? new Set() : new Set(visibleIds);
    onSelectionChange?.(selectedIds);
  }
  async function runBulkAction(actionId: string) {
    if (bulkBusy) return;
    const action = config.bulkActions?.find((a) => a.id === actionId);
    if (!action) return;
    const ids = selectedIds;
    const items = coll.items.filter((item) =>
      ids.has((config.getKey ?? ((x: T) => x.id))(item)),
    );
    if (items.length === 0) return;
    bulkBusy = true;
    try {
      await action.handler(items);
      // Page is responsible for refreshing data; we just clear selection.
      clearSelection();
    } finally {
      bulkBusy = false;
    }
  }
  const visibleIdSet = $derived(
    new Set(coll.items.map((item) => (config.getKey ?? ((x: T) => x.id))(item))),
  );
  const allVisibleSelected = $derived(
    visibleIdSet.size > 0 && [...visibleIdSet].every((id) => selectedIds.has(id)),
  );
  const markNsfwAction = $derived(
    config.bulkActions?.find((a) => a.id === "mark-nsfw"),
  );
  const deleteAction = $derived(
    config.bulkActions?.find((a) => a.id === "delete"),
  );
  const extraBulkActions = $derived(
    config.bulkActions?.filter((a) => a.id !== "mark-nsfw" && a.id !== "delete") ?? [],
  );

  // ── Layout ───────────────────────────────────────────────────────────
  const currentLayout = $derived<BodyLayout>(
    config.layoutByViewMode?.[prefsStore.current.viewMode] ?? config.bodyLayout ?? "grid",
  );
  const cols = $derived(prefsStore.current.cols ?? config.thumbSize?.default ?? 5);
  const renderedItems = $derived.by(() =>
    config.decorateItem ? coll.items.map((item) => config.decorateItem?.(item) ?? item) : coll.items,
  );

  $effect(() => {
    config.onItemsChange?.(coll.items);
  });

  // Surface a "load more page href" for the no-JS fallback link inside
  // InfiniteLoadTrigger. We don't have a real page-based URL here, so
  // synthesize one against the current location as a graceful hint.
  const nextHref = $derived(
    typeof window === "undefined"
      ? "#"
      : `${window.location.pathname}?page=${
          Math.floor(coll.loadKey / config.pageSize) + 1
        }`,
  );

  // Expose encoded fetch params for callers that want to inspect them
  // (most pages won't need this).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _fetchParams = $derived(
    encodeSurfacePrefs(prefsStore.current, {
      filterSections: config.filterSections,
      base: baseFetchParams,
    }),
  );
</script>

<div class="space-y-3">
  <Toolbar
    prefs={prefsStore.current}
    sortOptions={config.sortOptions}
    defaultSortDir={config.defaultSortDir}
    viewModes={config.viewModes}
    filterSections={config.filterSections}
    availableFilterItems={config.availableFilterItems}
    searchPlaceholder={config.searchPlaceholder}
    thumbSize={config.thumbSize}
    presets={presetsApi.presets}
    formatFilterValue={formatFilterValue}
    canClearFiltersAndSort={canClear}
    {onSortChange}
    {onViewModeChange}
    {onSearchChange}
    {onAddFilter}
    {onRemoveFilter}
    {onColsChange}
    {onApplyPreset}
    {onSavePreset}
    {onOverwritePreset}
    {onDeletePreset}
    {onClearFiltersAndSort}
    extras={config.toolbarExtras}
    extraDrawerSections={config.extraFilterSections}
  />

  {#if config.bulkActions && config.bulkActions.length > 0}
    <BulkActionBar
      selectedCount={selectedIds.size}
      visibleCount={visibleIdSet.size}
      allSelected={allVisibleSelected}
      itemLabel={config.bulkItemLabel ?? "items"}
      busy={bulkBusy}
      canMarkNsfw={Boolean(markNsfwAction)}
      canDelete={Boolean(deleteAction)}
      actions={extraBulkActions.map((action) => ({
        id: action.id,
        label: action.label,
        variant: action.variant,
        onRun: () => runBulkAction(action.id),
      }))}
      onSelectAll={toggleSelectAllVisible}
      onClear={clearSelection}
      onMarkNsfw={markNsfwAction ? () => runBulkAction(markNsfwAction.id) : undefined}
      onDelete={deleteAction ? () => runBulkAction(deleteAction.id) : undefined}
    />
  {/if}

  {#if coll.items.length === 0 && !coll.loading}
    {#if config.emptyState}
      {@render config.emptyState({ prefs: prefsStore.current })}
    {:else}
      <EmptyState title="Nothing to show" description="Try adjusting your filters or search." />
    {/if}
  {:else if currentLayout === "list"}
    <ListBody
      items={renderedItems}
      card={config.card}
      getKey={config.getKey}
      selectedIds={config.bulkActions ? selectedIds : undefined}
      onToggleSelect={config.bulkActions ? toggleSelect : undefined}
      reducedMotion={reducedMotion.value}
      onActivate={config.onItemActivate}
    />
  {:else if currentLayout === "feed"}
    <FeedBody
      items={renderedItems}
      {cols}
      card={config.card}
      getKey={config.getKey}
      reducedMotion={reducedMotion.value}
      onActivate={config.onItemActivate}
    />
  {:else if currentLayout === "masonry"}
    <MasonryBody
      items={renderedItems}
      cols={cols}
      card={config.card}
      getKey={config.getKey}
      selectedIds={config.bulkActions ? selectedIds : undefined}
      onToggleSelect={config.bulkActions ? toggleSelect : undefined}
      reducedMotion={reducedMotion.value}
      onActivate={config.onItemActivate}
    />
  {:else}
    <ThumbnailGrid
      items={renderedItems}
      cols={cols}
      card={config.card}
      getKey={config.getKey}
      selectedIds={config.bulkActions ? selectedIds : undefined}
      onToggleSelect={config.bulkActions ? toggleSelect : undefined}
      reducedMotion={reducedMotion.value}
      onActivate={config.onItemActivate}
    />
  {/if}

  <InfiniteLoadTrigger
    hasMore={coll.hasMore}
    loading={coll.loading}
    error={coll.error}
    nextHref={nextHref}
    loadKey={coll.loadKey}
    label="Load more"
    onLoad={() => coll.loadMore()}
  />
</div>
