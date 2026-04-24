<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Layers } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import FilterBar, { type SortDir, type ViewMode } from "$lib/components/FilterBar.svelte";
  import GalleryThumbnail from "$lib/components/GalleryThumbnail.svelte";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";

  let { data } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Gallery Date" },
    { value: "title", label: "Title A–Z" },
    { value: "imageCount", label: "Image Count" },
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
    void goto(qs ? `/galleries?${qs}` : "/galleries", { keepFocus: true, noScroll: true });
  }

  const FILTER_KEYS = ["studio", "performer", "tag", "ratingMin"] as const;
  type FilterKey = (typeof FILTER_KEYS)[number];

  function filterLabel(key: FilterKey): string {
    switch (key) {
      case "studio":
        return "Studio";
      case "performer":
        return "Performer";
      case "tag":
        return "Tag";
      case "ratingMin":
        return "Min Rating";
    }
  }

  const activeFilters = $derived(
    FILTER_KEYS.flatMap((key) => {
      const raw = page.url.searchParams.getAll(key);
      return raw.map((value) => ({ label: filterLabel(key), value, type: key }));
    }),
  );

  function onAddFilter(type: string, _label: string, value: string) {
    const params = new URLSearchParams(page.url.searchParams);
    if (type === "ratingMin") params.set(type, value);
    else {
      const existing = params.getAll(type);
      if (!existing.includes(value)) params.append(type, value);
    }
    params.delete("page");
    void goto(`/galleries?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  function onRemoveFilter(index: number) {
    const f = activeFilters[index];
    if (!f) return;
    const params = new URLSearchParams(page.url.searchParams);
    const remaining = params.getAll(f.type).filter((v) => v !== f.value);
    params.delete(f.type);
    for (const v of remaining) params.append(f.type, v);
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/galleries?${qs}` : "/galleries", { keepFocus: true, noScroll: true });
  }

  function onClearFiltersAndSort() {
    void goto("/galleries", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    activeFilters.length > 0 || data.sort !== "recent" || data.order !== "desc" || !!data.search,
  );

  const presetsApi = createServerPresets("galleries:filterPresets");
  // svelte-ignore state_referenced_locally
  const viewPrefs = createServerPrefs<{ cols: number }>(
    "galleries:view",
    {
      cols: 4,
    },
    data.viewPrefs,
  );
  let activePresetId = $state<string | null>(null);

  onMount(() => {
    void presetsApi.load();
    void viewPrefs.load();
  });

  function samePresetFilters(preset: FilterPreset): boolean {
    if (preset.sortBy !== data.sort || preset.sortDir !== data.order) return false;
    if (preset.filters.length !== activeFilters.length) return false;
    for (const pf of preset.filters) {
      if (
        !activeFilters.some(
          (af) => af.type === pf.type && af.value === pf.value,
        )
      ) {
        return false;
      }
    }
    return true;
  }

  $effect(() => {
    const match = presetsApi.presets.find((p) => samePresetFilters(p));
    activePresetId = match?.id ?? null;
  });

  function applyPreset(preset: FilterPreset) {
    const params = new URLSearchParams();
    if (preset.sortBy && preset.sortBy !== "recent") params.set("sort", preset.sortBy);
    if (preset.sortDir && preset.sortDir !== "desc") params.set("order", preset.sortDir);
    for (const f of preset.filters) {
      if (f.type === "ratingMin") params.set(f.type, f.value);
      else params.append(f.type, f.value);
    }
    const qs = params.toString();
    void goto(qs ? `/galleries?${qs}` : "/galleries", { keepFocus: true, noScroll: true });
  }

  function savePreset(name: string) {
    const id = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const next: FilterPreset = {
      id,
      name,
      filters: activeFilters.map((f) => ({ label: f.label, type: f.type, value: f.value })),
      sortBy: data.sort,
      sortDir: data.order,
    };
    presetsApi.save([...presetsApi.presets, next]);
  }

  function overwritePreset(id: string) {
    const next = presetsApi.presets.map((p) =>
      p.id === id
        ? {
            ...p,
            filters: activeFilters.map((f) => ({
              label: f.label,
              type: f.type,
              value: f.value,
            })),
            sortBy: data.sort,
            sortDir: data.order,
          }
        : p,
    );
    presetsApi.save(next);
  }

  function deletePreset(id: string) {
    presetsApi.save(presetsApi.presets.filter((p) => p.id !== id));
  }

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/galleries?${qs}` : "/galleries";
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Layers class="h-5 w-5 text-text-accent" />
        Galleries
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse galleries in your library</p>
    </div>
    <span class="text-mono-sm text-text-disabled mt-1">{data.total.toLocaleString()} total</span>
  </div>

  <FilterBar
    viewMode={data.view}
    onViewModeChange={(v: ViewMode) => updateUrl({ view: v === "grid" ? null : v })}
    sortBy={data.sort}
    sortDir={data.order}
    {sortOptions}
    onSortChange={(s: string, d?: SortDir) => updateUrl({ sort: s, order: d ?? data.order })}
    searchQuery={data.search}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    searchPlaceholder="Search galleries..."
    filterSections={["rating", "date"]}
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
    thumbSize={data.view !== "list"
      ? {
          value: viewPrefs.current.cols,
          min: 2,
          max: 8,
          onChange: (n) => viewPrefs.update({ cols: n }),
          label: "Gallery card size",
        }
      : undefined}
  />

  {#if data.galleries.length === 0}
    <div class="surface-panel p-8 text-center">
      <Layers class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No galleries match.</p>
    </div>
  {:else if data.view === "list"}
    <ul class="surface-panel divide-y divide-border-subtle overflow-hidden">
      {#each data.galleries as g, i (g.id)}
        <li>
          <a
            href={`/galleries/${g.id}`}
            class="flex items-center gap-3 px-3 py-2 text-body-sm hover:bg-surface-2 transition-colors duration-fast"
          >
            <div class="w-20 shrink-0">
              <GalleryThumbnail
                title={g.title}
                coverImagePath={g.coverImagePath}
                previewImagePaths={g.previewImagePaths}
                imageCount={g.imageCount}
                isNsfw={g.isNsfw}
                size="list"
                gradientFallback={VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
                showCount={false}
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="truncate text-text-primary">{g.title}</div>
              <div class="flex items-center gap-2 text-[0.7rem] text-text-muted mt-0.5">
                <span>{g.imageCount} image{g.imageCount === 1 ? "" : "s"}</span>
                {#if g.studioName}<span class="text-text-accent truncate">· {g.studioName}</span>{/if}
                {#if g.date}<span>· {g.date}</span>{/if}
              </div>
            </div>
            {#if g.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
      {#each data.galleries as g, i (g.id)}
        {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
        <a
          href={`/galleries/${g.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <GalleryThumbnail
            title={g.title}
            coverImagePath={g.coverImagePath}
            previewImagePaths={g.previewImagePaths}
            imageCount={g.imageCount}
            isNsfw={g.isNsfw}
            size="grid"
            gradientFallback={gradient}
          />
          <div class="p-2.5 space-y-1">
            <h4 class="truncate text-body font-medium text-text-primary">{g.title}</h4>
            <div class="flex items-center gap-1.5 text-[0.65rem] text-text-muted">
              <span>{g.imageCount} image{g.imageCount === 1 ? "" : "s"}</span>
              {#if g.studioName}<span class="text-text-accent truncate">· {g.studioName}</span>{/if}
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
    grid-template-columns: repeat(max(1, min(var(--col-count, 4), 3)), minmax(0, 1fr));
    gap: 0.625rem;
  }
  @media (min-width: 640px) {
    .thumb-grid {
      grid-template-columns: repeat(max(1, min(var(--col-count, 4), 5)), minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .thumb-grid {
      grid-template-columns: repeat(var(--col-count, 4), minmax(0, 1fr));
    }
  }
</style>
