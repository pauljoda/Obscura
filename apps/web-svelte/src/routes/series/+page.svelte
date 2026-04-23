<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Film, FolderOpen, HardDrive, Users } from "@lucide/svelte";
  import FilterBar, {
    type SortDir,
    type ViewMode,
  } from "$lib/components/FilterBar.svelte";
  import SeriesCard from "$lib/components/SeriesCard.svelte";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import HierarchyShell from "$lib/components/shared/HierarchyShell.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import HierarchyBreadcrumbs from "$lib/components/shared/HierarchyBreadcrumbs.svelte";
  import IdentifyButton from "$lib/components/IdentifyButton.svelte";
  import NsfwTagLabel from "$lib/components/NsfwTagLabel.svelte";
  import { entityTerms, formatVideoCount } from "$lib/terminology";
  import { toApiUrl } from "$lib/api/core";
  import { videoListItemToCardData } from "$lib/video-card-data";

  let { data } = $props();

  const sortOptions = [
    { value: "episode", label: "Episode order" },
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Video date" },
    { value: "title", label: "Title A-Z" },
    { value: "duration", label: "Duration" },
    { value: "size", label: "File Size" },
    { value: "rating", label: "Rating" },
    { value: "plays", label: "Most Played" },
  ];

  const currentPath = $derived(`${page.url.pathname}${page.url.search}`);
  const showsVideos = $derived(
    Boolean(
      data.activeSeries &&
        (data.activeSeries.renderingMode === "flat" ||
          data.activeSeasonNumber != null),
    ),
  );
  const canClearFiltersAndSort = $derived(
    Boolean(data.search) ||
      (showsVideos &&
        (data.sort !== "episode" ||
          data.order !== "asc" ||
          data.view !== "grid")),
  );
  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

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
    updateUrl({ search: q || null });
  }

  function onSortChange(sort: string, dir?: SortDir) {
    updateUrl({ sort, order: dir ?? data.order });
  }

  function onViewModeChange(v: ViewMode) {
    updateUrl({ view: v === "grid" ? null : v });
  }

  function onClearFiltersAndSort() {
    void goto(data.seriesId ? `/series?series=${data.seriesId}` : "/series", {
      keepFocus: true,
      noScroll: true,
    });
  }

  function pageHref(nextPage: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/series?${qs}` : "/series";
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

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
  </div>

  <FilterBar
    viewMode={data.view}
    {onViewModeChange}
    sortBy={data.sort}
    sortDir={data.order}
    {sortOptions}
    {onSortChange}
    searchQuery={data.search}
    {onSearchChange}
    showViewToggle={showsVideos}
    showSortControls={showsVideos}
    searchPlaceholder={showsVideos
      ? "Search videos in this series..."
      : "Search series..."}
    onClearFiltersAndSort={canClearFiltersAndSort ? onClearFiltersAndSort : undefined}
    {canClearFiltersAndSort}
  />

  {#if data.activeSeries}
    {@const series = data.activeSeries}
    {@const backdrop = toApiUrl(series.backdropImagePath, series.updatedAt)}
    {@const cover = toApiUrl(series.coverImagePath, series.updatedAt)}

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
        <div class="relative overflow-hidden border border-border-subtle bg-surface-1">
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
          {/if}
          <div class="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/60 to-bg/20"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-black/10"></div>
          <div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg to-transparent"></div>

          <div class="relative flex min-h-[420px] flex-col justify-end gap-5 p-4 sm:min-h-[460px] sm:p-6 lg:min-h-[520px] lg:flex-row lg:items-end lg:gap-8 lg:p-8">
            {#if cover}
              <div class="w-[124px] flex-shrink-0 sm:w-[190px] lg:w-[230px]">
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

              <div class="mt-5 flex flex-wrap items-center gap-2">
                <IdentifyButton
                  entityKind="video_series"
                  entityId={series.id}
                  title={series.displayTitle}
                  label="Identify Series"
                />
              </div>

              {#if series.details}
                <p class="mt-5 max-w-3xl text-[0.95rem] leading-relaxed text-white/80">
                  {series.details}
                </p>
              {/if}

              {#if series.tags.length > 0}
                <div class="mt-5 flex flex-wrap items-center gap-1.5">
                  <span class="text-[0.65rem] uppercase tracking-[0.14em] text-text-muted">Tags:</span>
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
              {#if data.videos.length === 0}
                <div class="surface-panel p-8 text-center">
                  <Film class="mx-auto mb-3 h-10 w-10 text-text-disabled" />
                  <p class="text-body text-text-muted">
                    No {entityTerms.videos.toLowerCase()} in this {entityTerms.seriesSingular.toLowerCase()}.
                  </p>
                </div>
              {:else if data.view === "list"}
                <div class="space-y-1.5">
                  {#each data.videos as video, index (video.id)}
                    <VideoCard
                      video={videoListItemToCardData(video, currentPath)}
                      variant="list"
                      index={index}
                    />
                  {/each}
                </div>
              {:else}
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {#each data.videos as video, index (video.id)}
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
        {#if data.series.length > 0}
          <HierarchySection title={entityTerms.series}>
            {#snippet children()}
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {#each data.series as series (series.id)}
                  <SeriesCard series={series} href={`/series?series=${series.id}`} compact />
                {/each}
              </div>
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

  {#if showsVideos && totalPages > 1}
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
