<script lang="ts">
  import { Plus, Users, Star, Search as SearchIcon } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let { data } = $props();

  let search = $state(page.url.searchParams.get("search") ?? "");

  function handleSearch(e: SubmitEvent) {
    e.preventDefault();
    const params = new URLSearchParams(page.url.searchParams);
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    const qs = params.toString();
    void goto(qs ? `/performers?${qs}` : "/performers", { keepFocus: true });
  }
</script>

<svelte:head>
  <title>Actors — Obscura</title>
</svelte:head>

<div class="space-y-6">
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
    <div class="flex items-center gap-2">
      <form onsubmit={handleSearch} class="flex items-center gap-1.5">
        <div class="relative">
          <SearchIcon
            class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled"
          />
          <input
            type="search"
            bind:value={search}
            placeholder="Search actors"
            class="bg-surface-2 border border-border-default pl-7 pr-3 py-1.5 text-body-sm text-text-primary focus:border-border-accent outline-none transition-colors duration-fast w-48 sm:w-64"
          />
        </div>
      </form>
      <a href="/performers/new">
        <Button variant="primary" size="md">
          <Plus class="h-4 w-4" />
          New actor
        </Button>
      </a>
    </div>
  </header>

  {#if data.performers.length === 0}
    <div class="surface-panel p-8 text-center">
      <Users class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No actors match those filters.</p>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
      {#each data.performers as p (p.id)}
        <a
          href={`/performers/${p.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast flex flex-col"
        >
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
              <div class="flex h-full items-center justify-center">
                <Users class="h-8 w-8 text-text-disabled" />
              </div>
            {/if}
            {#if p.favorite}
              <Star class="absolute top-1.5 right-1.5 h-3 w-3 text-accent-500 fill-current drop-shadow-[0_0_4px_rgba(199,155,92,0.5)]" />
            {/if}
            {#if p.isNsfw}
              <span class="absolute bottom-1.5 left-1.5 media-chip-warning px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em]">
                NSFW
              </span>
            {/if}
          </div>
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
