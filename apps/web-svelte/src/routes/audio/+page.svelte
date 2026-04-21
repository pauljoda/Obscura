<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Music } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import FilterBar, { type SortDir } from "$lib/components/FilterBar.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/NsfwShowModeChip.svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";

  let { data } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Release Date" },
    { value: "title", label: "Title A–Z" },
    { value: "trackCount", label: "Track Count" },
    { value: "rating", label: "Rating" },
  ];

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/audio?${qs}` : "/audio", { keepFocus: true, noScroll: true });
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Music class="h-5 w-5 text-text-accent" />
        Audio
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse audio libraries in your collection</p>
    </div>
    <span class="text-mono-sm text-text-disabled mt-1">{data.total.toLocaleString()} total</span>
  </div>

  <FilterBar
    {sortOptions}
    sortBy={data.sort}
    sortDir={data.order}
    onSortChange={(s: string, d?: SortDir) => updateUrl({ sort: s, order: d ?? data.order })}
    searchQuery={data.search}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    showViewToggle={false}
  />

  {#if data.libraries.length === 0}
    <div class="surface-panel p-8 text-center">
      <Music class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No audio libraries.</p>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {#each data.libraries as a, i (a.id)}
        {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
        <a
          href={`/audio/${a.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <NsfwBlur isNsfw={a.isNsfw} class="block">
            <div class="aspect-square bg-surface-1 relative">
              {#if a.coverImagePath}
                <img
                  src={toApiUrl(a.coverImagePath)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover"
                />
              {:else}
                <div class={gradient + " h-full w-full flex items-center justify-center"}>
                  <Music class="h-10 w-10 text-white/20" />
                </div>
              {/if}
              <div class="pointer-events-none absolute bottom-1 right-1 z-10">
                <NsfwShowModeChip isNsfw={a.isNsfw} />
              </div>
            </div>
          </NsfwBlur>
          <div class="p-2 space-y-1">
            <h4 class="truncate text-body-sm font-medium text-text-primary">{a.title}</h4>
            <div class="flex items-center gap-1.5 text-[0.62rem] text-text-muted">
              <span>{a.trackCount} track{a.trackCount === 1 ? "" : "s"}</span>
              {#if a.studioName}<span class="text-text-accent truncate">· {a.studioName}</span>{/if}
              {#if a.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
