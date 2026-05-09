<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Building2, Star } from "@lucide/svelte";
  import { Badge, Checkbox, dur, ease } from "@obscura/ui-svelte";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import BulkActionBar from "$lib/components/BulkActionBar.svelte";
  import FilterBar, {
    type SortDir,
    type ActiveFilter,
    type ViewMode,
  } from "$lib/components/FilterBar.svelte";
  import FilterSection from "$lib/media-surface/toolbar/FilterSection.svelte";
  import StudioThumbnail from "$lib/components/thumbnails/StudioThumbnail.svelte";
  import { cn } from "@obscura/ui-svelte";
  import { deleteStudio, updateStudio } from "$lib/api/entities";
  import {
    detectUiPrefsFormFactor,
    formFactorUiPrefKey,
  } from "$lib/prefs/form-factor-prefs";
  import { createServerPrefs } from "$lib/server-prefs.svelte";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";

  let { data } = $props();
  const viewPrefsFormFactor = detectUiPrefsFormFactor();

  const sortOptions = [
    { value: "name", label: "Name" },
    { value: "videoCount", label: "Video Count" },
    { value: "rating", label: "Rating" },
    { value: "randomized", label: "Randomized" },
  ];
  let randomSortSeed = $state(createRandomSortSeed());

  const sortBy = $derived(page.url.searchParams.get("sort") ?? "name");
  const sortDir: SortDir = $derived(
    page.url.searchParams.get("order") === "desc" ? "desc" : "asc",
  );
  let bulkBusy = $state(false);
  let selectedStudioIds = $state.raw(new Set<string>());
  const searchQuery = $derived(page.url.searchParams.get("search") ?? "");
  const favoriteFilter = $derived(page.url.searchParams.get("favorite"));
  const hasImageFilter = $derived(page.url.searchParams.get("hasImage"));

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    void goto(qs ? `/studios?${qs}` : "/studios", { keepFocus: true, noScroll: true });
  }

  function createRandomSortSeed(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function stableRandomSortValue(value: string): number {
    let hash = 2166136261;
    const input = `${randomSortSeed}:${value}`;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  const activeFilters = $derived<ActiveFilter[]>([
    ...(favoriteFilter ? [{ label: "Favorite", type: "favorite", value: favoriteFilter }] : []),
    ...(hasImageFilter ? [{ label: "Photo", type: "hasImage", value: hasImageFilter }] : []),
  ]);

  function onAddFilter(type: string, _label: string, value: string) {
    updateUrl({ [type]: value });
  }

  function onRemoveFilter(index: number) {
    const f = activeFilters[index];
    if (!f) return;
    updateUrl({ [f.type!]: null });
  }

  function onClearFiltersAndSort() {
    void goto("/studios", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    !!searchQuery || sortBy !== "name" || sortDir !== "asc" || activeFilters.length > 0,
  );

  const presetsApi = createServerPresets("studios:filterPresets");
  // svelte-ignore state_referenced_locally
  const viewPrefs = createServerPrefs<{ cols: number; viewMode: "grid" | "list" }>(
    formFactorUiPrefKey("studios:view", viewPrefsFormFactor),
    { cols: 2, viewMode: "grid" },
    data.viewPrefsByFormFactor?.[viewPrefsFormFactor] ?? data.viewPrefs,
  );
  const viewMode = $derived(viewPrefs.current.viewMode);

  onMount(() => {
    void presetsApi.load();
    void viewPrefs.load();
  });

  function samePresetFilters(preset: FilterPreset): boolean {
    if (preset.sortBy !== sortBy || preset.sortDir !== sortDir) return false;
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
      if (filter.type) params.set(filter.type, filter.value);
    }
    const qs = params.toString();
    void goto(qs ? `/studios?${qs}` : "/studios", { keepFocus: true, noScroll: true });
  }

  function currentPreset(name: string): FilterPreset {
    return {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      filters: activeFilters.map((f) => ({ label: f.label, type: f.type ?? f.label, value: f.value })),
      sortBy,
      sortDir,
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

  // Client-side filter + sort — the server returns the full list.
  const filtered = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = data.studios;
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
    if (favoriteFilter === "true") list = list.filter((s) => s.favorite);
    if (hasImageFilter === "true") list = list.filter((s) => !!(s.imagePath || s.imageUrl));
    if (hasImageFilter === "false") list = list.filter((s) => !(s.imagePath || s.imageUrl));
    const sign = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "videoCount":
          return sign * ((a.videoCount ?? 0) - (b.videoCount ?? 0));
        case "rating":
          return sign * ((a.rating ?? 0) - (b.rating ?? 0));
        case "randomized":
          return stableRandomSortValue(a.id) - stableRandomSortValue(b.id);
        case "name":
        default:
          return sign * a.name.localeCompare(b.name);
      }
    });
    return list;
  });
  const visibleStudioIds = $derived(filtered.map((studio) => studio.id));
  const allVisibleSelected = $derived(
    visibleStudioIds.length > 0 && visibleStudioIds.every((id) => selectedStudioIds.has(id)),
  );

  function toggleSelectedStudio(id: string) {
    const next = new Set(selectedStudioIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedStudioIds = next;
  }

  function selectAllVisibleStudios() {
    selectedStudioIds = allVisibleSelected ? new Set() : new Set(visibleStudioIds);
  }

  function clearSelectedStudios() {
    selectedStudioIds = new Set();
  }

  async function markSelectedStudiosNsfw() {
    const ids = [...selectedStudioIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => updateStudio(id, { isNsfw: true })));
      clearSelectedStudios();
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  async function deleteSelectedStudios() {
    const ids = [...selectedStudioIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => deleteStudio(id)));
      clearSelectedStudios();
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
        <Building2 class="h-5 w-5 text-text-accent" />
        Studios
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse studios in your library</p>
    </div>
    <span class="text-mono-sm text-text-disabled mt-1">
      {filtered.length} total
    </span>
  </div>

  <FilterBar
    {sortOptions}
    {viewMode}
    onViewModeChange={(v: ViewMode) =>
      viewPrefs.update({ viewMode: v === "list" ? "list" : "grid" })}
    {sortBy}
    {sortDir}
    onSortChange={(sort: string, dir?: SortDir) => {
      if (sort === "randomized") randomSortSeed = createRandomSortSeed();
      updateUrl({ sort, order: dir ?? sortDir });
    }}
    {searchQuery}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    searchPlaceholder="Search studios..."
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
          max: 6,
          onChange: (n) => viewPrefs.update({ cols: n }),
          label: "Studio card size",
        }
      : undefined}
  >
    {#snippet customFilterSections({ panelFilters })}
      <FilterSection title="Studio">
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
              Has image
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
              No image
            </button>
          </div>
        {/snippet}
      </FilterSection>
    {/snippet}
  </FilterBar>

  {#if viewMode === "list"}
    <BulkActionBar
      selectedCount={selectedStudioIds.size}
      visibleCount={visibleStudioIds.length}
      allSelected={allVisibleSelected}
      itemLabel="studios"
      busy={bulkBusy}
      onSelectAll={selectAllVisibleStudios}
      onClear={clearSelectedStudios}
      onMarkNsfw={markSelectedStudiosNsfw}
      onDelete={deleteSelectedStudios}
    />
  {/if}

  {#if filtered.length === 0}
    <div class="surface-panel p-8 text-center">
      <Building2 class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">
        {searchQuery ? "No studios match that search." : "No studios yet."}
      </p>
    </div>
  {:else if viewMode === "list"}
    <div class="surface-panel divide-y divide-border-subtle overflow-hidden">
      {#each filtered as studio, i (studio.id)}
        <div
          class="flex items-center gap-3 px-3 py-2"
          animate:flip={{ duration: dur.moderate, easing: ease.mechanical }}
          in:fade|global={{ duration: dur.normal, delay: Math.min(i * 12, 150), easing: ease.enter }}
        >
          <Checkbox
            checked={selectedStudioIds.has(studio.id)}
            onchange={() => toggleSelectedStudio(studio.id)}
          />
          <a href={`/studios/${studio.id}`} class="w-16 shrink-0">
            <StudioThumbnail {studio} gradientIndex={i} size="list" showChips={false} />
          </a>
          <a
            href={`/studios/${studio.id}`}
            class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
          >
            {studio.name}
          </a>
          {#if studio.isNsfw}
            <Badge variant="warning">
              {#snippet children()}NSFW{/snippet}
            </Badge>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
      {#each filtered as studio, i (studio.id)}
        <a
          href={`/studios/${studio.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
          animate:flip={{ duration: dur.moderate, easing: ease.mechanical }}
          in:fade|global={{ duration: dur.normal, delay: Math.min(i * 12, 150), easing: ease.enter }}
        >
          <StudioThumbnail {studio} gradientIndex={i} />
          <div class="p-2.5 space-y-1.5">
            <h4 class="truncate text-body font-medium text-text-primary">{studio.name}</h4>
            <div class="flex flex-wrap items-center gap-1">
              {#if studio.isNsfw}
                <Badge variant="warning">
                  {#snippet children()}NSFW{/snippet}
                </Badge>
              {/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .thumb-grid {
    display: grid;
    grid-template-columns: repeat(max(1, min(var(--col-count, 4), 2)), minmax(0, 1fr));
    gap: 0.75rem;
  }
  @media (min-width: 640px) {
    .thumb-grid {
      grid-template-columns: repeat(max(1, min(var(--col-count, 4), 3)), minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .thumb-grid {
      grid-template-columns: repeat(var(--col-count, 4), minmax(0, 1fr));
    }
  }
</style>
