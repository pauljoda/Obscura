<script lang="ts">
  import { onMount } from "svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { Film, FolderOpen, HardDrive, Pencil, Users } from "@lucide/svelte";
  import { Checkbox } from "@obscura/ui-svelte";
  import BulkActionBar from "$lib/components/BulkActionBar.svelte";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import FilterBar, {
    type AvailableItem,
    type FilterSectionKey,
    type ViewMode,
  } from "$lib/components/FilterBar.svelte";
  import InfiniteLoadTrigger from "$lib/v1/media-surface/pagination/InfiniteLoadTriggerV1.svelte";
  import SeriesCard from "$lib/components/SeriesCard.svelte";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import HierarchyShell from "$lib/components/shared/HierarchyShell.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import HierarchyBreadcrumbs from "$lib/components/shared/HierarchyBreadcrumbs.svelte";
  import IdentifyButton from "$lib/components/IdentifyButton.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import InlineRating from "$lib/components/InlineRating.svelte";
  import NsfwTagLabel from "$lib/components/nsfw/NsfwTagLabel.svelte";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";
  import VideoSeriesEdit from "$lib/components/VideoSeriesEdit.svelte";
  import { entityTerms, formatVideoCount } from "$lib/terminology";
  import { toApiUrl } from "$lib/v1/api/core-v1";
  import {
    deleteVideo,
    fetchSeries as fetchMoreSeriesItems,
    fetchVideoCards as fetchMoreVideoCards,
    updateSeries,
    updateVideo,
  } from "$lib/v1/api/videos-v1";
  import { videoListItemToCardData } from "$lib/video-card-data";
  import {
    detectUiPrefsFormFactor,
    formFactorUiPrefKey,
  } from "$lib/prefs/form-factor-prefs";
  import { writeListPrefsAndInvalidate } from "$lib/prefs/ui-list-prefs-writer";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";
  import { useAppChrome, type AppBreadcrumb } from "$lib/stores/app-chrome.svelte";
  import {
    SERIES_EXCLUSIVE_FILTER_TYPES,
    SERIES_LIST_PREFS_KEY,
    SERIES_PRESETS_KEY,
    defaultSeriesListPrefs,
    formatSeriesFilterValue,
    isDefaultSeriesListPrefs,
    seriesListPrefsToFetchParams,
    type SeriesListPrefs,
    type SeriesListPrefsActiveFilter,
    type SeriesSortOption,
    type SortDir,
  } from "$lib/prefs/series-list-prefs";
  import {
    applySeriesPageMerge,
    getSeriesLoadedWindow,
    seriesPageHref,
  } from "./series-page-pagination";
  import {
    getSelectionState,
    selectAllVisibleIds,
    toggleSelectedId,
  } from "./series-page-selection";

  let { data } = $props();
  const appChrome = useAppChrome();
  const viewPrefsFormFactor = detectUiPrefsFormFactor();

  const videoSortOptions = [
    { value: "episode", label: "Episode order" },
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Video date" },
    { value: "title", label: "Title A-Z" },
    { value: "duration", label: "Duration" },
    { value: "size", label: "File Size" },
    { value: "rating", label: "Rating" },
    { value: "plays", label: "Most Played" },
    { value: "randomized", label: "Randomized" },
  ];
  const seriesSortOptions: { value: SeriesSortOption; label: string }[] = [
    { value: "title", label: "Title A-Z" },
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Series date" },
    { value: "rating", label: "Rating" },
    { value: "videos", label: "Video count" },
    { value: "randomized", label: "Randomized" },
  ];
  const defaultSeriesSortDir: Record<string, SortDir> = {
    title: "asc",
    recent: "desc",
    date: "desc",
    rating: "desc",
    videos: "desc",
    randomized: "asc",
  };
  const seriesFilterSections: FilterSectionKey[] = [
    "rating",
    "date",
    "libraryFlags",
    "tags",
    "performers",
    "studios",
  ];

  const currentPath = $derived(`${page.url.pathname}${page.url.search}`);
  const usesRootPrefs = $derived(!data.activeSeries);
  const showsVideos = $derived(
    Boolean(
      data.activeSeries &&
        (data.activeSeries.renderingMode === "flat" ||
          data.activeSeasonNumber != null),
    ),
  );
  const listTotal = $derived(usesRootPrefs ? data.seriesTotal : data.total);
  // svelte-ignore state_referenced_locally
  let loadedVideos = $state.raw(data.videos);
  // svelte-ignore state_referenced_locally
  let loadedSeries = $state.raw(data.series);
  // svelte-ignore state_referenced_locally
  let loadedTotal = $state(listTotal);
  let loadingMore = $state(false);
  let loadMoreError = $state<string | null>(null);
  // svelte-ignore state_referenced_locally
  let randomSortSeed = $state(data.randomSeed);
  let bulkBusy = $state(false);
  let deleteDialogOpen = $state(false);
  let selectedItemIds = $state.raw(new Set<string>());
  let dataSignature = $state("");
  let editingSeries = $state(false);
  let overrideSeriesRating = $state<number | null | undefined>(undefined);
  const activeSeries = $derived(
    data.activeSeries && overrideSeriesRating !== undefined
      ? { ...data.activeSeries, rating: overrideSeriesRating }
      : data.activeSeries,
  );
  const loadedStart = $derived((data.page - 1) * data.pageSize);
  const loadedItemCount = $derived(usesRootPrefs ? loadedSeries.length : loadedVideos.length);
  const loadedWindow = $derived(
    getSeriesLoadedWindow({
      loadedStart,
      itemCount: loadedItemCount,
      total: loadedTotal,
      pageSize: data.pageSize,
    }),
  );
  const hasMoreItems = $derived((usesRootPrefs || showsVideos) && loadedWindow.hasMore);
  const nextPageNumber = $derived(loadedWindow.nextPageNumber);
  // svelte-ignore state_referenced_locally
  let seriesViewMode = $state<ViewMode>(data.prefs.viewMode);
  const currentViewMode = $derived(usesRootPrefs ? seriesViewMode : data.view);
  const selectionKind = $derived(
    currentViewMode === "list"
      ? (usesRootPrefs ? "series" : showsVideos ? "videos" : null)
      : null,
  );
  const visibleSelectionIds = $derived(
    selectionKind === "series"
      ? loadedSeries.map((series) => series.id)
      : selectionKind === "videos"
        ? loadedVideos.map((video) => video.id)
        : [],
  );
  const selectionState = $derived(
    getSelectionState(selectedItemIds, visibleSelectionIds),
  );
  const allVisibleSelected = $derived(selectionState.allVisibleSelected);
  const uploadTarget = $derived(
    data.activeSeries
      ? {
          kind: "video" as const,
          videoSeriesId: data.activeSeries.id,
          seasonNumber: data.activeSeasonNumber,
        }
      : { kind: "video" as const },
  );

  // svelte-ignore state_referenced_locally
  let seriesSortBy = $state<SeriesSortOption>(data.prefs.sortBy);
  // svelte-ignore state_referenced_locally
  let seriesSortDir = $state<SortDir>(data.prefs.sortDir);
  // svelte-ignore state_referenced_locally
  let seriesSearchQuery = $state(data.prefs.search);
  // svelte-ignore state_referenced_locally
  let seriesActiveFilters = $state<SeriesListPrefsActiveFilter[]>(
    data.prefs.activeFilters,
  );
  // svelte-ignore state_referenced_locally
  let seriesActivePresetId = $state<string | null>(data.prefs.activePresetId ?? null);
  const serverPrefs = $derived(data.prefs);
  const presetsApi = createServerPresets(SERIES_PRESETS_KEY);
  // svelte-ignore state_referenced_locally
  const viewPrefs = createServerPrefs<{ cols: number }>(
    formFactorUiPrefKey("series:view", viewPrefsFormFactor),
    { cols: 2 },
    data.viewPrefsByFormFactor?.[viewPrefsFormFactor] ?? data.viewPrefs,
  );
  let studiosList = $state<AvailableItem[]>([]);
  let tagsList = $state<AvailableItem[]>([]);
  let performersList = $state<AvailableItem[]>([]);

  onMount(() => {
    void presetsApi.load();
    void viewPrefs.load();
  });

  $effect(() => {
    if (!data.activeSeries) return appChrome.setBreadcrumbs([]);
    const crumbs: AppBreadcrumb[] = [
      { label: entityTerms.series, href: "/series" },
      ...data.activeSeries.breadcrumbs.map((crumb) => ({
        label: crumb.displayTitle,
        href: `/series?series=${crumb.id}`,
      })),
      { label: data.activeSeries.displayTitle },
    ];
    return appChrome.setBreadcrumbs(crumbs);
  });

  const seriesDisplayFilters = $derived(
    seriesActiveFilters.map((f, i) => ({
      type: f.type,
      label: f.label,
      value: formatSeriesFilterValue(f, { studios: studiosList }),
      index: i,
    })),
  );

  const canClearSeriesFiltersAndSort = $derived(
    !isDefaultSeriesListPrefs({
      viewMode: seriesViewMode === "list" ? "list" : "grid",
      sortBy: seriesSortBy,
      sortDir: seriesSortDir,
      search: seriesSearchQuery,
      activeFilters: seriesActiveFilters,
      activePresetId: seriesActivePresetId ?? undefined,
    }),
  );
  const canClearFiltersAndSort = $derived(
    usesRootPrefs
      ? canClearSeriesFiltersAndSort
      : Boolean(data.search) ||
          (showsVideos &&
            (data.sort !== "episode" ||
              data.order !== "asc" ||
              data.view !== "grid")),
  );

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let isInitialized = false;

  $effect(() => {
    const prefs: SeriesListPrefs = {
      viewMode: seriesViewMode === "list" ? "list" : "grid",
      sortBy: seriesSortBy,
      sortDir: seriesSortDir,
      search: seriesSearchQuery,
      activeFilters: seriesActiveFilters,
      activePresetId: seriesActivePresetId ?? undefined,
    };

    if (!usesRootPrefs) return;
    if (!isInitialized) {
      isInitialized = true;
      return;
    }

    const searchOnly =
      prefs.sortBy === serverPrefs.sortBy &&
      prefs.sortDir === serverPrefs.sortDir &&
      prefs.viewMode === serverPrefs.viewMode &&
      JSON.stringify(prefs.activeFilters) === JSON.stringify(serverPrefs.activeFilters) &&
      (prefs.activePresetId ?? null) === (serverPrefs.activePresetId ?? null) &&
      prefs.search !== serverPrefs.search;

    const flush = () => {
      void writeListPrefsAndInvalidate(SERIES_LIST_PREFS_KEY, prefs, "video-series");
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

  $effect(() => {
    const nextSignature = [
      data.seriesId ?? "root",
      data.activeSeasonNumber ?? "",
      data.page,
      data.total,
      data.seriesTotal,
      data.videos.map((v) => v.id).join("|"),
      data.series.map((s) => s.id).join("|"),
    ].join(":");
    if (nextSignature === dataSignature) return;
    dataSignature = nextSignature;
    loadedVideos = data.videos;
    loadedSeries = data.series;
    loadedTotal = listTotal;
    randomSortSeed = data.randomSeed;
    loadingMore = false;
    loadMoreError = null;
    selectedItemIds = new Set();
    editingSeries = false;
    overrideSeriesRating = undefined;
  });

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

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/series?${qs}` : "/series", { keepFocus: true, noScroll: true });
  }

  function onSearchChange(q: string) {
    if (usesRootPrefs) {
      seriesSearchQuery = q;
    } else {
      updateUrl({ search: q || null });
    }
  }

  function onSortChange(sort: string, dir?: SortDir) {
    if (usesRootPrefs) {
      if (sort === "randomized") randomSortSeed = createRandomSortSeed();
      seriesSortBy = sort as SeriesSortOption;
      seriesSortDir = dir ?? defaultSeriesSortDir[sort] ?? seriesSortDir;
      seriesActivePresetId = null;
      resetPage();
    } else {
      updateUrl({ sort, order: dir ?? data.order });
    }
  }

  function createRandomSortSeed(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function onViewModeChange(v: ViewMode) {
    if (usesRootPrefs) {
      seriesViewMode = v === "list" ? "list" : "grid";
      seriesActivePresetId = null;
    } else {
      updateUrl({ view: v === "grid" ? null : v });
    }
  }

  function onClearFiltersAndSort() {
    if (usesRootPrefs) {
      const d = defaultSeriesListPrefs();
      seriesViewMode = d.viewMode;
      seriesSortBy = d.sortBy;
      seriesSortDir = d.sortDir;
      seriesSearchQuery = d.search;
      seriesActiveFilters = d.activeFilters;
      seriesActivePresetId = null;
      resetPage();
    } else {
      void goto(data.seriesId ? `/series?series=${data.seriesId}` : "/series", {
        keepFocus: true,
        noScroll: true,
      });
    }
  }

  function resetPage() {
    if (page.url.searchParams.has("page")) {
      const params = new URLSearchParams(page.url.searchParams);
      params.delete("page");
      const qs = params.toString();
      void goto(qs ? `/series?${qs}` : "/series", {
        keepFocus: true,
        noScroll: true,
        replaceState: true,
      });
    }
  }

  function onAddFilter(type: string, label: string, value: string) {
    seriesActivePresetId = null;
    if (SERIES_EXCLUSIVE_FILTER_TYPES.has(type)) {
      const already = seriesActiveFilters.some((f) => f.type === type && f.value === value);
      const withoutType = seriesActiveFilters.filter((f) => f.type !== type);
      seriesActiveFilters = already ? withoutType : [...withoutType, { type, label, value }];
    } else {
      const already = seriesActiveFilters.some((f) => f.type === type && f.value === value);
      seriesActiveFilters = already
        ? seriesActiveFilters.filter((f) => !(f.type === type && f.value === value))
        : [...seriesActiveFilters, { type, label, value }];
    }
    resetPage();
  }

  function onRemoveFilter(index: number) {
    seriesActivePresetId = null;
    seriesActiveFilters = seriesActiveFilters.filter((_, i) => i !== index);
    resetPage();
  }

  function onApplyPreset(preset: FilterPreset) {
    if (seriesActivePresetId === preset.id) {
      const d = defaultSeriesListPrefs();
      seriesActiveFilters = d.activeFilters;
      seriesSortBy = d.sortBy;
      seriesSortDir = d.sortDir;
      seriesActivePresetId = null;
    } else {
      seriesActiveFilters = preset.filters.map((f) => ({ ...f }));
      seriesSortBy = preset.sortBy as SeriesSortOption;
      seriesSortDir = preset.sortDir;
      seriesActivePresetId = preset.id;
    }
    resetPage();
  }

  function onSavePreset(name: string) {
    const preset: FilterPreset = {
      id: crypto.randomUUID(),
      name,
      filters: seriesActiveFilters.map((f) => ({ ...f })),
      sortBy: seriesSortBy,
      sortDir: seriesSortDir,
    };
    presetsApi.save([...presetsApi.presets, preset]);
    seriesActivePresetId = preset.id;
  }

  function onOverwritePreset(id: string) {
    presetsApi.save(
      presetsApi.presets.map((p) =>
        p.id === id
          ? {
              ...p,
              filters: seriesActiveFilters.map((f) => ({ ...f })),
              sortBy: seriesSortBy,
              sortDir: seriesSortDir,
            }
          : p,
      ),
    );
  }

  function onDeletePreset(id: string) {
    presetsApi.save(presetsApi.presets.filter((p) => p.id !== id));
    if (seriesActivePresetId === id) seriesActivePresetId = null;
  }

  function pageHref(nextPage: number): string {
    return seriesPageHref(page.url, nextPage);
  }

  async function loadMoreItems() {
    if (loadingMore || !hasMoreItems) return;
    loadingMore = true;
    loadMoreError = null;
    const offset = loadedStart + loadedItemCount;

    try {
      if (usesRootPrefs) {
        const response = await fetchMoreSeriesItems({
          ...seriesListPrefsToFetchParams(
            {
              viewMode: seriesViewMode === "list" ? "list" : "grid",
              sortBy: seriesSortBy,
              sortDir: seriesSortDir,
              search: seriesSearchQuery,
              activeFilters: seriesActiveFilters,
              activePresetId: seriesActivePresetId ?? undefined,
            },
            data.initialNsfwMode,
          ),
          root: "all",
          randomSeed: seriesSortBy === "randomized" ? randomSortSeed : undefined,
          limit: data.pageSize,
          offset,
        });
        const merged = applySeriesPageMerge({
          current: loadedSeries,
          incoming: response.items,
          loadedStart,
          total: response.total,
        });
        loadedSeries = merged.items;
        loadedTotal = merged.total;
      } else if (showsVideos) {
        const response = await fetchMoreVideoCards({
          search: data.search || undefined,
          sort: data.sort,
          order: data.order,
          randomSeed: data.sort === "randomized" ? randomSortSeed : undefined,
          videoSeriesId: data.seriesId ?? undefined,
          seasonNumber:
            data.activeSeasonNumber != null ? String(data.activeSeasonNumber) : undefined,
          limit: data.pageSize,
          offset,
          nsfw: data.initialNsfwMode,
        });
        const merged = applySeriesPageMerge({
          current: loadedVideos,
          incoming: response.videos,
          loadedStart,
          total: response.total,
        });
        loadedVideos = merged.items;
        loadedTotal = merged.total;
      }
    } catch {
      loadMoreError = "Could not load more items.";
    } finally {
      loadingMore = false;
    }
  }

  function toggleSelectedItem(id: string) {
    selectedItemIds = toggleSelectedId(selectedItemIds, id);
  }

  function selectAllVisibleItems() {
    selectedItemIds = selectAllVisibleIds(
      selectedItemIds,
      visibleSelectionIds,
      allVisibleSelected,
    );
  }

  function clearSelectedItems() {
    selectedItemIds = new Set();
  }

  async function markSelectedItemsNsfw() {
    const ids = [...selectedItemIds];
    if (ids.length === 0 || !selectionKind || bulkBusy) return;
    bulkBusy = true;
    try {
      if (selectionKind === "series") {
        await Promise.all(ids.map((id) => updateSeries(id, { isNsfw: true })));
      } else {
        await Promise.all(ids.map((id) => updateVideo(id, { isNsfw: true })));
      }
      clearSelectedItems();
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  async function refreshSeries(closeEditor = true) {
    await invalidateAll();
    if (closeEditor) editingSeries = false;
  }

  async function handleSeriesRatingSave(next: number | null) {
    if (!data.activeSeries) return;
    const previous = data.activeSeries.rating ?? null;
    overrideSeriesRating = next;
    try {
      await updateSeries(data.activeSeries.id, { rating: next });
    } catch {
      overrideSeriesRating = previous;
      throw new Error("Failed to update rating");
    }
  }

  async function deleteSelectedVideos(deleteFromDisk = false) {
    const ids = [...selectedItemIds];
    if (ids.length === 0 || selectionKind !== "videos" || bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(ids.map((id) => deleteVideo(id, deleteFromDisk)));
      const idSet = new Set(ids);
      loadedVideos = loadedVideos.filter((video) => !idSet.has(video.id));
      loadedTotal = Math.max(0, loadedTotal - ids.length);
      clearSelectedItems();
      await invalidateAll();
    } finally {
      bulkBusy = false;
      deleteDialogOpen = false;
    }
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<UploadDropZone target={uploadTarget}>
<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <FolderOpen class="h-5 w-5 text-text-accent" />
        {entityTerms.series}
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">
        Browse your series hierarchy and drill into seasons or episodes.
      </p>
    </div>
    <ImportButton target={uploadTarget} />
  </div>

  <FilterBar
    viewMode={currentViewMode}
    {onViewModeChange}
    sortBy={usesRootPrefs ? seriesSortBy : data.sort}
    sortDir={usesRootPrefs ? seriesSortDir : data.order}
    sortOptions={usesRootPrefs ? seriesSortOptions : videoSortOptions}
    {onSortChange}
    searchQuery={usesRootPrefs ? seriesSearchQuery : data.search}
    {onSearchChange}
    showViewToggle={usesRootPrefs || showsVideos}
    showSortControls={usesRootPrefs || showsVideos}
    searchPlaceholder={showsVideos
      ? "Search videos in this series..."
      : "Search series..."}
    activeFilters={usesRootPrefs ? seriesDisplayFilters : []}
    rawActiveFilters={usesRootPrefs ? seriesActiveFilters : []}
    onAddFilter={usesRootPrefs ? onAddFilter : undefined}
    onRemoveFilter={usesRootPrefs ? onRemoveFilter : undefined}
    onClearFiltersAndSort={canClearFiltersAndSort ? onClearFiltersAndSort : undefined}
    {canClearFiltersAndSort}
    availableStudios={usesRootPrefs ? studiosList : []}
    availableTags={usesRootPrefs ? tagsList : []}
    availablePerformers={usesRootPrefs ? performersList : []}
    presets={usesRootPrefs ? presetsApi.presets : []}
    activePresetId={usesRootPrefs ? seriesActivePresetId : null}
    onApplyPreset={usesRootPrefs ? onApplyPreset : undefined}
    onSavePreset={usesRootPrefs ? onSavePreset : undefined}
    onOverwritePreset={usesRootPrefs ? onOverwritePreset : undefined}
    onDeletePreset={usesRootPrefs ? onDeletePreset : undefined}
    defaultSortDir={usesRootPrefs ? defaultSeriesSortDir : undefined}
    filterSections={usesRootPrefs ? seriesFilterSections : undefined}
    showInteractiveFilter={!usesRootPrefs}
    thumbSize={currentViewMode !== "list"
      ? {
          value: viewPrefs.current.cols,
          min: 2,
          max: 8,
          onChange: (n) => viewPrefs.update({ cols: n }),
          label: "Series card size",
        }
      : undefined}
  />

  {#if selectionKind}
    <BulkActionBar
      selectedCount={selectedItemIds.size}
      visibleCount={visibleSelectionIds.length}
      allSelected={allVisibleSelected}
      itemLabel={selectionKind === "series" ? entityTerms.series.toLowerCase() : entityTerms.videos.toLowerCase()}
      busy={bulkBusy}
      canDelete={selectionKind === "videos"}
      onSelectAll={selectAllVisibleItems}
      onClear={clearSelectedItems}
      onMarkNsfw={markSelectedItemsNsfw}
      onDelete={selectionKind === "videos"
        ? () => {
            deleteDialogOpen = true;
          }
        : undefined}
    />
  {/if}

  {#if activeSeries}
    {@const series = activeSeries}
    {@const backdrop = toApiUrl(series.backdropImagePath, series.updatedAt)}
    {@const cover = toApiUrl(series.coverImagePath, series.updatedAt)}
    {@const hasHeroImage = Boolean(backdrop || cover)}
    {@const hasPoster = Boolean(cover)}

    <HierarchyShell>
      {#snippet breadcrumbs()}
        <HierarchyBreadcrumbs
          items={[
            { id: "root", title: entityTerms.series, href: "/series" },
            ...series.breadcrumbs.map((crumb) => ({
              id: crumb.id,
              title: crumb.displayTitle,
              href: `/series?series=${crumb.id}`,
            })),
          ]}
        />
      {/snippet}

      {#snippet children()}
          <div
            class={hasHeroImage
              ? "relative min-h-[320px] overflow-hidden border border-border-subtle bg-surface-1 sm:min-h-[360px] lg:min-h-[420px]"
              : "relative min-h-[240px] overflow-hidden border border-border-subtle bg-surface-1 sm:min-h-[260px] lg:min-h-[280px]"}
          >
          {#if backdrop}
            <img
              src={backdrop}
              alt=""
              class="absolute inset-0 h-full w-full object-cover object-center"
            />
          {:else if cover}
            <img
              src={cover}
              alt=""
              class="absolute inset-0 h-full w-full scale-105 object-cover object-center opacity-60 blur-lg"
            />
          {:else}
            <div
              class="absolute inset-0 bg-gradient-to-br from-accent-950/70 via-surface-1 to-surface-bg"
              aria-hidden="true"
            ></div>
          {/if}
          {#if hasHeroImage}
            <div class="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/60 to-bg/20"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-black/10"></div>
          {:else}
            <div
              class="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-[var(--color-surface-bg)]"
              aria-hidden="true"
            ></div>
          {/if}

          <div
            class="relative flex min-h-full w-full flex-col justify-start gap-5 p-4 sm:p-6 lg:flex-row lg:items-start lg:gap-8 lg:p-8"
          >
            {#if cover}
              <div class="relative w-[124px] flex-shrink-0 sm:w-[190px] lg:w-[230px]">
                <img
                  src={cover}
                  alt={series.displayTitle}
                  class="aspect-[2/3] w-full border border-white/15 object-cover shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
                />
              </div>
            {/if}

            <div class="min-w-0 flex-1 lg:max-w-4xl">
              <div class="flex flex-wrap items-center gap-2">
                {#if series.libraryRootLabel}
                  <div class="inline-flex min-w-0 items-center gap-1.5 border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60 backdrop-blur-md">
                    <HardDrive class="h-3 w-3 flex-shrink-0" />
                    <span class="min-w-0 break-words normal-case tracking-normal">{series.libraryRootLabel}</span>
                  </div>
                {/if}
                {#if series.childSeasonCount > 0}
                  <span class="border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60 backdrop-blur-md">
                    {series.childSeasonCount} child {series.childSeasonCount === 1
                      ? entityTerms.seriesSingular.toLowerCase()
                      : entityTerms.series.toLowerCase()}
                  </span>
                {/if}
              </div>

              <h1 class="mt-4 max-w-4xl text-3xl leading-tight font-heading font-semibold text-text-primary sm:text-5xl">
                {series.displayTitle}
              </h1>

              <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.86rem] text-white/70">
                {#if series.studio}
                  <a
                    href={`/studios/${series.studio.id}`}
                    class="font-medium text-text-accent transition-colors hover:text-text-accent-bright"
                  >
                    {series.studio.name}
                  </a>
                {/if}
                {#if series.date}<span>{series.date}</span>{/if}
                <span>{formatVideoCount(series.visibleSfwVideoCount)}</span>
              </div>

              <div class="mt-3">
                <InlineRating
                  value={series.rating}
                  onSave={handleSeriesRatingSave}
                  ariaLabelPrefix="Rate series with"
                />
              </div>

              <div class="mt-5 flex flex-wrap items-center gap-2">
                <IdentifyButton
                  entityKind="video_series"
                  entityId={series.id}
                  title={series.displayTitle}
                  label="Identify Series"
                />
                {#if !editingSeries}
                  <button
                    type="button"
                    onclick={() => (editingSeries = true)}
                    class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                    Edit
                  </button>
                {/if}
              </div>

              {#if series.details}
                <p class="mt-5 max-w-3xl text-[0.95rem] leading-relaxed text-white/80">
                  {series.details}
                </p>
              {/if}

              {#if series.tags.length > 0}
                <div
                  class="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1.5"
                >
                  <span class="text-[0.65rem] uppercase tracking-[0.14em] text-white/50">Tags:</span>
                  {#each series.tags as tag (tag.id)}
                    <a
                      href={`/tags/${encodeURIComponent(tag.name)}`}
                      class="tag-chip tag-chip-default cursor-pointer transition-colors hover:tag-chip-accent"
                    >
                      <NsfwTagLabel isNsfw={tag.isNsfw} text={tag.name} />
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>

        {#if editingSeries}
          <VideoSeriesEdit
            {series}
            onSaved={() => void refreshSeries()}
            onChanged={() => void refreshSeries(false)}
            onCancel={() => (editingSeries = false)}
          />
        {/if}

        {#if series.performers && series.performers.length > 0}
          <div>
            <div class="mb-3 flex items-center justify-between">
              <h4 class="text-kicker">Cast & Crew</h4>
            </div>
            <div class="scrollbar-hidden flex gap-3 overflow-x-auto pb-2">
              {#each series.performers as performer (performer.id)}
                {@const img = toApiUrl(performer.imagePath)}
                <a href={`/performers/${performer.id}`} class="group w-[110px] flex-shrink-0">
                  <div class="aspect-[3/4] w-full overflow-hidden border border-border-subtle bg-surface-2">
                    {#if img}
                      <img
                        src={img}
                        alt={performer.name}
                        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    {:else}
                      <div class="flex h-full w-full items-center justify-center text-text-disabled">
                        <Users class="h-8 w-8" />
                      </div>
                    {/if}
                  </div>
                  <div class="mt-1.5 text-center">
                    <div class="truncate text-[0.72rem] text-text-primary transition-colors group-hover:text-text-accent">
                      {performer.name}
                    </div>
                    {#if performer.character}
                      <div class="mt-0.5 min-h-[2rem] line-clamp-2 text-[0.62rem] leading-tight text-text-muted">
                        {performer.character}
                      </div>
                    {/if}
                  </div>
                </a>
              {/each}
            </div>
          </div>
        {/if}

        {#if data.childSeries.length > 0}
          <HierarchySection title={`Child ${entityTerms.series.toLowerCase()}`}>
            {#snippet children()}
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {#each data.childSeries as child (child.id)}
                  <SeriesCard series={child} href={`/series?series=${child.id}`} compact />
                {/each}
              </div>
            {/snippet}
          </HierarchySection>
        {/if}

        {#if series.renderingMode === "seasons" && series.seasons.length > 0 && data.activeSeasonNumber == null}
          <HierarchySection title="Seasons">
            {#snippet children()}
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {#each series.seasons as season (season.id)}
                  {@const label = season.seasonNumber === 0 ? "Specials" : `Season ${season.seasonNumber}`}
                  {@const poster = toApiUrl(season.posterPath ?? season.previewThumbnailPath)}
                  <a
                    href={`/series?series=${series.id}&season=${season.seasonNumber}`}
                    class="group surface-card overflow-hidden text-left transition-colors duration-fast hover:border-border-accent"
                  >
                    <div class="relative aspect-[2/3] bg-surface-2">
                      {#if poster}
                        <img
                          src={poster}
                          alt={label}
                          class="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                        />
                      {:else}
                        <div class="flex h-full w-full items-center justify-center text-text-disabled">
                          <FolderOpen class="h-8 w-8" />
                        </div>
                      {/if}
                    </div>
                    <div class="space-y-1 px-2.5 py-2">
                      <h3 class="truncate text-[0.82rem] font-medium text-text-primary">{label}</h3>
                      <div class="text-[0.68rem] text-text-muted">
                        {formatVideoCount(season.episodeCount)}
                      </div>
                    </div>
                  </a>
                {/each}
              </div>
            {/snippet}
          </HierarchySection>
        {/if}

        {#if showsVideos}
          <HierarchySection
            title={data.activeSeasonNumber != null
              ? data.activeSeasonNumber === 0
                ? "Specials"
                : `Season ${data.activeSeasonNumber}`
              : entityTerms.videos}
          >
            {#snippet action()}
              {#if data.activeSeasonNumber != null}
                <a
                  href={`/series?series=${series.id}`}
                  class="text-[0.68rem] text-text-accent hover:text-text-accent-bright"
                >
                  ← All seasons
                </a>
              {/if}
            {/snippet}

            {#snippet children()}
              {#if loadedVideos.length === 0}
                <div class="surface-panel p-8 text-center">
                  <Film class="mx-auto mb-3 h-10 w-10 text-text-disabled" />
                  <p class="text-body text-text-muted">
                    No {entityTerms.videos.toLowerCase()} in this {entityTerms.seriesSingular.toLowerCase()}.
                  </p>
                </div>
              {:else if currentViewMode === "list"}
                <div class="space-y-1.5">
                  {#each loadedVideos as video, index (video.id)}
                    <VideoCard
                      video={videoListItemToCardData(video, currentPath)}
                      variant="list"
                      index={index}
                      selected={selectedItemIds.has(video.id)}
                      onToggleSelect={toggleSelectedItem}
                    />
                  {/each}
                </div>
              {:else}
                <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
                  {#each loadedVideos as video, index (video.id)}
                    <VideoCard
                      video={videoListItemToCardData(video, currentPath)}
                      variant="grid"
                      index={index}
                      imageLoading={index < 6 ? "eager" : "lazy"}
                    />
                  {/each}
                </div>
              {/if}
            {/snippet}
          </HierarchySection>
        {/if}
      {/snippet}
    </HierarchyShell>
  {:else}
    <HierarchyShell>
      {#snippet title()}
        <div>
          <h2 class="text-2xl font-semibold text-text-primary">{entityTerms.series}</h2>
          <p class="mt-1 text-[0.78rem] text-text-muted">
            Browse your series hierarchy from disk, then drill into seasons and episodes.
          </p>
        </div>
      {/snippet}

      {#snippet children()}
        {#if loadedSeries.length > 0}
          <HierarchySection title={entityTerms.series}>
            {#snippet children()}
              {#if currentViewMode === "list"}
                <div class="surface-panel divide-y divide-border-subtle overflow-hidden">
                  {#each loadedSeries as series (series.id)}
                    <div class="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={selectedItemIds.has(series.id)}
                        onchange={() => toggleSelectedItem(series.id)}
                      />
                      <a
                        href={`/series?series=${series.id}`}
                        class="min-w-0 flex-1 text-[0.82rem] font-medium text-text-primary hover:text-text-accent"
                      >
                        {series.displayTitle}
                      </a>
                      <span class="text-[0.68rem] text-text-muted">
                        {formatVideoCount(series.visibleSfwVideoCount)}
                      </span>
                      {#if series.isNsfw}
                        <span class="tag-chip tag-chip-default text-[0.6rem]">NSFW</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="thumb-grid" style:--col-count={viewPrefs.current.cols}>
                  {#each loadedSeries as series (series.id)}
                    <SeriesCard series={series} href={`/series?series=${series.id}`} compact />
                  {/each}
                </div>
              {/if}
            {/snippet}
          </HierarchySection>
        {:else}
          <div class="surface-panel p-8 text-center">
            <FolderOpen class="mx-auto mb-3 h-10 w-10 text-text-disabled" />
            <p class="text-body text-text-muted">No series match that search.</p>
          </div>
        {/if}
      {/snippet}
    </HierarchyShell>
  {/if}

  <InfiniteLoadTrigger
    hasMore={hasMoreItems}
    loading={loadingMore}
    error={loadMoreError}
    nextHref={pageHref(nextPageNumber)}
    label="Load more"
    onLoad={loadMoreItems}
  />
</div>
</UploadDropZone>

<ConfirmDeleteDialog
  open={deleteDialogOpen}
  entityType="video"
  count={selectedItemIds.size}
  loading={bulkBusy}
  allowDeleteFromDisk
  onClose={() => (deleteDialogOpen = false)}
  onDeleteFromLibrary={() => void deleteSelectedVideos(false)}
  onDeleteFromDisk={() => void deleteSelectedVideos(true)}
/>


<style>
  .thumb-grid {
    display: grid;
    grid-template-columns: repeat(max(1, min(var(--col-count, 5), 2)), minmax(0, 1fr));
    gap: 0.625rem;
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
