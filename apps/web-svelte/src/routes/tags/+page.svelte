<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Tag as TagIcon, Star, Image as ImageIcon } from "@lucide/svelte";
  import FilterBar, {
    type SortDir,
    type ActiveFilter,
  } from "$lib/components/FilterBar.svelte";
  import FilterSection from "$lib/components/FilterSection.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import TagThumbnail from "$lib/components/TagThumbnail.svelte";
  import { cn } from "@obscura/ui-svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";

  let { data } = $props();

  const sortOptions = [
    { value: "videos", label: "Usage Count" },
    { value: "name", label: "Name A-Z" },
    { value: "rating", label: "Rating" },
  ];

  const sortBy = $derived(page.url.searchParams.get("sort") ?? "videos");
  const sortDir: SortDir = $derived(
    page.url.searchParams.get("order") === "asc" ? "asc" : "desc",
  );
  const searchQuery = $derived(page.url.searchParams.get("search") ?? "");
  const favoriteFilter = $derived(page.url.searchParams.get("favorite"));
  const hasImageFilter = $derived(page.url.searchParams.get("hasImage"));
  const ratingMinFilter = $derived(page.url.searchParams.get("ratingMin"));

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    void goto(qs ? `/tags?${qs}` : "/tags", { keepFocus: true, noScroll: true });
  }

  const activeFilters = $derived<ActiveFilter[]>([
    ...(favoriteFilter ? [{ label: "Favorite", type: "favorite", value: favoriteFilter }] : []),
    ...(hasImageFilter ? [{ label: "Image", type: "hasImage", value: hasImageFilter }] : []),
    ...(ratingMinFilter
      ? [{ label: "Min rating", type: "ratingMin", value: ratingMinFilter }]
      : []),
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
    void goto("/tags", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    !!searchQuery || sortBy !== "videos" || sortDir !== "desc" || activeFilters.length > 0,
  );

  const presetsApi = createServerPresets("tags:filterPresets");
  const viewPrefs = createServerPrefs<{ cols: number }>("tags:view", { cols: 5 });

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
    if (preset.sortBy && preset.sortBy !== "videos") params.set("sort", preset.sortBy);
    if (preset.sortDir && preset.sortDir !== "desc") params.set("order", preset.sortDir);
    for (const filter of preset.filters) {
      if (filter.type) params.set(filter.type, filter.value);
    }
    const qs = params.toString();
    void goto(qs ? `/tags?${qs}` : "/tags", { keepFocus: true, noScroll: true });
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

  const filtered = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = data.tags;
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q));
    if (favoriteFilter === "true") list = list.filter((t) => t.favorite);
    if (hasImageFilter === "true") list = list.filter((t) => !!t.imagePath);
    if (hasImageFilter === "false") list = list.filter((t) => !t.imagePath);
    if (ratingMinFilter) {
      const n = Number(ratingMinFilter);
      if (Number.isFinite(n)) list = list.filter((t) => (t.rating ?? 0) >= n);
    }
    const sign = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "videos":
          return (
            sign *
            ((a.videoCount ?? 0) + (a.imageCount ?? 0) -
              ((b.videoCount ?? 0) + (b.imageCount ?? 0)))
          );
        case "rating":
          return sign * ((a.rating ?? 0) - (b.rating ?? 0));
        case "name":
        default:
          return sign * a.name.localeCompare(b.name);
      }
    });
    return list;
  });

  const withContent = $derived(
    filtered.filter((t) => (t.videoCount ?? 0) + (t.imageCount ?? 0) > 0),
  );
  const withoutContent = $derived(
    filtered.filter((t) => (t.videoCount ?? 0) + (t.imageCount ?? 0) === 0),
  );
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <TagIcon class="h-5 w-5 text-text-accent" />
        Tags
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse tags in your library</p>
    </div>
    <span class="text-mono-sm text-text-disabled mt-1">{filtered.length} total</span>
  </div>

  <FilterBar
    {sortOptions}
    {sortBy}
    {sortDir}
    onSortChange={(sort: string, dir?: SortDir) => updateUrl({ sort, order: dir ?? sortDir })}
    {searchQuery}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    searchPlaceholder="Search tags..."
    showViewToggle={false}
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
    thumbSize={{
      value: viewPrefs.current.cols,
      min: 2,
      max: 8,
      onChange: (n) => viewPrefs.update({ cols: n }),
      label: "Tag card size",
    }}
  >
    {#snippet customFilterSections({ panelFilters })}
      <FilterSection title="Tag">
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
              onclick={() => onAddFilter("hasImage", "Image", "true")}
              class={cn(
                "tag-chip cursor-pointer transition-colors duration-fast",
                panelFilters.some((f) => f.type === "hasImage" && f.value === "true")
                  ? "tag-chip-accent"
                  : "tag-chip-default hover:tag-chip-accent",
              )}
            >
              <ImageIcon class="h-3 w-3" /> Has image
            </button>
            <button
              type="button"
              onclick={() => onAddFilter("hasImage", "Image", "false")}
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

  {#if filtered.length === 0}
    <div class="surface-panel p-8 text-center">
      <TagIcon class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">
        {searchQuery ? "No tags match that search." : "No tags yet."}
      </p>
      {#if !searchQuery}
        <p class="text-body-sm text-text-disabled mt-1">
          Tags you create from the Identify or Edit flows will appear here.
        </p>
      {/if}
    </div>
  {:else}
    <div class="space-y-6">
      {#if withContent.length > 0}
        <HierarchySection title={`Tagged content · ${withContent.length}`}>
          {#snippet children()}
            <div class="tag-grid" style:--col-count={viewPrefs.current.cols}>
              {#each withContent as tag (tag.id)}
                <a
                  href={`/tags/${encodeURIComponent(tag.name)}`}
                  title={`${tag.name} — ${(tag.videoCount ?? 0) + (tag.imageCount ?? 0)} uses`}
                >
                  <TagThumbnail {tag} />
                </a>
              {/each}
            </div>
          {/snippet}
        </HierarchySection>
      {/if}

      {#if withoutContent.length > 0}
        <HierarchySection title={`Unused tags · ${withoutContent.length}`}>
          {#snippet children()}
            <div class="tag-grid" style:--col-count={viewPrefs.current.cols}>
              {#each withoutContent as tag (tag.id)}
                <a
                  href={`/tags/${encodeURIComponent(tag.name)}`}
                  title={tag.name}
                >
                  <TagThumbnail {tag} muted />
                </a>
              {/each}
            </div>
          {/snippet}
        </HierarchySection>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tag-grid {
    display: grid;
    grid-template-columns: repeat(max(1, min(var(--col-count, 5), 2)), minmax(0, 1fr));
    gap: 0.625rem;
  }
  @media (min-width: 640px) {
    .tag-grid {
      grid-template-columns: repeat(max(1, min(var(--col-count, 5), 4)), minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .tag-grid {
      grid-template-columns: repeat(var(--col-count, 5), minmax(0, 1fr));
    }
  }
</style>
