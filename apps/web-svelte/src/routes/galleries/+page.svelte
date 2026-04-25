<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Layers } from "@lucide/svelte";
  import { Badge, Checkbox, dur, ease } from "@obscura/ui-svelte";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import type { PageData } from "./$types";
  import BulkActionBar from "$lib/components/BulkActionBar.svelte";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import FilterBar, { type SortDir, type ViewMode } from "$lib/components/FilterBar.svelte";
  import GalleryThumbnail from "$lib/components/thumbnails/GalleryThumbnail.svelte";
  import InfiniteLoadTrigger from "$lib/media-surface/pagination/InfiniteLoadTrigger.svelte";
  import { deleteGallery, fetchGalleries as fetchMoreGalleries, updateGallery } from "$lib/api/media";
  import { mergeUniquePage } from "$lib/media-surface/pagination/load-more";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";

  let { data }: { data: PageData } = $props();

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
  const viewPrefs = createServerPrefs<{ cols: number; viewMode: "grid" | "list" }>(
    "galleries:view",
    {
      cols: 4,
      viewMode: "grid",
    },
    data.viewPrefs,
  );
  const viewMode = $derived(viewPrefs.current.viewMode);
  let activePresetId = $state<string | null>(null);
  // svelte-ignore state_referenced_locally
  let loadedGalleries = $state.raw(data.galleries);
  // svelte-ignore state_referenced_locally
  let loadedTotal = $state(data.total);
  let loadingMore = $state(false);
  let loadMoreError = $state<string | null>(null);
  let bulkBusy = $state(false);
  let deleteDialogOpen = $state(false);
  let selectedGalleryIds = $state.raw(new Set<string>());
  let dataSignature = $state("");
  const visibleGalleryIds = $derived(loadedGalleries.map((gallery) => gallery.id));
  const allVisibleSelected = $derived(
    visibleGalleryIds.length > 0 && visibleGalleryIds.every((id) => selectedGalleryIds.has(id)),
  );

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

  function toggleSelectedGallery(id: string) {
    const next = new Set(selectedGalleryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedGalleryIds = next;
  }

  function selectAllVisibleGalleries() {
    selectedGalleryIds = allVisibleSelected ? new Set() : new Set(visibleGalleryIds);
  }

  function clearSelectedGalleries() {
    selectedGalleryIds = new Set();
  }

  async function markSelectedGalleriesNsfw() {
    const ids = [...selectedGalleryIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => updateGallery(id, { isNsfw: true })));
      clearSelectedGalleries();
      await invalidateAll();
    } finally {
      bulkBusy = false;
      deleteDialogOpen = false;
    }
  }

  async function deleteSelectedGalleries(deleteFromDisk = false) {
    const ids = [...selectedGalleryIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => deleteGallery(id, deleteFromDisk)));
      clearSelectedGalleries();
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  const loadedStart = $derived((data.page - 1) * data.pageSize);
  const loadedEnd = $derived(Math.min(loadedTotal, loadedStart + loadedGalleries.length));
  const hasMoreGalleries = $derived(loadedEnd < loadedTotal);
  const nextPageNumber = $derived(
    Math.floor((loadedStart + loadedGalleries.length) / data.pageSize) + 1,
  );

  $effect(() => {
    const nextSignature = `${data.page}:${data.total}:${data.galleries.map((g) => g.id).join("|")}`;
    if (nextSignature === dataSignature) return;
    dataSignature = nextSignature;
    loadedGalleries = data.galleries;
    loadedTotal = data.total;
    loadingMore = false;
    loadMoreError = null;
    selectedGalleryIds = new Set(
      [...selectedGalleryIds].filter((id) =>
        data.galleries.some((gallery) => gallery.id === id),
      ),
    );
  });

  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/galleries?${qs}` : "/galleries";
  }

  function numericParam(name: string): number | undefined {
    const raw = page.url.searchParams.get(name);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  async function loadMoreGalleries() {
    if (loadingMore || !hasMoreGalleries) return;
    loadingMore = true;
    loadMoreError = null;
    const offset = loadedStart + loadedGalleries.length;

    try {
      const response = await fetchMoreGalleries({
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
        nsfw: data.nsfwMode,
        limit: data.pageSize,
        offset,
      });
      const merged = mergeUniquePage({
        current: loadedGalleries,
        incoming: response.galleries,
        loadedStart,
        total: response.total,
      });
      loadedGalleries = merged.items;
      loadedTotal = merged.total;
    } catch {
      loadMoreError = "Could not load more galleries.";
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
        <Layers class="h-5 w-5 text-text-accent" />
        Galleries
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse galleries in your library</p>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-mono-sm text-text-disabled mt-1">{loadedTotal.toLocaleString()} total</span>
    </div>
  </div>

  <FilterBar
    {viewMode}
    onViewModeChange={(v: ViewMode) =>
      viewPrefs.update({ viewMode: v === "list" ? "list" : "grid" })}
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
    thumbSize={viewMode === "grid"
      ? {
          value: viewPrefs.current.cols,
          min: 2,
          max: 8,
          onChange: (n) => viewPrefs.update({ cols: n }),
          label: "Gallery card size",
        }
      : undefined}
  />

  {#if viewMode === "list"}
    <BulkActionBar
      selectedCount={selectedGalleryIds.size}
      visibleCount={visibleGalleryIds.length}
      allSelected={allVisibleSelected}
      itemLabel="galleries"
      busy={bulkBusy}
      onSelectAll={selectAllVisibleGalleries}
      onClear={clearSelectedGalleries}
      onMarkNsfw={markSelectedGalleriesNsfw}
      onDelete={() => {
        deleteDialogOpen = true;
      }}
    />
  {/if}

  {#if loadedGalleries.length === 0}
    <div class="surface-panel p-8 text-center">
      <Layers class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No galleries match.</p>
    </div>
  {:else if viewMode === "list"}
    <ul class="surface-panel divide-y divide-border-subtle overflow-hidden">
      {#each loadedGalleries as g, i (g.id)}
        <li
          class="relative"
          animate:flip={{ duration: dur.moderate, easing: ease.mechanical }}
          in:fade|global={{ duration: dur.normal, delay: Math.min(i * 12, 150), easing: ease.enter }}
        >
          <button
            type="button"
            class="absolute left-2 top-1/2 z-10 -translate-y-1/2 glass-2 border border-border-subtle p-1"
            onclick={() => toggleSelectedGallery(g.id)}
            aria-label={`Select ${g.title}`}
          >
            <Checkbox checked={selectedGalleryIds.has(g.id)} />
          </button>
          <a
            href={`/galleries/${g.id}`}
            class="flex items-center gap-3 py-2 pl-11 pr-3 text-body-sm hover:bg-surface-2 transition-colors duration-fast"
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
      {#each loadedGalleries as g, i (g.id)}
        {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
        <a
          href={`/galleries/${g.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
          animate:flip={{ duration: dur.moderate, easing: ease.mechanical }}
          in:fade|global={{ duration: dur.normal, delay: Math.min(i * 12, 150), easing: ease.enter }}
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

  <InfiniteLoadTrigger
    hasMore={hasMoreGalleries}
    loading={loadingMore}
    error={loadMoreError}
    nextHref={pageHref(nextPageNumber)}
    label="Load more galleries"
    onLoad={loadMoreGalleries}
  />
</div>

<ConfirmDeleteDialog
  open={deleteDialogOpen}
  entityType="gallery"
  count={selectedGalleryIds.size}
  loading={bulkBusy}
  allowDeleteFromDisk
  onClose={() => (deleteDialogOpen = false)}
  onDeleteFromLibrary={() => void deleteSelectedGalleries(false)}
  onDeleteFromDisk={() => void deleteSelectedGalleries(true)}
/>

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
