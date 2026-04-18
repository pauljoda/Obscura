<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Film, Clock } from "@lucide/svelte";
  import { MediaCard, type PerformerRef } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import FilterBar, { type SortDir, type ViewMode } from "$lib/components/FilterBar.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";

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
    <ul class="surface-panel divide-y divide-border-subtle overflow-hidden">
      {#each data.videos as v, i (v.id)}
        <li>
          <a
            href={`/videos/${v.id}`}
            class="flex items-center gap-3 px-3 py-2 text-body-sm hover:bg-surface-2 transition-colors duration-fast"
          >
            <NsfwBlur isNsfw={v.isNsfw} class="block shrink-0">
              <div class="w-24 aspect-video bg-surface-1 overflow-hidden">
                {#if v.thumbnailPath}
                  <img
                    src={toApiUrl(v.thumbnailPath)}
                    alt=""
                    loading="lazy"
                    class="h-full w-full object-cover"
                  />
                {:else}
                  <div class={VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length] + " h-full flex items-center justify-center"}>
                    <Film class="h-5 w-5 text-white/20" />
                  </div>
                {/if}
              </div>
            </NsfwBlur>
            <div class="flex-1 min-w-0">
              <div class="truncate text-text-primary">{v.title}</div>
              <div class="flex items-center gap-2 text-[0.7rem] text-text-muted mt-0.5">
                {#if v.durationFormatted}
                  <span class="inline-flex items-center gap-1"><Clock class="h-3 w-3" />{v.durationFormatted}</span>
                {/if}
                {#if v.resolution}<span>{v.resolution}</span>{/if}
                {#if v.codec}<span class="font-mono">{v.codec}</span>{/if}
                {#if v.fileSizeFormatted}<span>{v.fileSizeFormatted}</span>{/if}
                {#if v.playCount > 0}<span>▶ {v.playCount}</span>{/if}
              </div>
            </div>
            {#if v.tags && v.tags.length > 0}
              <div class="hidden md:flex gap-1 shrink-0">
                {#each v.tags.slice(0, 2) as t (t.id)}
                  <span class="tag-chip tag-chip-default">{t.name}</span>
                {/each}
              </div>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <div
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
    >
      {#each data.videos as v, i (v.id)}
        {@const cardPerformers = (v.performers ?? []).map((p) => ({
          name: p.name,
          imagePath: p.imagePath ? toApiUrl(p.imagePath) ?? null : null,
        })) as PerformerRef[]}
        <a href={`/videos/${v.id}`} class="block">
          <NsfwBlur isNsfw={v.isNsfw} class="block">
            <MediaCard
              title={v.title}
              thumbnail={toApiUrl(v.thumbnailPath)}
              cardThumbnail={toApiUrl(v.cardThumbnailPath)}
              gradientClass={VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
              duration={v.durationFormatted ?? undefined}
              resolution={v.resolution ?? undefined}
              codec={v.codec ?? undefined}
              hasSubtitles={v.hasSubtitles}
              fileSize={v.fileSizeFormatted ?? undefined}
              performers={cardPerformers.length > 0 ? cardPerformers : undefined}
              tags={(v.tags ?? []).map((t) => t.name)}
              rating={v.rating ?? undefined}
              views={v.playCount}
            />
          </NsfwBlur>
        </a>
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
