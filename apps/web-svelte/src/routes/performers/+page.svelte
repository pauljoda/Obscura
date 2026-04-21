<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Plus, Users, Star } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import FilterBar, { type SortDir, type ViewMode } from "$lib/components/FilterBar.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/NsfwShowModeChip.svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";

  let { data } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently added" },
    { value: "name", label: "Name A–Z" },
    { value: "videoCount", label: "Most videos" },
    { value: "rating", label: "Rating" },
  ];

  const sortBy = $derived(page.url.searchParams.get("sort") ?? "recent");
  const sortDir: SortDir = $derived(
    page.url.searchParams.get("order") === "asc" ? "asc" : "desc",
  );

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    void goto(qs ? `/performers?${qs}` : "/performers", { keepFocus: true, noScroll: true });
  }

  // Group performers alphabetically
  const grouped = $derived.by(() => {
    type Perf = (typeof data.performers)[number];
    const map = new Map<string, Perf[]>();
    for (const p of data.performers) {
      const first = (p.name?.[0] ?? "?").toUpperCase();
      const key = /[A-Z]/.test(first) ? first : "#";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  });
</script>

<svelte:head>
  <title>Actors — Obscura</title>
</svelte:head>

<div class="space-y-4">
  <header class="flex items-center justify-between gap-4 flex-wrap">
    <div>
      <p class="text-kicker text-text-muted">Browse</p>
      <h1 class="text-h1 text-text-primary">Actors</h1>
      <p class="text-body text-text-muted mt-1">
        {data.total} actor{data.total === 1 ? "" : "s"}
        {#if data.total > data.performers.length}
          <span class="text-text-disabled">— showing {data.performers.length}</span>
        {/if}
      </p>
    </div>
    <a href="/performers/new">
      <Button variant="primary" size="md">
        <Plus class="h-4 w-4" />
        New actor
      </Button>
    </a>
  </header>

  <FilterBar
    {sortOptions}
    {sortBy}
    {sortDir}
    onSortChange={(sort: string, dir?: SortDir) => updateUrl({ sort, order: dir ?? sortDir })}
    searchQuery={page.url.searchParams.get("search") ?? ""}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    showViewToggle={false}
  />

  {#if data.performers.length === 0}
    <div class="surface-panel p-8 text-center">
      <Users class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No actors match those filters.</p>
    </div>
  {:else if sortBy === "name"}
    <!-- Alphabetical grouping when name sort is active -->
    {#each grouped as [letter, group] (letter)}
      <section class="space-y-3">
        <div class="sticky top-0 z-10 bg-bg/80 backdrop-blur-sm py-2 border-b border-border-subtle">
          <h2 class="text-kicker text-text-accent">{letter}</h2>
        </div>
        <div
          class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3"
        >
          {#each group as p, i (p.id)}
            {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
            <a
              href={`/performers/${p.id}`}
              class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast flex flex-col"
            >
              <NsfwBlur isNsfw={p.isNsfw} class="block">
                <div class="aspect-[3/4] bg-surface-1 relative">
                  {#if p.imagePath}
                    <img
                      src={toApiUrl(p.imagePath)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      class="h-full w-full object-cover"
                    />
                  {:else}
                    <div class={gradient + " h-full w-full flex items-center justify-center"}>
                      <Users class="h-8 w-8 text-white/20" />
                    </div>
                  {/if}
                  {#if p.favorite}
                    <Star
                      class="absolute top-1.5 right-1.5 h-3 w-3 text-accent-500 fill-current drop-shadow-[0_0_4px_rgba(199,155,92,0.5)]"
                    />
                  {/if}
                  <div class="pointer-events-none absolute bottom-1 right-1 z-10">
                    <NsfwShowModeChip isNsfw={p.isNsfw} />
                  </div>
                </div>
              </NsfwBlur>
              <div class="p-2 space-y-1">
                <h4 class="truncate text-[0.8rem] font-medium text-text-primary leading-tight">
                  {p.name}
                </h4>
                {#if p.disambiguation}
                  <p class="truncate text-[0.65rem] text-text-disabled">{p.disambiguation}</p>
                {/if}
                <div class="flex items-center gap-1.5 text-[0.62rem] text-text-muted">
                  {#if p.videoCount > 0}<span>{p.videoCount}v</span>{/if}
                  {#if p.imageAppearanceCount > 0}<span>{p.imageAppearanceCount}i</span>{/if}
                  {#if p.country}<span class="text-text-disabled">· {p.country}</span>{/if}
                </div>
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/each}
  {:else}
    <div
      class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3"
    >
      {#each data.performers as p, i (p.id)}
        {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
        <a
          href={`/performers/${p.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast flex flex-col"
        >
          <NsfwBlur isNsfw={p.isNsfw} class="block">
            <div class="aspect-[3/4] bg-surface-1 relative">
              {#if p.imagePath}
                <img
                  src={toApiUrl(p.imagePath)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover"
                />
              {:else}
                <div class={gradient + " h-full w-full flex items-center justify-center"}>
                  <Users class="h-8 w-8 text-white/20" />
                </div>
              {/if}
              {#if p.favorite}
                <Star
                  class="absolute top-1.5 right-1.5 h-3 w-3 text-accent-500 fill-current drop-shadow-[0_0_4px_rgba(199,155,92,0.5)]"
                />
              {/if}
              <div class="pointer-events-none absolute bottom-1 right-1 z-10">
                <NsfwShowModeChip isNsfw={p.isNsfw} />
              </div>
            </div>
          </NsfwBlur>
          <div class="p-2 space-y-1">
            <h4 class="truncate text-[0.8rem] font-medium text-text-primary leading-tight">{p.name}</h4>
            {#if p.disambiguation}
              <p class="truncate text-[0.65rem] text-text-disabled">{p.disambiguation}</p>
            {/if}
            <div class="flex items-center gap-1.5 text-[0.62rem] text-text-muted">
              {#if p.videoCount > 0}<span>{p.videoCount}v</span>{/if}
              {#if p.imageAppearanceCount > 0}<span>{p.imageAppearanceCount}i</span>{/if}
              {#if p.country}<span class="text-text-disabled">· {p.country}</span>{/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
