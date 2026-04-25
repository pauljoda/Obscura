<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { FolderOpen, Plus } from "@lucide/svelte";
  import { Badge, Button, Checkbox, dur, ease } from "@obscura/ui-svelte";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import type { PageData } from "./$types";
  import BulkActionBar from "$lib/components/BulkActionBar.svelte";
  import FilterBar, { type SortDir, type ViewMode } from "$lib/components/FilterBar.svelte";
  import CollectionThumbnail from "$lib/components/thumbnails/CollectionThumbnail.svelte";
  import InfiniteLoadTrigger from "$lib/components/InfiniteLoadTrigger.svelte";
  import { deleteCollection, fetchCollections as fetchMoreCollections } from "$lib/api/media";
  import { mergeUniquePage } from "$lib/pagination/load-more";
  import { createServerPrefs } from "$lib/server-prefs.svelte";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";

  let { data }: { data: PageData } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently Added" },
    { value: "name", label: "Name A–Z" },
    { value: "itemCount", label: "Item Count" },
  ];

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/collections?${qs}` : "/collections", { keepFocus: true, noScroll: true });
  }

  function onClearFiltersAndSort() {
    void goto("/collections", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    !!data.search || data.sort !== "recent" || data.order !== "desc",
  );

  const presetsApi = createServerPresets("collections:filterPresets");
  // svelte-ignore state_referenced_locally
  const viewPrefs = createServerPrefs<{ cols: number; viewMode: "grid" | "list" }>(
    "collections:view",
    { cols: 5, viewMode: "grid" },
    data.viewPrefs,
  );
  const viewMode = $derived(viewPrefs.current.viewMode);

  onMount(() => {
    void presetsApi.load();
    void viewPrefs.load();
  });

  function samePresetFilters(preset: FilterPreset): boolean {
    return preset.sortBy === data.sort && preset.sortDir === data.order && preset.filters.length === 0;
  }

  const activePresetId = $derived.by(() => {
    const match = presetsApi.presets.find((preset) => samePresetFilters(preset));
    return match?.id ?? null;
  });

  function applyPreset(preset: FilterPreset) {
    const params = new URLSearchParams();
    if (preset.sortBy && preset.sortBy !== "recent") params.set("sort", preset.sortBy);
    if (preset.sortDir && preset.sortDir !== "desc") params.set("order", preset.sortDir);
    const qs = params.toString();
    void goto(qs ? `/collections?${qs}` : "/collections", { keepFocus: true, noScroll: true });
  }

  function currentPreset(name: string): FilterPreset {
    return {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      filters: [],
      sortBy: data.sort,
      sortDir: data.order,
    };
  }

  function savePreset(name: string) {
    presetsApi.save([...presetsApi.presets, currentPreset(name)]);
  }

  function overwritePreset(id: string) {
    presetsApi.save(
      presetsApi.presets.map((preset) =>
        preset.id === id ? { ...currentPreset(preset.name), id } : preset,
      ),
    );
  }

  function deletePreset(id: string) {
    presetsApi.save(presetsApi.presets.filter((preset) => preset.id !== id));
  }

  // svelte-ignore state_referenced_locally
  let loadedCollections = $state.raw(data.collections);
  // svelte-ignore state_referenced_locally
  let loadedTotal = $state(data.total);
  let loadingMore = $state(false);
  let loadMoreError = $state<string | null>(null);
  let bulkBusy = $state(false);
  let selectedCollectionIds = $state.raw(new Set<string>());
  let dataSignature = $state("");
  const visibleCollectionIds = $derived(loadedCollections.map((collection) => collection.id));
  const allVisibleSelected = $derived(
    visibleCollectionIds.length > 0 &&
      visibleCollectionIds.every((id) => selectedCollectionIds.has(id)),
  );
  const loadedStart = $derived((data.page - 1) * data.pageSize);
  const loadedEnd = $derived(Math.min(loadedTotal, loadedStart + loadedCollections.length));
  const hasMoreCollections = $derived(loadedEnd < loadedTotal);
  const nextPageNumber = $derived(
    Math.floor((loadedStart + loadedCollections.length) / data.pageSize) + 1,
  );

  $effect(() => {
    const nextSignature = `${data.page}:${data.total}:${data.collections.map((c) => c.id).join("|")}`;
    if (nextSignature === dataSignature) return;
    dataSignature = nextSignature;
    loadedCollections = data.collections;
    loadedTotal = data.total;
    loadingMore = false;
    loadMoreError = null;
    selectedCollectionIds = new Set(
      [...selectedCollectionIds].filter((id) =>
        data.collections.some((collection) => collection.id === id),
      ),
    );
  });

  function toggleSelectedCollection(id: string) {
    const next = new Set(selectedCollectionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedCollectionIds = next;
  }

  function selectAllVisibleCollections() {
    selectedCollectionIds = allVisibleSelected ? new Set() : new Set(visibleCollectionIds);
  }

  function clearSelectedCollections() {
    selectedCollectionIds = new Set();
  }

  async function deleteSelectedCollections() {
    const ids = [...selectedCollectionIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => deleteCollection(id)));
      clearSelectedCollections();
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/collections?${qs}` : "/collections";
  }

  async function loadMoreCollections() {
    if (loadingMore || !hasMoreCollections) return;
    loadingMore = true;
    loadMoreError = null;
    const offset = loadedStart + loadedCollections.length;

    try {
      const response = await fetchMoreCollections({
        search: data.search || undefined,
        sort: data.sort,
        order: data.order,
        mode: page.url.searchParams.get("mode") ?? undefined,
        limit: data.pageSize,
        offset,
      });
      const merged = mergeUniquePage({
        current: loadedCollections,
        incoming: response.items,
        loadedStart,
        total: response.total,
      });
      loadedCollections = merged.items;
      loadedTotal = merged.total;
    } catch {
      loadMoreError = "Could not load more collections.";
    } finally {
      loadingMore = false;
    }
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <FolderOpen class="h-5 w-5 text-text-accent" />
        Collections
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Curated groupings across your media</p>
    </div>
    <a href="/collections/new">
      <Button variant="primary" size="md">
        {#snippet children()}
          <Plus class="h-4 w-4" />
          New Collection
        {/snippet}
      </Button>
    </a>
  </div>

  <FilterBar
    {sortOptions}
    {viewMode}
    onViewModeChange={(v: ViewMode) =>
      viewPrefs.update({ viewMode: v === "list" ? "list" : "grid" })}
    sortBy={data.sort}
    sortDir={data.order}
    onSortChange={(s: string, d?: SortDir) => updateUrl({ sort: s, order: d ?? data.order })}
    searchQuery={data.search}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    searchPlaceholder="Search collections..."
    {onClearFiltersAndSort}
    {canClearFiltersAndSort}
    presets={presetsApi.presets}
    {activePresetId}
    onApplyPreset={applyPreset}
    onSavePreset={savePreset}
    onOverwritePreset={overwritePreset}
    onDeletePreset={deletePreset}
    thumbSize={viewMode === "grid"
      ? {
          value: viewPrefs.current.cols,
          min: 2,
          max: 8,
          onChange: (n) => viewPrefs.update({ cols: n }),
          label: "Collection card size",
        }
      : undefined}
  />

  {#if viewMode === "list"}
    <BulkActionBar
      selectedCount={selectedCollectionIds.size}
      visibleCount={visibleCollectionIds.length}
      allSelected={allVisibleSelected}
      itemLabel="collections"
      busy={bulkBusy}
      canMarkNsfw={false}
      onSelectAll={selectAllVisibleCollections}
      onClear={clearSelectedCollections}
      onDelete={deleteSelectedCollections}
    />
  {/if}

  {#if loadedCollections.length === 0}
    <div class="surface-panel p-8 text-center">
      <FolderOpen class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No collections yet.</p>
    </div>
  {:else if viewMode === "list"}
    <div class="surface-panel divide-y divide-border-subtle overflow-hidden">
      {#each loadedCollections as c, i (c.id)}
        <div
          class="flex items-center gap-3 px-3 py-2"
          animate:flip={{ duration: dur.moderate, easing: ease.mechanical }}
          in:fade|global={{ duration: dur.normal, delay: Math.min(i * 12, 150), easing: ease.enter }}
        >
          <Checkbox
            checked={selectedCollectionIds.has(c.id)}
            onchange={() => toggleSelectedCollection(c.id)}
          />
          <a href={`/collections/${c.id}`} class="w-16 shrink-0">
            <CollectionThumbnail collection={c} gradientIndex={i} size="list" />
          </a>
          <a
            href={`/collections/${c.id}`}
            class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
          >
            {c.name}
          </a>
          <span class="text-[0.68rem] text-text-muted">
            {c.itemCount} item{c.itemCount === 1 ? "" : "s"}
          </span>
          <Badge>{c.mode}</Badge>
        </div>
      {/each}
    </div>
  {:else}
    <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
      {#each loadedCollections as c, i (c.id)}
        <a
          href={`/collections/${c.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
          animate:flip={{ duration: dur.moderate, easing: ease.mechanical }}
          in:fade|global={{ duration: dur.normal, delay: Math.min(i * 12, 150), easing: ease.enter }}
        >
          <CollectionThumbnail collection={c} gradientIndex={i} />
          <div class="p-2.5 space-y-1">
            <h4 class="truncate text-body font-medium text-text-primary">{c.name}</h4>
            <div class="flex items-center gap-1.5 text-[0.65rem] text-text-muted">
              <span>{c.itemCount} item{c.itemCount === 1 ? "" : "s"}</span>
              <Badge>{c.mode}</Badge>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}

  <InfiniteLoadTrigger
    hasMore={hasMoreCollections}
    loading={loadingMore}
    error={loadMoreError}
    nextHref={pageHref(nextPageNumber)}
    label="Load more collections"
    onLoad={loadMoreCollections}
  />
</div>

<style>
  .thumb-grid {
    display: grid;
    grid-template-columns: repeat(max(1, min(var(--col-count, 5), 2)), minmax(0, 1fr));
    gap: 0.75rem;
  }
  @media (min-width: 640px) {
    .thumb-grid {
      grid-template-columns: repeat(max(1, min(var(--col-count, 5), 4)), minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .thumb-grid {
      grid-template-columns: repeat(var(--col-count, 5), minmax(0, 1fr));
    }
  }
</style>
