<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Music } from "@lucide/svelte";
  import { Badge, Checkbox, cn } from "@obscura/ui-svelte";
  import type { PageData } from "./$types";
  import BulkActionBar from "$lib/components/BulkActionBar.svelte";
  import FilterBar, {
    type SortDir,
    type ActiveFilter,
    type ViewMode,
  } from "$lib/components/FilterBar.svelte";
  import FilterSection from "$lib/components/FilterSection.svelte";
  import AudioLibraryThumbnail from "$lib/components/thumbnails/AudioLibraryThumbnail.svelte";
  import InfiniteLoadTrigger from "$lib/components/InfiniteLoadTrigger.svelte";
  import {
    deleteAudioLibrary,
    fetchAudioLibraries as fetchMoreAudioLibraries,
    updateAudioLibrary,
  } from "$lib/api/media";
  import { createServerPrefs } from "$lib/server-prefs.svelte";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";

  let { data }: { data: PageData } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Release Date" },
    { value: "title", label: "Title A–Z" },
    { value: "trackCount", label: "Track Count" },
    { value: "rating", label: "Rating" },
  ];

  const organizedFilter = $derived(page.url.searchParams.get("organized"));
  const ratingMinFilter = $derived(page.url.searchParams.get("ratingMin"));

  const activeFilters = $derived<ActiveFilter[]>([
    ...(organizedFilter
      ? [{ label: "Organized", type: "organized", value: organizedFilter }]
      : []),
    ...(ratingMinFilter
      ? [{ label: "Min rating", type: "ratingMin", value: ratingMinFilter }]
      : []),
  ]);

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/audio?${qs}` : "/audio", { keepFocus: true, noScroll: true });
  }

  function onAddFilter(type: string, _label: string, value: string) {
    updateUrl({ [type]: value });
  }

  function onRemoveFilter(index: number) {
    const f = activeFilters[index];
    if (!f) return;
    updateUrl({ [f.type!]: null });
  }

  function onClearFiltersAndSort() {
    void goto("/audio", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    !!data.search || data.sort !== "recent" || data.order !== "desc" || activeFilters.length > 0,
  );

  const presetsApi = createServerPresets("audio:filterPresets");
  // svelte-ignore state_referenced_locally
  const viewPrefs = createServerPrefs<{ cols: number; viewMode: "grid" | "list" }>(
    "audio:view",
    { cols: 5, viewMode: "grid" },
    data.viewPrefs,
  );
  const viewMode = $derived(viewPrefs.current.viewMode);

  onMount(() => {
    void presetsApi.load();
    void viewPrefs.load();
  });

  function samePresetFilters(preset: FilterPreset): boolean {
    if (preset.sortBy !== data.sort || preset.sortDir !== data.order) return false;
    if (preset.filters.length !== activeFilters.length) return false;
    return preset.filters.every((pf) =>
      activeFilters.some((af) => af.type === pf.type && af.value === pf.value),
    );
  }

  const activePresetId = $derived.by(() => {
    const match = presetsApi.presets.find((preset) => samePresetFilters(preset));
    return match?.id ?? null;
  });

  function applyPreset(preset: FilterPreset) {
    const params = new URLSearchParams();
    if (preset.sortBy && preset.sortBy !== "recent") params.set("sort", preset.sortBy);
    if (preset.sortDir && preset.sortDir !== "desc") params.set("order", preset.sortDir);
    for (const filter of preset.filters) {
      if (filter.type) params.set(filter.type, filter.value);
    }
    const qs = params.toString();
    void goto(qs ? `/audio?${qs}` : "/audio", { keepFocus: true, noScroll: true });
  }

  function currentPreset(name: string): FilterPreset {
    return {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      filters: activeFilters.map((f) => ({ label: f.label, type: f.type ?? f.label, value: f.value })),
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
  let loadedLibraries = $state.raw(data.libraries);
  // svelte-ignore state_referenced_locally
  let loadedTotal = $state(data.total);
  let loadingMore = $state(false);
  let loadMoreError = $state<string | null>(null);
  let bulkBusy = $state(false);
  let selectedLibraryIds = $state.raw(new Set<string>());
  let dataSignature = $state("");
  const visibleLibraryIds = $derived(loadedLibraries.map((library) => library.id));
  const allVisibleSelected = $derived(
    visibleLibraryIds.length > 0 && visibleLibraryIds.every((id) => selectedLibraryIds.has(id)),
  );
  const loadedStart = $derived((data.page - 1) * data.pageSize);
  const loadedEnd = $derived(Math.min(loadedTotal, loadedStart + loadedLibraries.length));
  const hasMoreLibraries = $derived(loadedEnd < loadedTotal);
  const nextPageNumber = $derived(
    Math.floor((loadedStart + loadedLibraries.length) / data.pageSize) + 1,
  );

  $effect(() => {
    const nextSignature = `${data.page}:${data.total}:${data.libraries.map((library) => library.id).join("|")}`;
    if (nextSignature === dataSignature) return;
    dataSignature = nextSignature;
    loadedLibraries = data.libraries;
    loadedTotal = data.total;
    loadingMore = false;
    loadMoreError = null;
    selectedLibraryIds = new Set(
      [...selectedLibraryIds].filter((id) =>
        data.libraries.some((library) => library.id === id),
      ),
    );
  });

  function toggleSelectedLibrary(id: string) {
    const next = new Set(selectedLibraryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedLibraryIds = next;
  }

  function selectAllVisibleLibraries() {
    selectedLibraryIds = allVisibleSelected ? new Set() : new Set(visibleLibraryIds);
  }

  function clearSelectedLibraries() {
    selectedLibraryIds = new Set();
  }

  async function markSelectedLibrariesNsfw() {
    const ids = [...selectedLibraryIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => updateAudioLibrary(id, { isNsfw: true })));
      clearSelectedLibraries();
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  async function deleteSelectedLibraries() {
    const ids = [...selectedLibraryIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => deleteAudioLibrary(id)));
      clearSelectedLibraries();
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
    return qs ? `/audio?${qs}` : "/audio";
  }

  function numericParam(name: string): number | undefined {
    const raw = page.url.searchParams.get(name);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  async function loadMoreAudioLibraries() {
    if (loadingMore || !hasMoreLibraries) return;
    loadingMore = true;
    loadMoreError = null;
    const offset = loadedStart + loadedLibraries.length;

    try {
      const response = await fetchMoreAudioLibraries({
        search: data.search || undefined,
        sort: data.sort,
        order: data.order,
        studio: page.url.searchParams.get("studio") ?? undefined,
        tag: page.url.searchParams.getAll("tag"),
        performer: page.url.searchParams.getAll("performer"),
        ratingMin: numericParam("ratingMin"),
        ratingMax: numericParam("ratingMax"),
        dateFrom: page.url.searchParams.get("dateFrom") ?? undefined,
        dateTo: page.url.searchParams.get("dateTo") ?? undefined,
        organized: page.url.searchParams.get("organized") ?? undefined,
        nsfw: data.nsfwMode,
        limit: data.pageSize,
        offset,
      });
      const existing = new Set(loadedLibraries.map((library) => library.id));
      const nextLibraries = response.items.filter((library) => !existing.has(library.id));
      loadedLibraries = [...loadedLibraries, ...nextLibraries];
      loadedTotal =
        response.items.length === 0 ? loadedStart + loadedLibraries.length : response.total;
    } catch {
      loadMoreError = "Could not load more audio libraries.";
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
        <Music class="h-5 w-5 text-text-accent" />
        Audio
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse audio libraries in your collection</p>
    </div>
    <span class="text-mono-sm text-text-disabled mt-1">{loadedTotal.toLocaleString()} total</span>
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
    searchPlaceholder="Search audio..."
    filterSections={["rating"]}
    {activeFilters}
    {onAddFilter}
    {onRemoveFilter}
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
          label: "Album card size",
        }
      : undefined}
  >
    {#snippet customFilterSections({ panelFilters })}
      <FilterSection title="Library flags">
        {#snippet children()}
          <div class="flex flex-wrap gap-1">
            {#each [
              { type: "organized", value: "true", label: "Organized" },
              { type: "organized", value: "false", label: "Not organized" },
            ] as item (`${item.type}-${item.value}`)}
              <button
                type="button"
                onclick={() => onAddFilter(item.type, "Organized", item.value)}
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
    {/snippet}
  </FilterBar>

  {#if viewMode === "list"}
    <BulkActionBar
      selectedCount={selectedLibraryIds.size}
      visibleCount={visibleLibraryIds.length}
      allSelected={allVisibleSelected}
      itemLabel="audio libraries"
      busy={bulkBusy}
      onSelectAll={selectAllVisibleLibraries}
      onClear={clearSelectedLibraries}
      onMarkNsfw={markSelectedLibrariesNsfw}
      onDelete={deleteSelectedLibraries}
    />
  {/if}

  {#if loadedLibraries.length === 0}
    <div class="surface-panel p-8 text-center">
      <Music class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No audio libraries.</p>
    </div>
  {:else if viewMode === "list"}
    <div class="surface-panel divide-y divide-border-subtle overflow-hidden">
      {#each loadedLibraries as a, i (a.id)}
        <div class="flex items-center gap-3 px-3 py-2">
          <Checkbox
            checked={selectedLibraryIds.has(a.id)}
            onchange={() => toggleSelectedLibrary(a.id)}
          />
          <a href={`/audio/${a.id}`} class="w-14 shrink-0">
            <AudioLibraryThumbnail
              library={a}
              gradientIndex={i}
              size="list"
              showChips={false}
              showPlayOverlay={false}
            />
          </a>
          <a
            href={`/audio/${a.id}`}
            class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
          >
            {a.title}
          </a>
          {#if a.studioName}
            <span class="hidden text-[0.68rem] text-text-accent sm:inline">{a.studioName}</span>
          {:else}
            <span class="hidden text-[0.68rem] text-text-muted sm:inline">
              {a.trackCount} track{a.trackCount === 1 ? "" : "s"}
            </span>
          {/if}
          {#if a.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
      {#each loadedLibraries as a, i (a.id)}
        <a
          href={`/audio/${a.id}`}
          class="group/card surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <AudioLibraryThumbnail library={a} gradientIndex={i} />
          <div class="p-2 space-y-0.5">
            <h4 class="truncate text-body-sm font-medium text-text-primary transition-colors group-hover/card:text-text-accent">{a.title}</h4>
            <div class="flex items-center gap-1.5 text-[0.62rem] text-text-muted">
              {#if a.studioName}
                <span class="truncate text-text-accent">{a.studioName}</span>
              {:else}
                <span>{a.trackCount} track{a.trackCount === 1 ? "" : "s"}</span>
              {/if}
              {#if a.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}

  <InfiniteLoadTrigger
    hasMore={hasMoreLibraries}
    loading={loadingMore}
    error={loadMoreError}
    nextHref={pageHref(nextPageNumber)}
    label="Load more audio libraries"
    onLoad={loadMoreAudioLibraries}
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
