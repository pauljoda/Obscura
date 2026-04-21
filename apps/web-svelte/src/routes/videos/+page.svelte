<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Film, FolderOpen, HardDrive, Users } from "@lucide/svelte";
  import SeriesCard from "$lib/components/SeriesCard.svelte";
  import HierarchyShell from "$lib/components/shared/HierarchyShell.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import HierarchyBreadcrumbs from "$lib/components/shared/HierarchyBreadcrumbs.svelte";
  import IdentifyButton from "$lib/components/IdentifyButton.svelte";
  import { entityTerms, formatVideoCount } from "$lib/terminology";
  import { toApiUrl } from "$lib/api/core";
  import NsfwTagLabel from "$lib/components/NsfwTagLabel.svelte";
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
  </div>

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

  {#if data.view === "series" && data.activeSeries}
    <!-- Drilled-down series detail — Jellyfin-style hero, breadcrumbs,
         child series, seasons, then the series' own videos. -->
    {@const series = data.activeSeries}
    {@const backdrop = toApiUrl(series.backdropImagePath, series.updatedAt)}
    {@const cover = toApiUrl(series.coverImagePath, series.updatedAt)}
    <HierarchyShell>
      {#snippet breadcrumbs()}
        <HierarchyBreadcrumbs
          items={[
            { id: "root", title: entityTerms.videos, href: "/videos?view=series" },
            ...series.breadcrumbs.map((crumb) => ({
              id: crumb.id,
              title: crumb.displayTitle,
              href: `/videos?view=series&series=${crumb.id}`,
            })),
          ]}
        />
      {/snippet}
      {#snippet children()}
        <!-- Hero Header -->
        <div class="relative min-h-[200px] sm:min-h-[280px] overflow-hidden border border-border-subtle">
          {#if backdrop}
            <img src={backdrop} alt="" class="absolute inset-0 h-full w-full object-cover" />
          {:else if cover}
            <img src={cover} alt="" class="absolute inset-0 h-full w-full object-cover blur-lg scale-110 opacity-50" />
          {/if}
          <div class="absolute inset-0 bg-gradient-to-t from-surface-1 via-black/60 to-black/30"></div>

          <div class="relative flex min-h-[200px] sm:min-h-[280px] items-end gap-4 p-4 sm:gap-6 sm:p-6">
            {#if cover}
              <div class="flex-shrink-0 w-[72px] sm:w-[160px]">
                <img
                  src={cover}
                  alt={series.displayTitle}
                  class="aspect-[2/3] w-full object-cover border border-white/10 shadow-lg"
                />
              </div>
            {/if}
            <div class="flex-1 min-w-0">
              {#if series.libraryRootLabel}
                <div class="mb-1 flex min-w-0 items-start gap-1.5 text-[0.68rem] text-white/50">
                  <HardDrive class="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span class="min-w-0 break-words">{series.libraryRootLabel}</span>
                </div>
              {/if}
              <h1 class="mt-1.5 text-2xl sm:text-4xl font-heading font-semibold text-text-primary leading-tight">
                {series.displayTitle}
              </h1>
              <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem] text-white/70">
                {#if series.studio}
                  <a
                    href={`/studios/${series.studio.id}`}
                    class="text-text-accent font-medium hover:text-text-accent-bright transition-colors"
                  >
                    {series.studio.name}
                  </a>
                {/if}
                {#if series.date}<span>{series.date}</span>{/if}
                <span>{formatVideoCount(series.visibleSfwVideoCount)}</span>
                {#if series.childSeasonCount > 0}
                  <span>
                    {series.childSeasonCount} child {series.childSeasonCount === 1
                      ? entityTerms.seriesSingular.toLowerCase()
                      : entityTerms.series.toLowerCase()}
                  </span>
                {/if}
              </div>
              <div class="mt-3">
                <IdentifyButton
                  entityKind="video_series"
                  entityId={series.id}
                  title={series.displayTitle}
                  label="Identify Series"
                />
              </div>
              {#if series.details}
                <p class="mt-3 text-[0.82rem] text-white/70 leading-relaxed max-w-2xl">
                  {series.details}
                </p>
              {/if}
              {#if series.tags.length > 0}
                <div class="mt-3 flex flex-wrap gap-1.5 items-center">
                  <span class="text-[0.65rem] uppercase tracking-[0.14em] text-text-muted">Tags:</span>
                  {#each series.tags as tag (tag.id)}
                    <a
                      href={`/tags/${encodeURIComponent(tag.name)}`}
                      class="tag-chip tag-chip-default hover:tag-chip-accent cursor-pointer transition-colors"
                    >
                      <NsfwTagLabel isNsfw={tag.isNsfw} text={tag.name} />
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Cast & Crew -->
        {#if series.performers && series.performers.length > 0}
          <HierarchySection title="Cast & Crew">
            {#snippet children()}
              <div class="flex gap-3 overflow-x-auto pb-2">
                {#each series.performers as p (p.id)}
                  {@const img = toApiUrl(p.imagePath)}
                  <a
                    href={`/performers/${p.id}`}
                    class="flex-shrink-0 w-24 group"
                  >
                    <div class="aspect-[3/4] bg-surface-2 overflow-hidden border border-border-subtle group-hover:border-border-accent transition-colors">
                      {#if img}
                        <img src={img} alt={p.name} class="h-full w-full object-cover" loading="lazy" />
                      {:else}
                        <div class="flex h-full w-full items-center justify-center text-text-disabled">
                          <Users class="h-6 w-6" />
                        </div>
                      {/if}
                    </div>
                    <div class="mt-1.5 text-[0.7rem] font-medium text-text-primary truncate">
                      {p.name}
                    </div>
                    {#if p.character}
                      <div class="text-[0.62rem] text-text-muted truncate">{p.character}</div>
                    {/if}
                  </a>
                {/each}
              </div>
            {/snippet}
          </HierarchySection>
        {/if}

        <!-- Child series -->
        {#if data.childSeries.length > 0}
          <HierarchySection title={`Child ${entityTerms.series.toLowerCase()}`}>
            {#snippet children()}
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {#each data.childSeries as s (s.id)}
                  <SeriesCard series={s} href={`/videos?view=series&series=${s.id}`} compact />
                {/each}
              </div>
            {/snippet}
          </HierarchySection>
        {/if}

        <!-- Seasons — only when no season is active. Clicking a season
             stays on the same series URL but adds `?season=N`, matching
             the React client-side drill-down. -->
        {#if series.renderingMode === "seasons" && series.seasons.length > 0 && data.activeSeasonNumber == null}
          <HierarchySection title="Seasons">
            {#snippet children()}
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {#each series.seasons as season (season.id)}
                  {@const label = season.seasonNumber === 0 ? "Specials" : `Season ${season.seasonNumber}`}
                  {@const poster = toApiUrl(season.posterPath ?? season.previewThumbnailPath)}
                  <a
                    href={`/videos?view=series&series=${series.id}&season=${season.seasonNumber}`}
                    class="group surface-card overflow-hidden text-left transition-colors duration-fast hover:border-border-accent"
                  >
                    <div class="relative aspect-[2/3] bg-surface-2">
                      {#if poster}
                        <img src={poster} alt={label} class="absolute inset-0 h-full w-full object-cover" loading="lazy" />
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

        <!-- Videos under the active series (or a specific season). -->
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
                href={`/videos?view=series&series=${series.id}`}
                class="text-[0.68rem] text-text-accent hover:text-text-accent-bright"
              >
                ← All seasons
              </a>
            {/if}
          {/snippet}
          {#snippet children()}
            {#if data.videos.length === 0}
              <div class="surface-panel p-8 text-center">
                <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
                <p class="text-body text-text-muted">
                  No {entityTerms.videos.toLowerCase()} in this {entityTerms.seriesSingular.toLowerCase()}.
                </p>
              </div>
            {:else}
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
          {/snippet}
        </HierarchySection>
      {/snippet}
    </HierarchyShell>
  {:else if data.view === "series" && !data.seriesId}
    <!-- Root-level series view — Jellyfin-style hierarchy shell with a
         Series grid on top and Videos grid below, mirroring the React
         /videos series landing. -->
    <HierarchyShell>
      {#snippet title()}
        <div>
          <h2 class="text-2xl font-semibold text-text-primary">{entityTerms.series}</h2>
          <p class="mt-1 text-[0.78rem] text-text-muted">
            Browse {entityTerms.series.toLowerCase()} and {entityTerms.movies.toLowerCase()}
            from disk, then drill down into individual {entityTerms.videos.toLowerCase()}.
          </p>
        </div>
      {/snippet}
      {#snippet children()}
        {#if data.series.length > 0}
          <HierarchySection title={entityTerms.series}>
            {#snippet children()}
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {#each data.series as s (s.id)}
                  <SeriesCard series={s} href={`/videos?view=series&series=${s.id}`} compact />
                {/each}
              </div>
            {/snippet}
          </HierarchySection>
        {/if}

        <HierarchySection title={entityTerms.videos}>
          {#snippet children()}
            {#if data.videos.length === 0}
              <div class="surface-panel p-8 text-center">
                <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
                <p class="text-body text-text-muted">
                  No top-level {entityTerms.videos.toLowerCase()} — drill into a {entityTerms.seriesSingular.toLowerCase()} above.
                </p>
              </div>
            {:else}
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
          {/snippet}
        </HierarchySection>
      {/snippet}
    </HierarchyShell>
  {:else if data.videos.length === 0}
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
