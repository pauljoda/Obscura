<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { FolderOpen, Plus } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import FilterBar, { type SortDir } from "$lib/components/FilterBar.svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";

  let { data } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently Added" },
    { value: "name", label: "Name A–Z" },
    { value: "itemCount", label: "Item Count" },
  ];

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/collections?${qs}` : "/collections", { keepFocus: true, noScroll: true });
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <header class="flex items-center justify-between gap-4 flex-wrap">
    <div>
      <p class="text-kicker text-text-muted">Browse</p>
      <h1 class="text-h1 text-text-primary">Collections</h1>
      <p class="text-body text-text-muted mt-1">
        {data.total.toLocaleString()} collection{data.total === 1 ? "" : "s"}
      </p>
    </div>
    <a href="/collections/new">
      <Button variant="primary" size="md">
        {#snippet children()}
          <Plus class="h-4 w-4" />
          New Collection
        {/snippet}
      </Button>
    </a>
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

  {#if data.collections.length === 0}
    <div class="surface-panel p-8 text-center">
      <FolderOpen class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No collections yet.</p>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {#each data.collections as c, i (c.id)}
        {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
        <a
          href={`/collections/${c.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <div class="aspect-video bg-surface-1 relative">
            {#if c.coverImagePath}
              <img
                src={toApiUrl(c.coverImagePath)}
                alt=""
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover"
              />
            {:else}
              <div class={gradient + " h-full w-full flex items-center justify-center"}>
                <FolderOpen class="h-10 w-10 text-white/20" />
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
