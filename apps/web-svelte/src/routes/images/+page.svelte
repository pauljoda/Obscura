<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Image as ImageIcon } from "@lucide/svelte";
  import FilterBar, { type SortDir } from "$lib/components/FilterBar.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently added" },
    { value: "date", label: "Image date" },
    { value: "title", label: "Title A–Z" },
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
    void goto(qs ? `/images?${qs}` : "/images", { keepFocus: true, noScroll: true });
  }

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/images?${qs}` : "/images";
  }
</script>

<svelte:head>
  <title>Images — Obscura</title>
</svelte:head>

<div class="space-y-4">
  <header>
    <p class="text-kicker text-text-muted">Browse</p>
    <h1 class="text-h1 text-text-primary">Images</h1>
    <p class="text-body text-text-muted mt-1">
      {data.total.toLocaleString()} image{data.total === 1 ? "" : "s"}
    </p>
  </header>

  <FilterBar
    {sortOptions}
    sortBy={data.sort}
    sortDir={data.order}
    onSortChange={(s: string, d?: SortDir) => updateUrl({ sort: s, order: d ?? data.order })}
    searchQuery={data.search}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    showViewToggle={false}
  />

  {#if data.images.length === 0}
    <div class="surface-panel p-8 text-center">
      <ImageIcon class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No images match.</p>
    </div>
  {:else}
    <div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
      {#each data.images as img (img.id)}
        <a
          href={`/images/${img.id}`}
          class="aspect-square bg-surface-1 overflow-hidden block hover:ring-1 hover:ring-border-accent transition-all duration-fast"
        >
          <NsfwBlur isNsfw={img.isNsfw} class="block h-full w-full">
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
          </NsfwBlur>
        </a>
      {/each}
    </div>
  {/if}

  {#if totalPages > 1}
    <nav class="flex items-center justify-center gap-2 pt-4 border-t border-border-subtle">
      {#if data.page > 1}
        <a href={pageHref(data.page - 1)} class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary">
          ← Prev
        </a>
      {/if}
      <span class="text-body-sm text-text-muted">Page {data.page} of {totalPages}</span>
      {#if data.page < totalPages}
        <a href={pageHref(data.page + 1)} class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary">
          Next →
        </a>
      {/if}
    </nav>
  {/if}
</div>
