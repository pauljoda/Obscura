<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Search as SearchIcon, Film } from "@lucide/svelte";
  import { MediaCard, type PerformerRef } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();

  let search = $state(data.search);

  function handleSearch(e: SubmitEvent) {
    e.preventDefault();
    const params = new URLSearchParams(page.url.searchParams);
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/videos?${qs}` : "/videos", { keepFocus: true });
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

<div class="space-y-6">
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
    <form onsubmit={handleSearch} class="flex items-center gap-1.5">
      <div class="relative">
        <SearchIcon class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
        <input
          type="search"
          bind:value={search}
          placeholder="Search videos"
          class="bg-surface-2 border border-border-default pl-7 pr-3 py-1.5 text-body-sm text-text-primary focus:border-border-accent outline-none transition-colors duration-fast w-48 sm:w-72"
        />
      </div>
    </form>
  </header>

  {#if data.videos.length === 0}
    <div class="surface-panel p-8 text-center">
      <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No videos match those filters.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {#each data.videos as v (v.id)}
        {@const performers: PerformerRef[] = (v.performers ?? []).map((p) => ({
          name: p.name,
          imagePath: p.imagePath ? toApiUrl(p.imagePath) ?? null : null,
        }))}
        {@const thumb = toApiUrl(v.thumbnailPath)}
        {@const cardThumb = toApiUrl(v.cardThumbnailPath)}
        <a href={`/videos/${v.id}`} class="block">
          <MediaCard
            title={v.title}
            thumbnail={thumb}
            cardThumbnail={cardThumb}
            duration={v.durationFormatted ?? undefined}
            resolution={v.resolution ?? undefined}
            codec={v.codec ?? undefined}
            hasSubtitles={v.hasSubtitles}
            fileSize={v.fileSizeFormatted ?? undefined}
            performers={performers.length > 0 ? performers : undefined}
            tags={(v.tags ?? []).map((t) => t.name)}
            rating={v.rating ?? undefined}
            views={v.playCount}
          />
        </a>
      {/each}
    </div>

    {#if totalPages > 1}
      <nav class="flex items-center justify-center gap-2 pt-4 border-t border-border-subtle">
        {#if data.page > 1}
          <a href={pageHref(data.page - 1)} class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary">
            ← Prev
          </a>
        {/if}
        <span class="text-body-sm text-text-muted">
          Page {data.page} of {totalPages}
        </span>
        {#if data.page < totalPages}
          <a href={pageHref(data.page + 1)} class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary">
            Next →
          </a>
        {/if}
      </nav>
    {/if}
  {/if}
</div>
