<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Plus, Tag as TagIcon, Star } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import FilterBar, { type SortDir } from "$lib/components/FilterBar.svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();

  const sortOptions = [
    { value: "name", label: "Name" },
    { value: "videoCount", label: "Video Count" },
    { value: "imageCount", label: "Image Count" },
  ];

  const sortBy = $derived(page.url.searchParams.get("sort") ?? "name");
  const sortDir: SortDir = $derived(
    page.url.searchParams.get("order") === "desc" ? "desc" : "asc",
  );
  const searchQuery = $derived(page.url.searchParams.get("search") ?? "");

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    void goto(qs ? `/tags?${qs}` : "/tags", { keepFocus: true, noScroll: true });
  }

  function onClearFiltersAndSort() {
    void goto("/tags", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    !!searchQuery || sortBy !== "name" || sortDir !== "asc",
  );

  const filtered = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = data.tags;
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q));
    const sign = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "videoCount":
          return sign * ((a.videoCount ?? 0) - (b.videoCount ?? 0));
        case "imageCount":
          return sign * ((a.imageCount ?? 0) - (b.imageCount ?? 0));
        case "name":
        default:
          return sign * a.name.localeCompare(b.name);
      }
    });
    return list;
  });
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-center justify-between gap-4">
    <div>
      <p class="text-kicker text-text-muted">Browse</p>
      <h1 class="text-h1 text-text-primary">Tags</h1>
      <p class="text-body text-text-muted mt-1">
        {filtered.length} tag{filtered.length === 1 ? "" : "s"}
      </p>
    </div>
    <a href="/tags/new">
      <Button variant="primary" size="md">
        {#snippet children()}
          <Plus class="h-4 w-4" />
          New tag
        {/snippet}
      </Button>
    </a>
  </header>

  <FilterBar
    {sortOptions}
    {sortBy}
    {sortDir}
    onSortChange={(sort: string, dir?: SortDir) => updateUrl({ sort, order: dir ?? sortDir })}
    {searchQuery}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    showViewToggle={false}
    {onClearFiltersAndSort}
    {canClearFiltersAndSort}
  />

  {#if filtered.length === 0}
    <div class="surface-panel p-8 text-center">
      <TagIcon class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">
        {searchQuery ? "No tags match that search." : "No tags yet."}
      </p>
      {#if !searchQuery}
        <p class="text-body-sm text-text-disabled mt-1">
          Tags you create from the Identify or Edit flows will appear here.
        </p>
      {/if}
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {#each filtered as tag (tag.id)}
        <a
          href={`/tags/${encodeURIComponent(tag.name)}`}
          class="surface-card-sharp p-3 flex flex-col gap-2 hover:border-border-accent transition-colors duration-fast"
        >
          <div class="flex items-center gap-2">
            {#if tag.imagePath}
              <img
                src={toApiUrl(tag.imagePath)}
                alt=""
                loading="lazy"
                decoding="async"
                class="h-6 w-6 object-cover shrink-0 border border-border-subtle"
              />
            {:else}
              <TagIcon class="h-4 w-4 text-accent-500 shrink-0" />
            {/if}
            <span class="truncate text-body font-medium text-text-primary">{tag.name}</span>
            {#if tag.favorite}
              <Star class="h-3 w-3 text-accent-500 fill-current ml-auto shrink-0" />
            {/if}
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            {#if tag.videoCount > 0}
              <Badge>
                {#snippet children()}
                  {tag.videoCount} video{tag.videoCount === 1 ? "" : "s"}
                {/snippet}
              </Badge>
            {/if}
            {#if tag.imageCount > 0}
              <Badge>
                {#snippet children()}
                  {tag.imageCount} image{tag.imageCount === 1 ? "" : "s"}
                {/snippet}
              </Badge>
            {/if}
            {#if tag.isNsfw}
              <Badge variant="warning">
                {#snippet children()}NSFW{/snippet}
              </Badge>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
