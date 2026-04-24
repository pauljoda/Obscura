<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { FolderOpen, Plus } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import FilterBar, { type SortDir } from "$lib/components/FilterBar.svelte";
  import CollectionThumbnail from "$lib/components/CollectionThumbnail.svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";

  let { data } = $props();

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
  const viewPrefs = createServerPrefs<{ cols: number }>("collections:view", { cols: 5 });

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

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/collections?${qs}` : "/collections";
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
    sortBy={data.sort}
    sortDir={data.order}
    onSortChange={(s: string, d?: SortDir) => updateUrl({ sort: s, order: d ?? data.order })}
    searchQuery={data.search}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    searchPlaceholder="Search collections..."
    showViewToggle={false}
    {onClearFiltersAndSort}
    {canClearFiltersAndSort}
    presets={presetsApi.presets}
    {activePresetId}
    onApplyPreset={applyPreset}
    onSavePreset={savePreset}
    onOverwritePreset={overwritePreset}
    onDeletePreset={deletePreset}
    thumbSize={{
      value: viewPrefs.current.cols,
      min: 2,
      max: 8,
      onChange: (n) => viewPrefs.update({ cols: n }),
      label: "Collection card size",
    }}
  />

  {#if data.collections.length === 0}
    <div class="surface-panel p-8 text-center">
      <FolderOpen class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No collections yet.</p>
    </div>
  {:else}
    <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
      {#each data.collections as c, i (c.id)}
        <a
          href={`/collections/${c.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
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

  {#if totalPages > 1}
    <nav class="flex items-center justify-center gap-2 pt-4 border-t border-border-subtle">
      {#if data.page > 1}
        <a href={pageHref(data.page - 1)} class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary">
          ← Prev
        </a>
      {/if}
      <span class="text-body-sm text-text-muted">Page {data.page} of {totalPages}</span>
      {#if data.page < totalPages}
        <a href={pageHref(data.page + 1)} class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary">
          Next →
        </a>
      {/if}
    </nav>
  {/if}
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
