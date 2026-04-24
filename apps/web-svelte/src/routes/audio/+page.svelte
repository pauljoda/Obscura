<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Music, Play, Disc3 } from "@lucide/svelte";
  import { Badge, cn } from "@obscura/ui-svelte";
  import FilterBar, {
    type SortDir,
    type ActiveFilter,
  } from "$lib/components/FilterBar.svelte";
  import FilterSection from "$lib/components/FilterSection.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/NsfwShowModeChip.svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import { createServerPrefs } from "$lib/server-prefs.svelte";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";

  let { data } = $props();

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
  const viewPrefs = createServerPrefs<{ cols: number }>("audio:view", { cols: 5 });

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

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/audio?${qs}` : "/audio";
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
    <span class="text-mono-sm text-text-disabled mt-1">{data.total.toLocaleString()} total</span>
  </div>

  <FilterBar
    {sortOptions}
    sortBy={data.sort}
    sortDir={data.order}
    onSortChange={(s: string, d?: SortDir) => updateUrl({ sort: s, order: d ?? data.order })}
    searchQuery={data.search}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    searchPlaceholder="Search audio..."
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
      label: "Album card size",
    }}
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

  {#if data.libraries.length === 0}
    <div class="surface-panel p-8 text-center">
      <Music class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No audio libraries.</p>
    </div>
  {:else}
    <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
      {#each data.libraries as a, i (a.id)}
        {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
        <a
          href={`/audio/${a.id}`}
          class="group/card surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <NsfwBlur isNsfw={a.isNsfw} class="block">
            <div class="aspect-square bg-surface-1 relative">
              {#if a.coverImagePath}
                <img
                  src={toApiUrl(a.coverImagePath)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover transition-transform duration-normal group-hover/card:scale-105"
                />
              {:else}
                <div class={gradient + " h-full w-full flex items-center justify-center relative overflow-hidden"}>
                  <Disc3 class="h-16 w-16 text-white/15 animate-[spin_12s_linear_infinite]" />
                  <Music class="absolute h-6 w-6 text-white/40" />
                </div>
              {/if}

              <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-60 transition-opacity duration-normal group-hover/card:opacity-90"></div>

              <div class="pointer-events-none absolute bottom-1.5 right-1.5 z-20 translate-y-1 opacity-0 transition-all duration-normal group-hover/card:translate-y-0 group-hover/card:opacity-100">
                <span class="inline-flex h-9 w-9 items-center justify-center border border-border-accent bg-gradient-to-br from-accent-500 to-accent-700 text-bg shadow-[var(--shadow-glow-accent-strong)]">
                  <Play class="h-4 w-4 ml-0.5" fill="currentColor" />
                </span>
              </div>

              <div class="pointer-events-none absolute bottom-1 left-1 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.6rem] font-mono text-white/90 bg-black/55 backdrop-blur-sm">
                <Music class="h-2.5 w-2.5" />
                {a.trackCount}
              </div>

              <div class="pointer-events-none absolute bottom-1 right-1 z-10 group-hover/card:opacity-0 transition-opacity">
                <NsfwShowModeChip isNsfw={a.isNsfw} />
              </div>
            </div>
          </NsfwBlur>
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
