<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Film } from "@lucide/svelte";
  import FilterBar, {
    type SortDir,
    type ViewMode,
    type ActiveFilter,
  } from "$lib/components/FilterBar.svelte";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";
  import type { FilterPreset } from "$lib/components/FilterPresetDropdown.svelte";
  import { onMount } from "svelte";

  let { data } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Video Date" },
    { value: "title", label: "Title A–Z" },
    { value: "duration", label: "Duration" },
    { value: "size", label: "File Size" },
    { value: "rating", label: "Rating" },
    { value: "plays", label: "Most Played" },
    { value: "episode", label: "Episode Order" },
  ];

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/videos?${qs}` : "/videos", { keepFocus: true, noScroll: true });
  }

  function onSearchChange(q: string) {
    updateUrl({ search: q || null });
  }

  function onSortChange(sort: string, dir?: SortDir) {
    updateUrl({ sort, order: dir ?? data.order });
  }

  function onViewModeChange(v: ViewMode) {
    updateUrl({ view: v === "grid" ? null : v });
  }

  // Filter state driven by URL params. Supports the same keys as the
  // React /videos page so saved bookmarks round-trip.
  const FILTER_KEYS = [
    "resolution",
    "codec",
    "ratingMin",
    "studio",
    "performer",
    "tag",
    "hasSubtitles",
    "interactive",
  ] as const;
  type FilterKey = (typeof FILTER_KEYS)[number];

  const activeFilters = $derived<ActiveFilter[]>(
    FILTER_KEYS.flatMap((key) => {
      const raw = page.url.searchParams.getAll(key);
      return raw.map((value) => ({
        label: filterLabel(key),
        value,
        type: key,
      }));
    }),
  );

  function filterLabel(key: FilterKey): string {
    switch (key) {
      case "resolution":
        return "Resolution";
      case "codec":
        return "Codec";
      case "ratingMin":
        return "Min Rating";
      case "studio":
        return "Studio";
      case "performer":
        return "Performer";
      case "tag":
        return "Tag";
      case "hasSubtitles":
        return "Subtitles";
      case "interactive":
        return "Interactive";
    }
  }

  function onAddFilter(type: string, _label: string, value: string) {
    const params = new URLSearchParams(page.url.searchParams);
    // Single-value filters — replace.
    if (type === "ratingMin" || type === "hasSubtitles" || type === "interactive") {
      params.set(type, value);
    } else {
      // Multi-value filters — append if not present.
      const existing = params.getAll(type);
      if (!existing.includes(value)) params.append(type, value);
    }
    params.delete("page");
    void goto(`/videos?${params.toString()}`, { keepFocus: true, noScroll: true });
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
    void goto(qs ? `/videos?${qs}` : "/videos", { keepFocus: true, noScroll: true });
  }

  function onClearFiltersAndSort() {
    void goto("/videos", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    activeFilters.length > 0 || data.sort !== "recent" || data.order !== "desc" || !!data.search,
  );

  // ── Filter presets ─────────────────────────────────────────────
  // Matches the React app: localStorage-backed, keyed per list route.
  // The preset snapshot captures the full query-string so applying a
  // preset restores search / sort / filters in one shot.
  const PRESETS_KEY = "obscura:filter-presets:videos";

  let presets = $state<FilterPreset[]>([]);
  let activePresetId = $state<string | null>(null);

  onMount(() => {
    try {
      const raw = window.localStorage.getItem(PRESETS_KEY);
      if (raw) presets = JSON.parse(raw) as FilterPreset[];
    } catch {
      // ignore corrupt storage
    }
  });

  function persistPresets() {
    try {
      window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch {
      // ignore quota errors
    }
  }

  function snapshotQuery(): string {
    return page.url.searchParams.toString();
  }

  function onApplyPreset(preset: FilterPreset) {
    activePresetId = preset.id;
    const query = typeof preset.query === "string" ? preset.query : "";
    void goto(query ? `/videos?${query}` : "/videos", {
      keepFocus: true,
      noScroll: true,
    });
  }

  function onSavePreset(name: string) {
    const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const preset: FilterPreset = { id, name, query: snapshotQuery() };
    presets = [...presets, preset];
    activePresetId = id;
    persistPresets();
  }

  function onOverwritePreset(id: string) {
    presets = presets.map((p) => (p.id === id ? { ...p, query: snapshotQuery() } : p));
    activePresetId = id;
    persistPresets();
  }

  function onDeletePreset(id: string) {
    presets = presets.filter((p) => p.id !== id);
    if (activePresetId === id) activePresetId = null;
    persistPresets();
  }

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/videos?${qs}` : "/videos";
  }
</script>

<svelte:head>
  <title>Videos — Obscura</title>
</svelte:head>

<div class="space-y-4">
  <header class="flex items-center justify-between gap-4 flex-wrap">
    <div>
      <p class="text-kicker text-text-muted">Browse</p>
      <h1 class="text-h1 text-text-primary">Videos</h1>
      <p class="text-body text-text-muted mt-1">
        {data.total.toLocaleString()} video{data.total === 1 ? "" : "s"}
        {#if data.series}
          <span class="text-text-disabled">· filtered by series</span>
        {/if}
      </p>
    </div>
  </header>

  <FilterBar
    viewMode={data.view}
    {onViewModeChange}
    showSeriesView
    sortBy={data.sort}
    sortDir={data.order}
    {sortOptions}
    {onSortChange}
    searchQuery={data.search}
    {onSearchChange}
    {activeFilters}
    {onAddFilter}
    {onRemoveFilter}
    {onClearFiltersAndSort}
    {canClearFiltersAndSort}
    {presets}
    {activePresetId}
    {onApplyPreset}
    {onSavePreset}
    {onOverwritePreset}
    {onDeletePreset}
  />

  {#if data.videos.length === 0}
    <div class="surface-panel p-8 text-center">
      <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No videos match those filters.</p>
    </div>
  {:else if data.view === "list"}
    <div class="space-y-1.5">
      {#each data.videos as v, i (v.id)}
        <VideoCard video={videoListItemToCardData(v, "/videos")} variant="list" index={i} />
      {/each}
    </div>
  {:else}
    <div
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
    >
      {#each data.videos as v, i (v.id)}
        <VideoCard
          video={videoListItemToCardData(v, "/videos")}
          variant="grid"
          index={i}
          imageLoading={i < 6 ? "eager" : "lazy"}
        />
      {/each}
    </div>
  {/if}

  {#if totalPages > 1}
    <nav class="flex items-center justify-center gap-2 pt-4 border-t border-border-subtle">
      {#if data.page > 1}
        <a
          href={pageHref(data.page - 1)}
          class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary"
        >
          ← Prev
        </a>
      {/if}
      <span class="text-body-sm text-text-muted">
        Page {data.page} of {totalPages}
      </span>
      {#if data.page < totalPages}
        <a
          href={pageHref(data.page + 1)}
          class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary"
        >
          Next →
        </a>
      {/if}
    </nav>
  {/if}
</div>
