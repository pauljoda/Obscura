<script lang="ts">
  import { Image as ImageIcon, Search as SearchIcon } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
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
    void goto(qs ? `/images?${qs}` : "/images", { keepFocus: true });
  }
</script>

<svelte:head>
  <title>Images — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-center justify-between gap-4 flex-wrap">
    <div>
      <p class="text-kicker text-text-muted">Browse</p>
      <h1 class="text-h1 text-text-primary">Images</h1>
      <p class="text-body text-text-muted mt-1">
        {data.total.toLocaleString()} image{data.total === 1 ? "" : "s"}
      </p>
    </div>
    <form onsubmit={handleSearch} class="relative">
      <SearchIcon class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
      <input
        type="search"
        bind:value={search}
        placeholder="Search images"
        class="bg-surface-2 border border-border-default pl-7 pr-3 py-1.5 text-body-sm text-text-primary focus:border-border-accent outline-none transition-colors duration-fast w-48 sm:w-72"
      />
    </form>
  </header>

  {#if data.images.length === 0}
    <div class="surface-panel p-8 text-center">
      <ImageIcon class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No images match.</p>
    </div>
  {:else}
    <div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
      {#each data.images as img (img.id)}
        <a href={`/images/${img.id}`} class="aspect-square bg-surface-1 overflow-hidden block hover:ring-1 hover:ring-border-accent transition-all duration-fast">
          {#if img.thumbnailPath}
            <img
              src={toApiUrl(img.thumbnailPath)}
              alt={img.title}
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover"
            />
          {:else}
            <div class="flex h-full items-center justify-center">
              <ImageIcon class="h-5 w-5 text-text-disabled" />
            </div>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>
