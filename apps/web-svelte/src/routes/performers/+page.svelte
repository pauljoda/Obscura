<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Users, Star } from "@lucide/svelte";
  import FilterBar, {
    type SortDir,
    type ActiveFilter,
  } from "$lib/components/FilterBar.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/NsfwShowModeChip.svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";

  let { data } = $props();

  const sortOptions = [
    { value: "videoCount", label: "Video Count" },
    { value: "name", label: "Name A–Z" },
    { value: "recent", label: "Recently Added" },
    { value: "rating", label: "Rating" },
  ];

  const sortBy = $derived(page.url.searchParams.get("sort") ?? "videoCount");
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

  const FILTER_KEYS = ["gender", "country", "favorite", "hasImage", "ratingMin"] as const;
  type FilterKey = (typeof FILTER_KEYS)[number];

  function filterLabel(key: FilterKey): string {
    switch (key) {
      case "gender":
        return "Gender";
      case "country":
        return "Country";
      case "favorite":
        return "Favorite";
      case "hasImage":
        return "Photo";
      case "ratingMin":
        return "Min Rating";
    }
  }

  const activeFilters = $derived<ActiveFilter[]>(
    FILTER_KEYS.flatMap((key) => {
      const raw = page.url.searchParams.getAll(key);
      return raw.map((value) => ({ label: filterLabel(key), value, type: key }));
    }),
  );

  function onAddFilter(type: string, _label: string, value: string) {
    const params = new URLSearchParams(page.url.searchParams);
    if (type === "favorite" || type === "hasImage" || type === "ratingMin") {
      params.set(type, value);
    } else {
      const existing = params.getAll(type);
      if (!existing.includes(value)) params.append(type, value);
    }
    void goto(`/performers?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  function onRemoveFilter(index: number) {
    const f = activeFilters[index];
    if (!f) return;
    const params = new URLSearchParams(page.url.searchParams);
    const remaining = params.getAll(f.type!).filter((v) => v !== f.value);
    params.delete(f.type!);
    for (const v of remaining) params.append(f.type!, v);
    const qs = params.toString();
    void goto(qs ? `/performers?${qs}` : "/performers", { keepFocus: true, noScroll: true });
  }

  function onClearFiltersAndSort() {
    void goto("/performers", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    activeFilters.length > 0 || sortBy !== "videoCount" || sortDir !== "desc",
  );

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
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Users class="h-5 w-5 text-text-accent" />
        Actors
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">Browse actors in your library</p>
    </div>
    <span class="mt-1 text-mono-sm text-text-disabled">{data.total} total</span>
  </div>

  <FilterBar
    {sortOptions}
    {sortBy}
    {sortDir}
    onSortChange={(sort: string, dir?: SortDir) => updateUrl({ sort, order: dir ?? sortDir })}
    searchQuery={page.url.searchParams.get("search") ?? ""}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    showViewToggle={false}
    {activeFilters}
    {onAddFilter}
    {onRemoveFilter}
    {onClearFiltersAndSort}
    {canClearFiltersAndSort}
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
