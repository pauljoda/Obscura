<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Users, Star, Image as ImageIcon } from "@lucide/svelte";
  import FilterBar, {
    type SortDir,
    type ActiveFilter,
    type ViewMode,
  } from "$lib/components/FilterBar.svelte";
  import FilterSection from "$lib/components/FilterSection.svelte";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import {
    deletePerformer,
    fetchPerformers as fetchMorePerformers,
    updatePerformer,
  } from "$lib/api/entities";
  import BulkActionBar from "$lib/components/BulkActionBar.svelte";
  import InfiniteLoadTrigger from "$lib/components/InfiniteLoadTrigger.svelte";
  import PerformerThumbnail from "$lib/components/PerformerThumbnail.svelte";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";

  let { data } = $props();

  const sortOptions = [
    { value: "name", label: "Name A–Z" },
    { value: "recent", label: "Recently Added" },
    { value: "rating", label: "Rating" },
  ];

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/performers?${qs}` : "/performers", { keepFocus: true, noScroll: true });
  }

  const FILTER_KEYS = [
    "gender",
    "country",
    "favorite",
    "hasImage",
    "ratingMin",
    "ratingMax",
  ] as const;
  type FilterKey = (typeof FILTER_KEYS)[number];

  function filterLabel(key: FilterKey): string {
    switch (key) {
      case "gender":
        return "Gender";
      case "country":
        return "Country";
      case "favorite":
        return "Favorite";
      case "hasImage":
        return "Photo";
      case "ratingMin":
        return "Min Rating";
      case "ratingMax":
        return "Max Rating";
    }
  }

  const activeFilters = $derived<ActiveFilter[]>(
    FILTER_KEYS.flatMap((key) => {
      const raw = page.url.searchParams.getAll(key);
      return raw.map((value) => ({ label: filterLabel(key), value, type: key }));
    }),
  );

  function onAddFilter(type: string, _label: string, value: string) {
    const params = new URLSearchParams(page.url.searchParams);
    if (type === "favorite" || type === "hasImage" || type === "ratingMin") {
      params.set(type, value);
    } else if (type === "ratingMax") {
      params.set(type, value);
    } else {
      const existing = params.getAll(type);
      if (!existing.includes(value)) params.append(type, value);
    }
    params.delete("page");
    void goto(`/performers?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  function onRemoveFilter(index: number) {
    const f = activeFilters[index];
    if (!f) return;
    const params = new URLSearchParams(page.url.searchParams);
    const remaining = params.getAll(f.type!).filter((v) => v !== f.value);
    params.delete(f.type!);
    for (const v of remaining) params.append(f.type!, v);
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/performers?${qs}` : "/performers", { keepFocus: true, noScroll: true });
  }

  function onClearFiltersAndSort() {
    void goto("/performers", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    activeFilters.length > 0 || data.sort !== "name" || data.order !== "asc" || !!data.search,
  );

  // svelte-ignore state_referenced_locally
  let loadedPerformers = $state.raw(data.performers);
  // svelte-ignore state_referenced_locally
  let loadedTotal = $state(data.total);
  let loadingMore = $state(false);
  let loadMoreError = $state<string | null>(null);
  let bulkBusy = $state(false);
  let selectedPerformerIds = $state.raw(new Set<string>());
  let dataSignature = $state("");

  const presetsApi = createServerPresets("performers:filterPresets");
  // svelte-ignore state_referenced_locally
  const viewPrefs = createServerPrefs<{ cols: number; viewMode: "grid" | "list" }>(
    "performers:view",
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
    if (preset.sortBy && preset.sortBy !== "name") params.set("sort", preset.sortBy);
    if (preset.sortDir && preset.sortDir !== "asc") params.set("order", preset.sortDir);
    for (const filter of preset.filters) {
      if (filter.type === "gender" || filter.type === "country") params.append(filter.type, filter.value);
      else if (filter.type) params.set(filter.type, filter.value);
    }
    const qs = params.toString();
    void goto(qs ? `/performers?${qs}` : "/performers", { keepFocus: true, noScroll: true });
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
        preset.id === id
          ? {
              ...currentPreset(preset.name),
              id,
            }
          : preset,
      ),
    );
  }

  function deletePreset(id: string) {
    presetsApi.save(presetsApi.presets.filter((preset) => preset.id !== id));
  }

  const countries = $derived(
    Array.from(
      new Set(loadedPerformers.map((p) => p.country).filter((value): value is string => !!value)),
    ).sort(),
  );
  const genders = $derived(
    Array.from(
      new Set(loadedPerformers.map((p) => p.gender).filter((value): value is string => !!value)),
    ).sort(),
  );

  // Group performers alphabetically
  const grouped = $derived.by(() => {
    type Perf = (typeof loadedPerformers)[number];
    const map = new Map<string, Perf[]>();
    for (const p of loadedPerformers) {
      const first = (p.name?.[0] ?? "?").toUpperCase();
      const key = /[A-Z]/.test(first) ? first : "#";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  const totalPages = $derived(Math.max(1, Math.ceil(loadedTotal / data.pageSize)));
  const loadedStart = $derived((data.page - 1) * data.pageSize);
  const loadedEnd = $derived(Math.min(loadedTotal, loadedStart + loadedPerformers.length));
  const hasMorePerformers = $derived(loadedEnd < loadedTotal);
  const nextPageNumber = $derived(
    Math.floor((loadedStart + loadedPerformers.length) / data.pageSize) + 1,
  );
  const visiblePerformerIds = $derived(loadedPerformers.map((performer) => performer.id));
  const allVisibleSelected = $derived(
    visiblePerformerIds.length > 0 &&
      visiblePerformerIds.every((id) => selectedPerformerIds.has(id)),
  );

  $effect(() => {
    const nextSignature = `${data.page}:${data.total}:${data.performers.map((p) => p.id).join("|")}`;
    if (nextSignature === dataSignature) return;
    dataSignature = nextSignature;
    loadedPerformers = data.performers;
    loadedTotal = data.total;
    loadingMore = false;
    loadMoreError = null;
    selectedPerformerIds = new Set(
      [...selectedPerformerIds].filter((id) =>
        data.performers.some((performer) => performer.id === id),
      ),
    );
  });

  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/performers?${qs}` : "/performers";
  }

  async function loadMorePerformers() {
    if (loadingMore || !hasMorePerformers) return;
    loadingMore = true;
    loadMoreError = null;
    const offset = loadedStart + loadedPerformers.length;

    try {
      const response = await fetchMorePerformers({
        search: data.search || undefined,
        sort: data.sort,
        order: data.order,
        gender: page.url.searchParams.get("gender") ?? undefined,
        favorite: page.url.searchParams.get("favorite") ?? undefined,
        country: page.url.searchParams.get("country") ?? undefined,
        hasImage: page.url.searchParams.get("hasImage") ?? undefined,
        ratingMin: Number(page.url.searchParams.get("ratingMin")) || undefined,
        ratingMax: Number(page.url.searchParams.get("ratingMax")) || undefined,
        nsfw: data.initialNsfwMode,
        counts: "false",
        limit: data.pageSize,
        offset,
      });
      const existing = new Set(loadedPerformers.map((performer) => performer.id));
      const nextPerformers = response.performers.filter(
        (performer) => !existing.has(performer.id),
      );
      loadedPerformers = [...loadedPerformers, ...nextPerformers];
      loadedTotal =
        response.performers.length === 0
          ? loadedStart + loadedPerformers.length
          : response.total;
    } catch {
      loadMoreError = "Could not load more actors.";
    } finally {
      loadingMore = false;
    }
  }

  function toggleSelectedPerformer(id: string) {
    const next = new Set(selectedPerformerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedPerformerIds = next;
  }

  function selectAllVisiblePerformers() {
    selectedPerformerIds = allVisibleSelected ? new Set() : new Set(visiblePerformerIds);
  }

  function clearSelectedPerformers() {
    selectedPerformerIds = new Set();
  }

  async function markSelectedPerformersNsfw() {
    const ids = [...selectedPerformerIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => updatePerformer(id, { isNsfw: true })));
      clearSelectedPerformers();
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  async function deleteSelectedPerformers() {
    const ids = [...selectedPerformerIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => deletePerformer(id)));
      const idSet = new Set(ids);
      loadedPerformers = loadedPerformers.filter((performer) => !idSet.has(performer.id));
      loadedTotal = Math.max(0, loadedTotal - ids.length);
      clearSelectedPerformers();
      await invalidateAll();
    } finally {
      bulkBusy = false;
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
        <Users class="h-5 w-5 text-text-accent" />
        Actors
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">Browse actors in your library</p>
    </div>
    <span class="mt-1 text-mono-sm text-text-disabled">{loadedTotal} total</span>
  </div>

  <FilterBar
    {sortOptions}
    {viewMode}
    onViewModeChange={(v: ViewMode) =>
      viewPrefs.update({ viewMode: v === "list" ? "list" : "grid" })}
    sortBy={data.sort}
    sortDir={data.order}
    onSortChange={(sort: string, dir?: SortDir) => updateUrl({ sort, order: dir ?? data.order })}
    searchQuery={data.search}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    searchPlaceholder="Search actors..."
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
          min: 3,
          max: 8,
          onChange: (n) => viewPrefs.update({ cols: n }),
          label: "Actor card size",
        }
      : undefined}
  >
    {#snippet customFilterSections({ panelFilters })}
      <FilterSection title="Actor">
        {#snippet children()}
          <div class="flex flex-wrap gap-1">
            <button
              type="button"
              onclick={() => onAddFilter("favorite", "Favorite", "true")}
              class={cn(
                "tag-chip cursor-pointer transition-colors duration-fast",
                panelFilters.some((f) => f.type === "favorite" && f.value === "true")
                  ? "tag-chip-accent"
                  : "tag-chip-default hover:tag-chip-accent",
              )}
            >
              <Star class="h-3 w-3" /> Favorites
            </button>
            <button
              type="button"
              onclick={() => onAddFilter("hasImage", "Photo", "true")}
              class={cn(
                "tag-chip cursor-pointer transition-colors duration-fast",
                panelFilters.some((f) => f.type === "hasImage" && f.value === "true")
                  ? "tag-chip-accent"
                  : "tag-chip-default hover:tag-chip-accent",
              )}
            >
              <ImageIcon class="h-3 w-3" /> Has photo
            </button>
            <button
              type="button"
              onclick={() => onAddFilter("hasImage", "Photo", "false")}
              class={cn(
                "tag-chip cursor-pointer transition-colors duration-fast",
                panelFilters.some((f) => f.type === "hasImage" && f.value === "false")
                  ? "tag-chip-accent"
                  : "tag-chip-default hover:tag-chip-accent",
              )}
            >
              No photo
            </button>
          </div>
        {/snippet}
      </FilterSection>

      {#if genders.length > 0}
        <FilterSection title="Gender">
          {#snippet children()}
            <div class="flex flex-wrap gap-1">
              {#each genders as gender (gender)}
                <button
                  type="button"
                  onclick={() => onAddFilter("gender", "Gender", gender)}
                  class={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    panelFilters.some((f) => f.type === "gender" && f.value === gender)
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  {gender.replaceAll("_", " ")}
                </button>
              {/each}
            </div>
          {/snippet}
        </FilterSection>
      {/if}

      {#if countries.length > 0}
        <FilterSection title="Country">
          {#snippet children()}
            <div class="flex flex-wrap gap-1 max-h-40 overflow-y-auto tag-scroll-area">
              {#each countries as country (country)}
                <button
                  type="button"
                  onclick={() => onAddFilter("country", "Country", country)}
                  class={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    panelFilters.some((f) => f.type === "country" && f.value === country)
                      ? "tag-chip-accent"
                      : "tag-chip-default hover:tag-chip-accent",
                  )}
                >
                  {country}
                </button>
              {/each}
            </div>
          {/snippet}
        </FilterSection>
      {/if}
    {/snippet}
  </FilterBar>

  {#if viewMode === "list"}
    <BulkActionBar
      selectedCount={selectedPerformerIds.size}
      visibleCount={visiblePerformerIds.length}
      allSelected={allVisibleSelected}
      itemLabel="actors"
      busy={bulkBusy}
      onSelectAll={selectAllVisiblePerformers}
      onClear={clearSelectedPerformers}
      onMarkNsfw={markSelectedPerformersNsfw}
      onDelete={deleteSelectedPerformers}
    />
  {/if}

  {#if loadedPerformers.length === 0}
    <div class="surface-panel p-8 text-center">
      <Users class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No actors match those filters.</p>
    </div>
  {:else if viewMode === "list"}
    <div class="surface-panel divide-y divide-border-subtle overflow-hidden">
      {#each loadedPerformers as p, i (p.id)}
        {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
        <div class="flex items-center gap-3 px-3 py-2">
          <Checkbox
            checked={selectedPerformerIds.has(p.id)}
            onchange={() => toggleSelectedPerformer(p.id)}
          />
          <a href={`/performers/${p.id}`} class="w-12 shrink-0">
            <PerformerThumbnail
              performer={p}
              gradientFallback={gradient}
              showChips={false}
              compact
            />
          </a>
          <a
            href={`/performers/${p.id}`}
            class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
          >
            {p.name}
          </a>
          {#if p.country}
            <span class="hidden text-[0.68rem] text-text-muted sm:inline">{p.country}</span>
          {/if}
        </div>
      {/each}
    </div>
  {:else if data.sort === "name"}
    <!-- Alphabetical grouping when name sort is active -->
    {#each grouped as [letter, group] (letter)}
      <section class="space-y-3">
        <div class="sticky top-0 z-10 bg-bg/80 backdrop-blur-sm py-2 border-b border-border-subtle">
          <h2 class="text-kicker text-text-accent">{letter}</h2>
        </div>
        <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
          {#each group as p, i (p.id)}
            {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
            <a
              href={`/performers/${p.id}`}
              class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast flex flex-col"
            >
              <PerformerThumbnail performer={p} gradientFallback={gradient} showChips={false} />
              <div class="p-2 space-y-1">
                <h4 class="truncate text-[0.8rem] font-medium text-text-primary leading-tight">
                  {p.name}
                </h4>
                {#if p.disambiguation}
                  <p class="truncate text-[0.65rem] text-text-disabled">{p.disambiguation}</p>
                {/if}
                {#if p.country}
                  <div class="truncate text-[0.62rem] text-text-muted">{p.country}</div>
                {/if}
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/each}
  {:else}
    <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
      {#each loadedPerformers as p, i (p.id)}
        {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
        <a
          href={`/performers/${p.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast flex flex-col"
        >
          <PerformerThumbnail performer={p} gradientFallback={gradient} showChips={false} />
          <div class="p-2 space-y-1">
            <h4 class="truncate text-[0.8rem] font-medium text-text-primary leading-tight">{p.name}</h4>
            {#if p.disambiguation}
              <p class="truncate text-[0.65rem] text-text-disabled">{p.disambiguation}</p>
            {/if}
            {#if p.country}
              <div class="truncate text-[0.62rem] text-text-muted">{p.country}</div>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}

  {#if totalPages > 1}
    <nav class="flex items-center justify-center gap-2 pt-4 border-t border-border-subtle">
      {#if data.page > 1}
        <a href={pageHref(data.page - 1)} class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary">
          Prev
        </a>
      {/if}
      <span class="text-body-sm text-text-muted">Showing {loadedEnd.toLocaleString()} of {loadedTotal.toLocaleString()}</span>
      {#if data.page < totalPages}
        <a href={pageHref(nextPageNumber)} class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary">
          Next
        </a>
      {/if}
    </nav>
  {/if}

  <InfiniteLoadTrigger
    hasMore={hasMorePerformers}
    loading={loadingMore}
    error={loadMoreError}
    nextHref={pageHref(nextPageNumber)}
    label="Load more actors"
    onLoad={loadMorePerformers}
  />
</div>

<style>
  .thumb-grid {
    display: grid;
    grid-template-columns: repeat(max(1, min(var(--col-count, 5), 3)), minmax(0, 1fr));
    gap: 0.75rem;
  }

  @media (min-width: 640px) {
    .thumb-grid {
      grid-template-columns: repeat(max(1, min(var(--col-count, 5), 5)), minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    .thumb-grid {
      grid-template-columns: repeat(var(--col-count, 5), minmax(0, 1fr));
    }
  }
</style>
