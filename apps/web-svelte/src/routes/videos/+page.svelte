<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Film } from "@lucide/svelte";
  import FilterBar, { type SortDir, type ViewMode } from "$lib/components/FilterBar.svelte";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";

  let { data } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently added" },
    { value: "date", label: "Video date" },
    { value: "title", label: "Title A–Z" },
    { value: "duration", label: "Duration" },
    { value: "size", label: "File size" },
    { value: "rating", label: "Rating" },
    { value: "plays", label: "Most played" },
    { value: "episode", label: "Episode order" },
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
    sortBy={data.sort}
    sortDir={data.order}
    {sortOptions}
    {onSortChange}
    searchQuery={data.search}
    {onSearchChange}
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
