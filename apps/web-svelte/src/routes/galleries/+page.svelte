<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Images, Layers } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import FilterBar, { type SortDir, type ViewMode } from "$lib/components/FilterBar.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/NsfwShowModeChip.svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";

  let { data } = $props();

  const sortOptions = [
    { value: "recent", label: "Recently Added" },
    { value: "date", label: "Gallery Date" },
    { value: "title", label: "Title A–Z" },
    { value: "imageCount", label: "Image Count" },
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
    void goto(qs ? `/galleries?${qs}` : "/galleries", { keepFocus: true, noScroll: true });
  }

  const FILTER_KEYS = ["studio", "performer", "tag", "ratingMin"] as const;
  type FilterKey = (typeof FILTER_KEYS)[number];

  function filterLabel(key: FilterKey): string {
    switch (key) {
      case "studio":
        return "Studio";
      case "performer":
        return "Performer";
      case "tag":
        return "Tag";
      case "ratingMin":
        return "Min Rating";
    }
  }

  const activeFilters = $derived(
    FILTER_KEYS.flatMap((key) => {
      const raw = page.url.searchParams.getAll(key);
      return raw.map((value) => ({ label: filterLabel(key), value, type: key }));
    }),
  );

  function onAddFilter(type: string, _label: string, value: string) {
    const params = new URLSearchParams(page.url.searchParams);
    if (type === "ratingMin") params.set(type, value);
    else {
      const existing = params.getAll(type);
      if (!existing.includes(value)) params.append(type, value);
    }
    params.delete("page");
    void goto(`/galleries?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  function onRemoveFilter(index: number) {
    const f = activeFilters[index];
    if (!f) return;
    const params = new URLSearchParams(page.url.searchParams);
    const remaining = params.getAll(f.type).filter((v) => v !== f.value);
    params.delete(f.type);
    for (const v of remaining) params.append(f.type, v);
    params.delete("page");
    const qs = params.toString();
    void goto(qs ? `/galleries?${qs}` : "/galleries", { keepFocus: true, noScroll: true });
  }

  function onClearFiltersAndSort() {
    void goto("/galleries", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    activeFilters.length > 0 || data.sort !== "recent" || data.order !== "desc" || !!data.search,
  );

  const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
  function pageHref(p: number): string {
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `/galleries?${qs}` : "/galleries";
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Layers class="h-5 w-5 text-text-accent" />
        Galleries
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse galleries in your library</p>
    </div>
    <span class="text-mono-sm text-text-disabled mt-1">{data.total.toLocaleString()} total</span>
  </div>

  <FilterBar
    viewMode={data.view}
    onViewModeChange={(v: ViewMode) => updateUrl({ view: v === "grid" ? null : v })}
    sortBy={data.sort}
    sortDir={data.order}
    {sortOptions}
    onSortChange={(s: string, d?: SortDir) => updateUrl({ sort: s, order: d ?? data.order })}
    searchQuery={data.search}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    {activeFilters}
    {onAddFilter}
    {onRemoveFilter}
    {onClearFiltersAndSort}
    {canClearFiltersAndSort}
  />

  {#if data.galleries.length === 0}
    <div class="surface-panel p-8 text-center">
      <Layers class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No galleries match.</p>
    </div>
  {:else if data.view === "list"}
    <ul class="surface-panel divide-y divide-border-subtle overflow-hidden">
      {#each data.galleries as g, i (g.id)}
        <li>
          <a
            href={`/galleries/${g.id}`}
            class="flex items-center gap-3 px-3 py-2 text-body-sm hover:bg-surface-2 transition-colors duration-fast"
          >
            <NsfwBlur isNsfw={g.isNsfw} class="block shrink-0">
              <div class="w-20 aspect-[3/4] bg-surface-1 overflow-hidden">
                {#if g.coverImagePath}
                  <img src={toApiUrl(g.coverImagePath)} alt="" loading="lazy" class="h-full w-full object-cover" />
                {:else}
                  <div class={VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length] + " h-full flex items-center justify-center"}>
                    <Layers class="h-5 w-5 text-white/20" />
                  </div>
                {/if}
              </div>
            </NsfwBlur>
            <div class="flex-1 min-w-0">
              <div class="truncate text-text-primary">{g.title}</div>
              <div class="flex items-center gap-2 text-[0.7rem] text-text-muted mt-0.5">
                <span>{g.imageCount} image{g.imageCount === 1 ? "" : "s"}</span>
                {#if g.studioName}<span class="text-text-accent truncate">· {g.studioName}</span>{/if}
                {#if g.date}<span>· {g.date}</span>{/if}
              </div>
            </div>
            {#if g.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {#each data.galleries as g, i (g.id)}
        {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
        <a
          href={`/galleries/${g.id}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <NsfwBlur isNsfw={g.isNsfw} class="block">
            <div class="aspect-[3/4] bg-surface-1 relative">
              {#if g.coverImagePath}
                <img
                  src={toApiUrl(g.coverImagePath)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover"
                />
              {:else}
                <div class={gradient + " h-full w-full flex items-center justify-center"}>
                  <Layers class="h-8 w-8 text-white/20" />
                </div>
              {/if}
              <div class="pointer-events-none absolute bottom-1 right-1 z-10">
                <NsfwShowModeChip isNsfw={g.isNsfw} />
              </div>
            </div>
          </NsfwBlur>
          <div class="p-2.5 space-y-1">
            <h4 class="truncate text-body font-medium text-text-primary">{g.title}</h4>
            <div class="flex items-center gap-1.5 text-[0.65rem] text-text-muted">
              <span>{g.imageCount} image{g.imageCount === 1 ? "" : "s"}</span>
              {#if g.studioName}<span class="text-text-accent truncate">· {g.studioName}</span>{/if}
            </div>
          </div>
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
