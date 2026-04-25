<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Image as ImageIcon } from "@lucide/svelte";
  import { Checkbox } from "@obscura/ui-svelte";
  import type { PageData } from "./$types";
  import BulkActionBar from "$lib/components/BulkActionBar.svelte";
  import FilterBar, { type SortDir, type ViewMode } from "$lib/components/FilterBar.svelte";
  import ImageThumbnail from "$lib/components/thumbnails/ImageThumbnail.svelte";
  import InfiniteLoadTrigger from "$lib/components/InfiniteLoadTrigger.svelte";
  import { deleteImage, fetchImages as fetchMoreImages, updateImage } from "$lib/api/media";
  import { mergeUniquePage } from "$lib/pagination/load-more";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";

  let { data }: { data: PageData } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Image Date" },
    { value: "title", label: "Title A–Z" },
    { value: "resolution", label: "Resolution" },
    { value: "size", label: "File Size" },
    { value: "rating", label: "Rating" },
  ];

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
    void goto(`/images?${params.toString()}`, { keepFocus: true, noScroll: true });
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
    void goto(qs ? `/images?${qs}` : "/images", { keepFocus: true, noScroll: true });
  }

  function onClearFiltersAndSort() {
    void goto("/images", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    activeFilters.length > 0 || data.sort !== "recent" || data.order !== "desc" || !!data.search,
  );

  const presetsApi = createServerPresets("images:filterPresets");
  // svelte-ignore state_referenced_locally
  const viewPrefs = createServerPrefs<{ cols: number; viewMode: "grid" | "list" }>(
    "images:view",
    {
      cols: 8,
      viewMode: "grid",
    },
    data.viewPrefs,
  );
  const viewMode = $derived(viewPrefs.current.viewMode);
  let activePresetId = $state<string | null>(null);
  // svelte-ignore state_referenced_locally
  let loadedImages = $state.raw(data.images);
  // svelte-ignore state_referenced_locally
  let loadedTotal = $state(data.total);
  let loadingMore = $state(false);
  let loadMoreError = $state<string | null>(null);
  let bulkBusy = $state(false);
  let selectedImageIds = $state.raw(new Set<string>());
  let dataSignature = $state("");
  const visibleImageIds = $derived(loadedImages.map((image) => image.id));
  const allVisibleSelected = $derived(
    visibleImageIds.length > 0 && visibleImageIds.every((id) => selectedImageIds.has(id)),
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
    void goto(qs ? `/images?${qs}` : "/images", { keepFocus: true, noScroll: true });
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

  function toggleSelectedImage(id: string) {
    const next = new Set(selectedImageIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedImageIds = next;
  }

  function selectAllVisibleImages() {
    selectedImageIds = allVisibleSelected ? new Set() : new Set(visibleImageIds);
  }

  function clearSelectedImages() {
    selectedImageIds = new Set();
  }

  async function markSelectedImagesNsfw() {
    const ids = [...selectedImageIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => updateImage(id, { isNsfw: true })));
      clearSelectedImages();
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  async function deleteSelectedImages() {
    const ids = [...selectedImageIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => deleteImage(id)));
      clearSelectedImages();
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/images?${qs}` : "/images", { keepFocus: true, noScroll: true });
  }

  const loadedStart = $derived((data.page - 1) * data.pageSize);
  const loadedEnd = $derived(Math.min(loadedTotal, loadedStart + loadedImages.length));
  const hasMoreImages = $derived(loadedEnd < loadedTotal);
  const nextPageNumber = $derived(
    Math.floor((loadedStart + loadedImages.length) / data.pageSize) + 1,
  );

  $effect(() => {
    const nextSignature = `${data.page}:${data.total}:${data.images.map((img) => img.id).join("|")}`;
    if (nextSignature === dataSignature) return;
    dataSignature = nextSignature;
    loadedImages = data.images;
    loadedTotal = data.total;
    loadingMore = false;
    loadMoreError = null;
    selectedImageIds = new Set(
      [...selectedImageIds].filter((id) =>
        data.images.some((image) => image.id === id),
      ),
    );
  });

  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/images?${qs}` : "/images";
  }

  function numericParam(name: string): number | undefined {
    const raw = page.url.searchParams.get(name);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  async function loadMoreImages() {
    if (loadingMore || !hasMoreImages) return;
    loadingMore = true;
    loadMoreError = null;
    const offset = loadedStart + loadedImages.length;

    try {
      const response = await fetchMoreImages({
        search: data.search || undefined,
        sort: data.sort,
        order: data.order,
        gallery: page.url.searchParams.get("gallery") ?? undefined,
        studio: page.url.searchParams.get("studio") ?? undefined,
        tag: page.url.searchParams.getAll("tag"),
        performer: page.url.searchParams.getAll("performer"),
        ratingMin: numericParam("ratingMin"),
        ratingMax: numericParam("ratingMax"),
        dateFrom: page.url.searchParams.get("dateFrom") ?? undefined,
        dateTo: page.url.searchParams.get("dateTo") ?? undefined,
        resolution: page.url.searchParams.get("resolution") ?? undefined,
        organized: page.url.searchParams.get("organized") ?? undefined,
        nsfw: data.nsfwMode,
        limit: data.pageSize,
        offset,
      });
      const merged = mergeUniquePage({
        current: loadedImages,
        incoming: response.images,
        loadedStart,
        total: response.total,
      });
      loadedImages = merged.items;
      loadedTotal = merged.total;
    } catch {
      loadMoreError = "Could not load more images.";
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
        <ImageIcon class="h-5 w-5 text-text-accent" />
        Images
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse images in your library</p>
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
    searchPlaceholder="Search images..."
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
          min: 3,
          max: 14,
          onChange: (n) => viewPrefs.update({ cols: n }),
          label: "Thumbnail size",
        }
      : undefined}
  />

  {#if viewMode === "list"}
    <BulkActionBar
      selectedCount={selectedImageIds.size}
      visibleCount={visibleImageIds.length}
      allSelected={allVisibleSelected}
      itemLabel="images"
      busy={bulkBusy}
      onSelectAll={selectAllVisibleImages}
      onClear={clearSelectedImages}
      onMarkNsfw={markSelectedImagesNsfw}
      onDelete={deleteSelectedImages}
    />
  {/if}

  {#if loadedImages.length === 0}
    <div class="surface-panel p-8 text-center">
      <ImageIcon class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No images match.</p>
    </div>
  {:else if viewMode === "list"}
    <div class="surface-panel divide-y divide-border-subtle overflow-hidden">
      {#each loadedImages as img (img.id)}
        <div class="flex items-center gap-3 px-3 py-2">
          <Checkbox
            checked={selectedImageIds.has(img.id)}
            onchange={() => toggleSelectedImage(img.id)}
          />
          <a href={`/images/${img.id}`} class="w-14 shrink-0">
            <ImageThumbnail
              title={img.title}
              thumbnailPath={img.thumbnailPath}
              previewPath={img.previewPath}
              isNsfw={img.isNsfw}
              isVideo={img.isVideo}
              width={img.width}
              height={img.height}
              size="list"
              showChips={false}
            />
          </a>
          <a
            href={`/images/${img.id}`}
            class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
          >
            {img.title}
          </a>
          {#if img.width && img.height}
            <span class="hidden text-[0.68rem] text-text-muted sm:inline">
              {img.width}x{img.height}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
      {#each loadedImages as img (img.id)}
        <a
          href={`/images/${img.id}`}
          class="block hover:ring-1 hover:ring-border-accent transition-all duration-fast"
          title={img.title}
        >
          <ImageThumbnail
            title={img.title}
            thumbnailPath={img.thumbnailPath}
            previewPath={img.previewPath}
            isNsfw={img.isNsfw}
            isVideo={img.isVideo}
            width={img.width}
            height={img.height}
            size="grid"
          />
        </a>
      {/each}
    </div>
  {/if}

  <InfiniteLoadTrigger
    hasMore={hasMoreImages}
    loading={loadingMore}
    error={loadMoreError}
    nextHref={pageHref(nextPageNumber)}
    label="Load more images"
    onLoad={loadMoreImages}
  />
</div>

<style>
  .thumb-grid {
    display: grid;
    grid-template-columns: repeat(max(2, min(var(--col-count, 8), 4)), minmax(0, 1fr));
    gap: 0.375rem;
  }
  @media (min-width: 640px) {
    .thumb-grid {
      grid-template-columns: repeat(max(3, min(var(--col-count, 8), 6)), minmax(0, 1fr));
    }
  }
  @media (min-width: 768px) {
    .thumb-grid {
      grid-template-columns: repeat(max(4, min(var(--col-count, 8), 10)), minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .thumb-grid {
      grid-template-columns: repeat(var(--col-count, 8), minmax(0, 1fr));
    }
  }
</style>
