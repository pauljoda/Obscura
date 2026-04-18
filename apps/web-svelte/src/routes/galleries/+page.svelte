<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Search as SearchIcon, Images } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
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
    void goto(qs ? `/galleries?${qs}` : "/galleries", { keepFocus: true });
  }
</script>

<svelte:head>
  <title>Galleries — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-center justify-between gap-4 flex-wrap">
    <div>
      <p class="text-kicker text-text-muted">Browse</p>
      <h1 class="text-h1 text-text-primary">Galleries</h1>
      <p class="text-body text-text-muted mt-1">
        {data.total.toLocaleString()} galler{data.total === 1 ? "y" : "ies"}
      </p>
    </div>
    <form onsubmit={handleSearch} class="relative">
      <SearchIcon class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
      <input
        type="search"
        bind:value={search}
        placeholder="Search galleries"
        class="bg-surface-2 border border-border-default pl-7 pr-3 py-1.5 text-body-sm text-text-primary focus:border-border-accent outline-none transition-colors duration-fast w-48 sm:w-72"
      />
    </form>
  </header>

  {#if data.galleries.length === 0}
    <div class="surface-panel p-8 text-center">
      <Images class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No galleries match.</p>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {#each data.galleries as g (g.id)}
        <a
          href={`/galleries/${g.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <div class="aspect-video bg-surface-1">
            {#if g.coverImagePath}
              <img
                src={toApiUrl(g.coverImagePath)}
                alt=""
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover"
              />
            {:else}
              <div class="flex h-full items-center justify-center">
                <Images class="h-8 w-8 text-text-disabled" />
              </div>
            {/if}
          </div>
          <div class="p-2.5 space-y-1">
            <h4 class="truncate text-body font-medium text-text-primary">{g.title}</h4>
            <div class="flex items-center gap-1.5 text-[0.65rem] text-text-muted">
              <span>{g.imageCount} image{g.imageCount === 1 ? "" : "s"}</span>
              {#if g.studioName}
                <span class="text-text-accent truncate">· {g.studioName}</span>
              {/if}
              {#if g.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
