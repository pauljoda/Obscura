<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { FolderOpen, Plus, Search as SearchIcon } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
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
    void goto(qs ? `/collections?${qs}` : "/collections", { keepFocus: true });
  }
</script>

<svelte:head>
  <title>Collections — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-center justify-between gap-4 flex-wrap">
    <div>
      <p class="text-kicker text-text-muted">Browse</p>
      <h1 class="text-h1 text-text-primary">Collections</h1>
      <p class="text-body text-text-muted mt-1">
        {data.total.toLocaleString()} collection{data.total === 1 ? "" : "s"}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <form onsubmit={handleSearch} class="relative">
        <SearchIcon class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
        <input
          type="search"
          bind:value={search}
          placeholder="Search collections"
          class="bg-surface-2 border border-border-default pl-7 pr-3 py-1.5 text-body-sm text-text-primary focus:border-border-accent outline-none transition-colors duration-fast w-48 sm:w-64"
        />
      </form>
      <a href="/collections/new">
        <Button variant="primary" size="md">
          <Plus class="h-4 w-4" />
          New collection
        </Button>
      </a>
    </div>
  </header>

  {#if data.collections.length === 0}
    <div class="surface-panel p-8 text-center">
      <FolderOpen class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No collections yet.</p>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {#each data.collections as c (c.id)}
        <a
          href={`/collections/${c.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <div class="aspect-video bg-surface-1">
            {#if c.coverImagePath}
              <img
                src={toApiUrl(c.coverImagePath)}
                alt=""
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover"
              />
            {:else}
              <div class="flex h-full items-center justify-center">
                <FolderOpen class="h-8 w-8 text-text-disabled" />
              </div>
            {/if}
          </div>
          <div class="p-2.5 space-y-1">
            <h4 class="truncate text-body font-medium text-text-primary">{c.name}</h4>
            <div class="flex items-center gap-1.5 text-[0.65rem] text-text-muted">
              <span>{c.itemCount} item{c.itemCount === 1 ? "" : "s"}</span>
              <Badge>{c.mode}</Badge>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
