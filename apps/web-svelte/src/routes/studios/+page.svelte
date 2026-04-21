<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Building2, Star } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import FilterBar, { type SortDir } from "$lib/components/FilterBar.svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();

  const sortOptions = [
    { value: "name", label: "Name" },
    { value: "videoCount", label: "Video Count" },
    { value: "rating", label: "Rating" },
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
    void goto(qs ? `/studios?${qs}` : "/studios", { keepFocus: true, noScroll: true });
  }

  function onClearFiltersAndSort() {
    void goto("/studios", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    !!searchQuery || sortBy !== "name" || sortDir !== "asc",
  );

  // Client-side filter + sort — the server returns the full list.
  const filtered = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = data.studios;
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
    const sign = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "videoCount":
          return sign * ((a.videoCount ?? 0) - (b.videoCount ?? 0));
        case "rating":
          return sign * ((a.rating ?? 0) - (b.rating ?? 0));
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
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Building2 class="h-5 w-5 text-text-accent" />
        Studios
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse studios in your library</p>
    </div>
    <span class="text-mono-sm text-text-disabled mt-1">
      {filtered.length} total
    </span>
  </div>

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
      <Building2 class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">
        {searchQuery ? "No studios match that search." : "No studios yet."}
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {#each filtered as studio (studio.id)}
        <a
          href={`/studios/${encodeURIComponent(studio.name)}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <div class="aspect-[4/3] bg-surface-1 relative">
            {#if studio.imagePath || studio.imageUrl}
              <img
                src={toApiUrl(studio.imagePath) ?? studio.imageUrl ?? undefined}
                alt=""
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover"
              />
            {:else}
              <div class="flex h-full items-center justify-center">
                <Building2 class="h-8 w-8 text-text-disabled" />
              </div>
            {/if}
            {#if studio.favorite}
              <Star
                class="absolute top-1.5 right-1.5 h-3 w-3 text-accent-500 fill-current drop-shadow-[0_0_4px_rgba(199,155,92,0.5)]"
              />
            {/if}
          </div>
          <div class="p-2.5 space-y-1.5">
            <h4 class="truncate text-body font-medium text-text-primary">{studio.name}</h4>
            <div class="flex flex-wrap items-center gap-1">
              {#if studio.videoCount > 0}
                <Badge>
                  {#snippet children()}
                    {studio.videoCount} video{studio.videoCount === 1 ? "" : "s"}
                  {/snippet}
                </Badge>
              {/if}
              {#if studio.imageAppearanceCount > 0}
                <Badge>
                  {#snippet children()}
                    {studio.imageAppearanceCount} image{studio.imageAppearanceCount === 1 ? "" : "s"}
                  {/snippet}
                </Badge>
              {/if}
              {#if studio.audioLibraryCount > 0}
                <Badge>
                  {#snippet children()}
                    {studio.audioLibraryCount} album{studio.audioLibraryCount === 1 ? "" : "s"}
                  {/snippet}
                </Badge>
              {/if}
              {#if studio.isNsfw}
                <Badge variant="warning">
                  {#snippet children()}NSFW{/snippet}
                </Badge>
              {/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
