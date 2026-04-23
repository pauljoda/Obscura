<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Film } from "@lucide/svelte";
  import FilterBar, {
    type SortDir,
    type ViewMode,
  } from "$lib/components/FilterBar.svelte";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";

  let { data } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Video date" },
    { value: "title", label: "Title A-Z" },
    { value: "duration", label: "Duration" },
    { value: "size", label: "File Size" },
    { value: "rating", label: "Rating" },
    { value: "plays", label: "Most Played" },
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

  function onClearFiltersAndSort() {
    void goto("/videos", { keepFocus: true, noScroll: true });
  }

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
  const canClearFiltersAndSort = $derived(
    Boolean(data.search) ||
      data.sort !== "recent" ||
      data.order !== "desc" ||
      data.view !== "grid",
  );

  function pageHref(nextPage: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (nextPage > 1) params.set("page", String(nextPage));
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
    sortBy={data.sort}
    sortDir={data.order}
    {sortOptions}
    {onSortChange}
    searchQuery={data.search}
    {onSearchChange}
    onClearFiltersAndSort={canClearFiltersAndSort ? onClearFiltersAndSort : undefined}
    {canClearFiltersAndSort}
  />

  {#if data.videos.length === 0}
    <div class="surface-panel p-8 text-center">
      <Film class="mx-auto mb-3 h-10 w-10 text-text-disabled" />
      <p class="text-body text-text-muted">No videos match those filters.</p>
    </div>
  {:else if data.view === "list"}
    <div class="space-y-1.5">
      {#each data.videos as video, index (video.id)}
        <VideoCard video={videoListItemToCardData(video, "/videos")} variant="list" index={index} />
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {#each data.videos as video, index (video.id)}
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
