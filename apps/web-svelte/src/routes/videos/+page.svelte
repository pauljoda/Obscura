<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { Film } from "@lucide/svelte";
  import BulkActionBar from "$lib/components/BulkActionBar.svelte";
  import FilterBar, {
    type AvailableItem,
  } from "$lib/components/FilterBar.svelte";
  import InfiniteLoadTrigger from "$lib/components/InfiniteLoadTrigger.svelte";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import {
    deleteVideo,
    fetchVideoCards as fetchMoreVideoCards,
    updateVideo,
  } from "$lib/api/videos";
  import { videoListItemToCardData } from "$lib/video-card-data";
  import {
    EXCLUSIVE_FILTER_TYPES,
    VIDEOS_LIST_PREFS_KEY,
    VIDEOS_PRESETS_KEY,
    defaultVideosListPrefs,
    formatFilterValue,
    isDefaultVideosListPrefs,
    videosListPrefsToFetchParams,
    type SortDir,
    type SortOption,
    type ViewMode,
    type VideosListPrefs,
    type VideosListPrefsActiveFilter,
  } from "$lib/prefs/videos-list-prefs";
  import { writeListPrefsAndInvalidate } from "$lib/prefs/ui-list-prefs-writer";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";

  let { data } = $props();

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Video date" },
    { value: "title", label: "Title A-Z" },
    { value: "duration", label: "Duration" },
    { value: "size", label: "File Size" },
    { value: "rating", label: "Rating" },
    { value: "plays", label: "Most Played" },
  ];

  const defaultSortDir: Record<string, SortDir> = {
    recent: "desc",
    title: "asc",
    duration: "desc",
    size: "desc",
    rating: "desc",
    date: "desc",
    plays: "desc",
    episode: "asc",
  };

  // ── Prefs state ────────────────────────────────────────────────
  // Server already read the cookie; we hydrate from `data.prefs` and
  // treat that state as the source of truth. Any change flushes back
  // through the cookie (client-side) and triggers `invalidate("videos")`
  // so the server load function re-runs with the updated cookie.
  // svelte-ignore state_referenced_locally
  let viewMode = $state<ViewMode>(data.prefs.viewMode);
  // svelte-ignore state_referenced_locally
  let sortBy = $state<SortOption>(data.prefs.sortBy);
  // svelte-ignore state_referenced_locally
  let sortDir = $state<SortDir>(data.prefs.sortDir);
  // svelte-ignore state_referenced_locally
  let searchQuery = $state(data.prefs.search);
  // svelte-ignore state_referenced_locally
  let activeFilters = $state<VideosListPrefsActiveFilter[]>(data.prefs.activeFilters);
  // svelte-ignore state_referenced_locally
  let activePresetId = $state<string | null>(data.prefs.activePresetId ?? null);
  // svelte-ignore state_referenced_locally
  let loadedVideos = $state.raw(data.videos);
  // svelte-ignore state_referenced_locally
  let loadedTotal = $state(data.total);
  let loadingMore = $state(false);
  let loadMoreError = $state<string | null>(null);
  let bulkBusy = $state(false);
  let selectedVideoIds = $state.raw(new Set<string>());
  let dataSignature = $state("");

  // Mirror the server-side prefs snapshot in a derived view so the
  // refetch effect below can compare against it without tripping
  // Svelte 5's "referenced locally" warning.
  const serverPrefs = $derived(data.prefs);

  const presetsApi = createServerPresets(VIDEOS_PRESETS_KEY);
  // svelte-ignore state_referenced_locally
  const viewPrefs = createServerPrefs<{ cols: number }>(
    "videos:view",
    { cols: 5 },
    data.viewPrefs,
  );

  onMount(() => {
    void presetsApi.load();
    void viewPrefs.load();
  });

  // ── Prefs writeback + refetch ────────────────────────────────
  // Single source-of-truth effect: whenever any pref changes, write to
  // ui_prefs (DB) and ask SvelteKit to re-run the server load so the
  // listing reflects the new state. The search field is debounced so
  // typing doesn't slam the server; filter/sort changes fire instantly.
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let isInitialized = false;

  $effect(() => {
    // Track every pref so this runs on any change.
    const prefs: VideosListPrefs = {
      viewMode,
      sortBy,
      sortDir,
      search: searchQuery,
      activeFilters,
      activePresetId: activePresetId ?? undefined,
    };

    if (!isInitialized) {
      isInitialized = true;
      return;
    }

    const searchOnly =
      prefs.viewMode === serverPrefs.viewMode &&
      prefs.sortBy === serverPrefs.sortBy &&
      prefs.sortDir === serverPrefs.sortDir &&
      JSON.stringify(prefs.activeFilters) === JSON.stringify(serverPrefs.activeFilters) &&
      (prefs.activePresetId ?? null) === (serverPrefs.activePresetId ?? null) &&
      prefs.search !== serverPrefs.search;

    const flush = () => {
      void writeListPrefsAndInvalidate(VIDEOS_LIST_PREFS_KEY, prefs, "videos");
    };

    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    if (searchOnly) {
      searchTimer = setTimeout(flush, 300);
    } else {
      flush();
    }
  });

  // ── Handlers ───────────────────────────────────────────────────
  function onSearchChange(q: string) {
    searchQuery = q;
  }

  function onSortChange(sort: string, dir?: SortDir) {
    sortBy = sort as SortOption;
    sortDir = dir ?? defaultSortDir[sort] ?? sortDir;
    activePresetId = null;
  }

  function onViewModeChange(v: ViewMode) {
    viewMode = v;
    activePresetId = null;
  }

  function onAddFilter(type: string, label: string, value: string) {
    activePresetId = null;
    if (EXCLUSIVE_FILTER_TYPES.has(type)) {
      const already = activeFilters.some((f) => f.type === type && f.value === value);
      const withoutType = activeFilters.filter((f) => f.type !== type);
      activeFilters = already ? withoutType : [...withoutType, { type, label, value }];
    } else {
      const already = activeFilters.some((f) => f.type === type && f.value === value);
      activeFilters = already
        ? activeFilters.filter((f) => !(f.type === type && f.value === value))
        : [...activeFilters, { type, label, value }];
    }
    // Filter changes mean page 1 again.
    resetPage();
  }

  function onRemoveFilter(index: number) {
    activePresetId = null;
    activeFilters = activeFilters.filter((_, i) => i !== index);
    resetPage();
  }

  function onClearFiltersAndSort() {
    const d = defaultVideosListPrefs();
    viewMode = d.viewMode;
    sortBy = d.sortBy;
    sortDir = d.sortDir;
    searchQuery = d.search;
    activeFilters = d.activeFilters;
    activePresetId = null;
    resetPage();
  }

  function resetPage() {
    if (page.url.searchParams.has("page")) {
      const params = new URLSearchParams(page.url.searchParams);
      params.delete("page");
      const qs = params.toString();
      void goto(qs ? `/videos?${qs}` : "/videos", {
        keepFocus: true,
        noScroll: true,
        replaceState: true,
      });
    }
  }

  function onApplyPreset(preset: FilterPreset) {
    if (activePresetId === preset.id) {
      const d = defaultVideosListPrefs();
      activeFilters = d.activeFilters;
      sortBy = d.sortBy;
      sortDir = d.sortDir;
      activePresetId = null;
    } else {
      activeFilters = preset.filters.map((f) => ({ ...f }));
      sortBy = preset.sortBy as SortOption;
      sortDir = preset.sortDir;
      activePresetId = preset.id;
    }
    resetPage();
  }

  function onSavePreset(name: string) {
    const preset: FilterPreset = {
      id: crypto.randomUUID(),
      name,
      filters: activeFilters.map((f) => ({ ...f })),
      sortBy,
      sortDir,
    };
    presetsApi.save([...presetsApi.presets, preset]);
    activePresetId = preset.id;
  }

  function onOverwritePreset(id: string) {
    presetsApi.save(
      presetsApi.presets.map((p) =>
        p.id === id
          ? { ...p, filters: activeFilters.map((f) => ({ ...f })), sortBy, sortDir }
          : p,
      ),
    );
  }

  function onDeletePreset(id: string) {
    presetsApi.save(presetsApi.presets.filter((p) => p.id !== id));
    if (activePresetId === id) activePresetId = null;
  }

  // ── Derived values ────────────────────────────────────────────
  const totalPages = $derived(Math.max(1, Math.ceil(loadedTotal / data.pageSize)));
  const loadedStart = $derived((data.page - 1) * data.pageSize);
  const loadedEnd = $derived(Math.min(loadedTotal, loadedStart + loadedVideos.length));
  const hasMoreVideos = $derived(loadedEnd < loadedTotal);
  const nextPageNumber = $derived(
    Math.floor((loadedStart + loadedVideos.length) / data.pageSize) + 1,
  );
  const visibleVideoIds = $derived(loadedVideos.map((video) => video.id));
  const allVisibleSelected = $derived(
    visibleVideoIds.length > 0 && visibleVideoIds.every((id) => selectedVideoIds.has(id)),
  );

  $effect(() => {
    const nextSignature = `${data.page}:${data.total}:${data.videos.map((v) => v.id).join("|")}`;
    if (nextSignature === dataSignature) return;
    dataSignature = nextSignature;
    loadedVideos = data.videos;
    loadedTotal = data.total;
    loadingMore = false;
    loadMoreError = null;
    selectedVideoIds = new Set(
      [...selectedVideoIds].filter((id) => data.videos.some((video) => video.id === id)),
    );
  });

  const canClearFiltersAndSort = $derived(
    !isDefaultVideosListPrefs({
      viewMode,
      sortBy,
      sortDir,
      search: searchQuery,
      activeFilters,
      activePresetId: activePresetId ?? undefined,
    }),
  );

  const displayFilters = $derived(
    activeFilters.map((f, i) => ({
      type: f.type,
      label: f.label,
      value: formatFilterValue(f, { studios: studiosList }),
      index: i,
    })),
  );

  let studiosList = $state<AvailableItem[]>([]);
  let tagsList = $state<AvailableItem[]>([]);
  let performersList = $state<AvailableItem[]>([]);

  // Streamed filter-panel data arrives as promises. Adopt on resolve.
  $effect(() => {
    void data.streamed.studios.then((r) => {
      studiosList = r.map((s) => ({
        id: s.id,
        name: s.name,
        videoCount: s.videoCount,
        isNsfw: s.isNsfw,
      }));
    });
  });
  $effect(() => {
    void data.streamed.tags.then((r) => {
      tagsList = r.map((t) => ({
        id: t.id,
        name: t.name,
        videoCount: t.videoCount,
        isNsfw: t.isNsfw,
      }));
    });
  });
  $effect(() => {
    void data.streamed.performers.then((r) => {
      performersList = r.map((p) => ({
        id: p.id,
        name: p.name,
        videoCount: p.videoCount,
        isNsfw: p.isNsfw,
      }));
    });
  });

  function pageHref(nextPage: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/videos?${qs}` : "/videos";
  }

  async function loadMoreVideos() {
    if (loadingMore || !hasMoreVideos) return;
    loadingMore = true;
    loadMoreError = null;
    const offset = loadedStart + loadedVideos.length;
    const seasonRaw = page.url.searchParams.get("season");
    const seasonNumber =
      seasonRaw != null && /^\d+$/.test(seasonRaw) ? seasonRaw : undefined;

    try {
      const response = await fetchMoreVideoCards({
        ...videosListPrefsToFetchParams(
          {
            viewMode,
            sortBy,
            sortDir,
            search: searchQuery,
            activeFilters,
            activePresetId: activePresetId ?? undefined,
          },
          data.initialNsfwMode,
        ),
        seasonNumber,
        limit: data.pageSize,
        offset,
      });
      const existing = new Set(loadedVideos.map((video) => video.id));
      const nextVideos = response.videos.filter((video) => !existing.has(video.id));
      loadedVideos = [...loadedVideos, ...nextVideos];
      loadedTotal = response.videos.length === 0 ? loadedStart + loadedVideos.length : response.total;
    } catch {
      loadMoreError = "Could not load more videos.";
    } finally {
      loadingMore = false;
    }
  }

  function toggleSelectedVideo(id: string) {
    const next = new Set(selectedVideoIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedVideoIds = next;
  }

  function selectAllVisibleVideos() {
    selectedVideoIds = allVisibleSelected ? new Set() : new Set(visibleVideoIds);
  }

  function clearSelectedVideos() {
    selectedVideoIds = new Set();
  }

  async function markSelectedVideosNsfw() {
    const ids = [...selectedVideoIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => updateVideo(id, { isNsfw: true })));
      clearSelectedVideos();
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  async function deleteSelectedVideos() {
    const ids = [...selectedVideoIds];
    if (ids.length === 0 || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => deleteVideo(id)));
      const idSet = new Set(ids);
      loadedVideos = loadedVideos.filter((video) => !idSet.has(video.id));
      loadedTotal = Math.max(0, loadedTotal - ids.length);
      clearSelectedVideos();
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
        <Film class="h-5 w-5 text-text-accent" />
        Videos
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">
        Browse and manage your media library
      </p>
    </div>
    <span class="mt-1 text-mono-sm text-text-disabled">
      {loadedTotal.toLocaleString()} total
    </span>
  </div>

  <FilterBar
    viewMode={viewMode === "series" ? "grid" : viewMode}
    {onViewModeChange}
    {sortBy}
    {sortDir}
    {sortOptions}
    {onSortChange}
    searchQuery={searchQuery}
    {onSearchChange}
    activeFilters={displayFilters}
    rawActiveFilters={activeFilters}
    {onAddFilter}
    {onRemoveFilter}
    {onClearFiltersAndSort}
    {canClearFiltersAndSort}
    availableStudios={studiosList}
    availableTags={tagsList}
    availablePerformers={performersList}
    presets={presetsApi.presets}
    {activePresetId}
    {onApplyPreset}
    {onSavePreset}
    {onOverwritePreset}
    {onDeletePreset}
    {defaultSortDir}
    searchPlaceholder="Search videos..."
    thumbSize={viewMode !== "list"
      ? {
          value: viewPrefs.current.cols,
          min: 2,
          max: 8,
          onChange: (n) => viewPrefs.update({ cols: n }),
          label: "Video card size",
        }
      : undefined}
  />

  {#if viewMode === "list"}
    <BulkActionBar
      selectedCount={selectedVideoIds.size}
      visibleCount={visibleVideoIds.length}
      allSelected={allVisibleSelected}
      itemLabel="videos"
      busy={bulkBusy}
      onSelectAll={selectAllVisibleVideos}
      onClear={clearSelectedVideos}
      onMarkNsfw={markSelectedVideosNsfw}
      onDelete={deleteSelectedVideos}
    />
  {/if}

  {#if loadedVideos.length === 0}
    <div class="surface-panel p-8 text-center">
      <Film class="mx-auto mb-3 h-10 w-10 text-text-disabled" />
      <p class="text-body text-text-muted">No videos match those filters.</p>
    </div>
  {:else if viewMode === "list"}
    <div class="space-y-1.5">
      {#each loadedVideos as video, index (video.id)}
        <VideoCard
          video={videoListItemToCardData(video, "/videos")}
          variant="list"
          index={index}
          selected={selectedVideoIds.has(video.id)}
          onToggleSelect={toggleSelectedVideo}
        />
      {/each}
    </div>
  {:else}
    <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
      {#each loadedVideos as video, index (video.id)}
        <VideoCard
          video={videoListItemToCardData(video, "/videos")}
          variant="grid"
          index={index}
          imageLoading={index < 6 ? "eager" : "lazy"}
        />
      {/each}
    </div>
  {/if}

  {#if totalPages > 1}
    <nav class="flex items-center justify-center gap-2 border-t border-border-subtle pt-4">
      {#if data.page > 1}
        <a
          href={pageHref(data.page - 1)}
          class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary"
        >
          ← Prev
        </a>
      {/if}
      <span class="text-body-sm text-text-muted">
        Showing {loadedEnd.toLocaleString()} of {loadedTotal.toLocaleString()}
      </span>
      {#if data.page < totalPages}
        <a
          href={pageHref(nextPageNumber)}
          class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary"
        >
          Next →
        </a>
      {/if}
    </nav>
  {/if}

  <InfiniteLoadTrigger
    hasMore={hasMoreVideos}
    loading={loadingMore}
    error={loadMoreError}
    nextHref={pageHref(nextPageNumber)}
    label="Load more videos"
    onLoad={loadMoreVideos}
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
