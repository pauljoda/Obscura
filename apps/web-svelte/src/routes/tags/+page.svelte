<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Tag as TagIcon, Star, Image as ImageIcon } from "@lucide/svelte";
  import FilterBar, {
    type SortDir,
    type ActiveFilter,
  } from "$lib/components/FilterBar.svelte";
  import FilterSection from "$lib/components/FilterSection.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { createServerPrefs } from "$lib/server-prefs.svelte";
  import { createServerPresets, type FilterPreset } from "$lib/server-presets.svelte";

  let { data } = $props();

  const sortOptions = [
    { value: "videos", label: "Usage Count" },
    { value: "name", label: "Name A-Z" },
    { value: "rating", label: "Rating" },
  ];

  const sortBy = $derived(page.url.searchParams.get("sort") ?? "videos");
  const sortDir: SortDir = $derived(
    page.url.searchParams.get("order") === "asc" ? "asc" : "desc",
  );
  const searchQuery = $derived(page.url.searchParams.get("search") ?? "");
  const favoriteFilter = $derived(page.url.searchParams.get("favorite"));
  const hasImageFilter = $derived(page.url.searchParams.get("hasImage"));
  const ratingMinFilter = $derived(page.url.searchParams.get("ratingMin"));

  function updateUrl(patch: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    void goto(qs ? `/tags?${qs}` : "/tags", { keepFocus: true, noScroll: true });
  }

  const activeFilters = $derived<ActiveFilter[]>([
    ...(favoriteFilter ? [{ label: "Favorite", type: "favorite", value: favoriteFilter }] : []),
    ...(hasImageFilter ? [{ label: "Image", type: "hasImage", value: hasImageFilter }] : []),
    ...(ratingMinFilter
      ? [{ label: "Min rating", type: "ratingMin", value: ratingMinFilter }]
      : []),
  ]);

  function onAddFilter(type: string, _label: string, value: string) {
    updateUrl({ [type]: value });
  }

  function onRemoveFilter(index: number) {
    const f = activeFilters[index];
    if (!f) return;
    updateUrl({ [f.type!]: null });
  }

  function onClearFiltersAndSort() {
    void goto("/tags", { keepFocus: true, noScroll: true });
  }

  const canClearFiltersAndSort = $derived(
    !!searchQuery || sortBy !== "videos" || sortDir !== "desc" || activeFilters.length > 0,
  );

  const presetsApi = createServerPresets("tags:filterPresets");
  const viewPrefs = createServerPrefs<{ cols: number }>("tags:view", { cols: 5 });

  onMount(() => {
    void presetsApi.load();
    void viewPrefs.load();
  });

  function samePresetFilters(preset: FilterPreset): boolean {
    if (preset.sortBy !== sortBy || preset.sortDir !== sortDir) return false;
    if (preset.filters.length !== activeFilters.length) return false;
    return preset.filters.every((pf) =>
      activeFilters.some((af) => af.type === pf.type && af.value === pf.value),
    );
  }

  const activePresetId = $derived.by(() => {
    const match = presetsApi.presets.find((preset) => samePresetFilters(preset));
    return match?.id ?? null;
  });

  function applyPreset(preset: FilterPreset) {
    const params = new URLSearchParams();
    if (preset.sortBy && preset.sortBy !== "videos") params.set("sort", preset.sortBy);
    if (preset.sortDir && preset.sortDir !== "desc") params.set("order", preset.sortDir);
    for (const filter of preset.filters) {
      if (filter.type) params.set(filter.type, filter.value);
    }
    const qs = params.toString();
    void goto(qs ? `/tags?${qs}` : "/tags", { keepFocus: true, noScroll: true });
  }

  function currentPreset(name: string): FilterPreset {
    return {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      filters: activeFilters.map((f) => ({ label: f.label, type: f.type ?? f.label, value: f.value })),
      sortBy,
      sortDir,
    };
  }

  function savePreset(name: string) {
    presetsApi.save([...presetsApi.presets, currentPreset(name)]);
  }

  function overwritePreset(id: string) {
    presetsApi.save(
      presetsApi.presets.map((preset) =>
        preset.id === id ? { ...currentPreset(preset.name), id } : preset,
      ),
    );
  }

  function deletePreset(id: string) {
    presetsApi.save(presetsApi.presets.filter((preset) => preset.id !== id));
  }

  const filtered = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = data.tags;
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q));
    if (favoriteFilter === "true") list = list.filter((t) => t.favorite);
    if (hasImageFilter === "true") list = list.filter((t) => !!t.imagePath);
    if (hasImageFilter === "false") list = list.filter((t) => !t.imagePath);
    if (ratingMinFilter) {
      const n = Number(ratingMinFilter);
      if (Number.isFinite(n)) list = list.filter((t) => (t.rating ?? 0) >= n);
    }
    const sign = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "videos":
          return (
            sign *
            ((a.videoCount ?? 0) + (a.imageCount ?? 0) -
              ((b.videoCount ?? 0) + (b.imageCount ?? 0)))
          );
        case "rating":
          return sign * ((a.rating ?? 0) - (b.rating ?? 0));
        case "name":
        default:
          return sign * a.name.localeCompare(b.name);
      }
    });
    return list;
  });

  const withContent = $derived(
    filtered.filter((t) => (t.videoCount ?? 0) + (t.imageCount ?? 0) > 0),
  );
  const withoutContent = $derived(
    filtered.filter((t) => (t.videoCount ?? 0) + (t.imageCount ?? 0) === 0),
  );

  // Generate a stable HSL gradient from tag name — gives each tag a
  // consistent identity color when no image is set.
  function gradientFor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 35) % 360;
    return `linear-gradient(135deg, hsl(${h1} 35% 22%) 0%, hsl(${h2} 40% 14%) 100%)`;
  }

  function initialsFor(name: string): string {
    const parts = name
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return name.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <TagIcon class="h-5 w-5 text-text-accent" />
        Tags
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse tags in your library</p>
    </div>
    <span class="text-mono-sm text-text-disabled mt-1">{filtered.length} total</span>
  </div>

  <FilterBar
    {sortOptions}
    {sortBy}
    {sortDir}
    onSortChange={(sort: string, dir?: SortDir) => updateUrl({ sort, order: dir ?? sortDir })}
    {searchQuery}
    onSearchChange={(q) => updateUrl({ search: q || null })}
    searchPlaceholder="Search tags..."
    showViewToggle={false}
    filterSections={["rating"]}
    {activeFilters}
    {onAddFilter}
    {onRemoveFilter}
    {onClearFiltersAndSort}
    {canClearFiltersAndSort}
    presets={presetsApi.presets}
    {activePresetId}
    onApplyPreset={applyPreset}
    onSavePreset={savePreset}
    onOverwritePreset={overwritePreset}
    onDeletePreset={deletePreset}
    thumbSize={{
      value: viewPrefs.current.cols,
      min: 2,
      max: 8,
      onChange: (n) => viewPrefs.update({ cols: n }),
      label: "Tag card size",
    }}
  >
    {#snippet customFilterSections({ panelFilters })}
      <FilterSection title="Tag">
        {#snippet children()}
          <div class="flex flex-wrap gap-1">
            <button
              type="button"
              onclick={() => onAddFilter("favorite", "Favorite", "true")}
              class={cn(
                "tag-chip cursor-pointer transition-colors duration-fast",
                panelFilters.some((f) => f.type === "favorite" && f.value === "true")
                  ? "tag-chip-accent"
                  : "tag-chip-default hover:tag-chip-accent",
              )}
            >
              <Star class="h-3 w-3" /> Favorites
            </button>
            <button
              type="button"
              onclick={() => onAddFilter("hasImage", "Image", "true")}
              class={cn(
                "tag-chip cursor-pointer transition-colors duration-fast",
                panelFilters.some((f) => f.type === "hasImage" && f.value === "true")
                  ? "tag-chip-accent"
                  : "tag-chip-default hover:tag-chip-accent",
              )}
            >
              <ImageIcon class="h-3 w-3" /> Has image
            </button>
            <button
              type="button"
              onclick={() => onAddFilter("hasImage", "Image", "false")}
              class={cn(
                "tag-chip cursor-pointer transition-colors duration-fast",
                panelFilters.some((f) => f.type === "hasImage" && f.value === "false")
                  ? "tag-chip-accent"
                  : "tag-chip-default hover:tag-chip-accent",
              )}
            >
              No image
            </button>
          </div>
        {/snippet}
      </FilterSection>
    {/snippet}
  </FilterBar>

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
    {#snippet tagCard(tag: (typeof filtered)[number])}
      {@const usage = (tag.videoCount ?? 0) + (tag.imageCount ?? 0)}
      <a
        href={`/tags/${encodeURIComponent(tag.name)}`}
        class="tag-card group"
        title={`${tag.name} — ${usage} uses`}
      >
        <div class="tag-card-art" style:background={gradientFor(tag.name)}>
          {#if tag.imagePath}
            <img
              src={toApiUrl(tag.imagePath)}
              alt=""
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover"
            />
          {:else}
            <span class="tag-card-initials">{initialsFor(tag.name)}</span>
          {/if}
          <div class="tag-card-scrim"></div>

          {#if tag.favorite}
            <Star
              class="tag-card-fav h-3.5 w-3.5 text-accent-400 fill-current drop-shadow-[0_0_6px_rgba(196,154,90,0.8)]"
            />
          {/if}
          {#if tag.isNsfw}
            <span class="tag-card-nsfw">NSFW</span>
          {/if}

          {#if usage > 0}
            <span class="tag-card-usage">
              <span class="tag-card-usage-num">{usage.toLocaleString()}</span>
              <span class="tag-card-usage-label">{usage === 1 ? "use" : "uses"}</span>
            </span>
          {/if}
        </div>
        <div class="tag-card-body">
          <span class="tag-card-name" title={tag.name}>{tag.name}</span>
        </div>
      </a>
    {/snippet}

    <div class="space-y-6">
      {#if withContent.length > 0}
        <HierarchySection title={`Tagged content · ${withContent.length}`}>
          {#snippet children()}
            <div class="tag-grid" style:--col-count={viewPrefs.current.cols}>
              {#each withContent as tag (tag.id)}
                {@render tagCard(tag)}
              {/each}
            </div>
          {/snippet}
        </HierarchySection>
      {/if}

      {#if withoutContent.length > 0}
        <HierarchySection title={`Unused tags · ${withoutContent.length}`}>
          {#snippet children()}
            <div class="tag-grid tag-grid-muted" style:--col-count={viewPrefs.current.cols}>
              {#each withoutContent as tag (tag.id)}
                {@render tagCard(tag)}
              {/each}
            </div>
          {/snippet}
        </HierarchySection>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tag-grid {
    display: grid;
    grid-template-columns: repeat(max(1, min(var(--col-count, 5), 2)), minmax(0, 1fr));
    gap: 0.625rem;
  }
  @media (min-width: 640px) {
    .tag-grid {
      grid-template-columns: repeat(max(1, min(var(--col-count, 5), 4)), minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .tag-grid {
      grid-template-columns: repeat(var(--col-count, 5), minmax(0, 1fr));
    }
  }

  .tag-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--color-surface-1, #181818);
    border: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
    overflow: hidden;
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }
  .tag-card:hover {
    border-color: var(--color-border-accent, #c49a5a);
    box-shadow: 0 0 14px rgba(196, 154, 90, 0.25);
    transform: translateY(-1px);
  }

  .tag-card-art {
    position: relative;
    aspect-ratio: 5 / 4;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .tag-card-initials {
    font-family: "Geist", "Inter", system-ui, sans-serif;
    font-size: clamp(1.35rem, 4.5cqw, 2.25rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.68);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
    container-type: inline-size;
  }

  .tag-card-scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 55%),
      radial-gradient(
        circle at 50% 40%,
        rgba(255, 255, 255, 0.08) 0%,
        rgba(0, 0, 0, 0) 70%
      );
    pointer-events: none;
  }

  .tag-card-fav {
    position: absolute;
    top: 0.375rem;
    left: 0.375rem;
  }

  .tag-card-nsfw {
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.55rem;
    letter-spacing: 0.08em;
    padding: 0.1rem 0.3rem;
    background: rgba(200, 80, 80, 0.78);
    color: rgba(255, 255, 255, 0.95);
  }

  .tag-card-usage {
    position: absolute;
    bottom: 0.375rem;
    right: 0.375rem;
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    padding: 0.15rem 0.4rem;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .tag-card-usage-num {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-accent-300, #e9cfa3);
  }
  .tag-card-usage-label {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.55rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
  }

  .tag-card-body {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.6rem;
    min-height: 2rem;
  }
  .tag-card-name {
    min-width: 0;
    max-width: 100%;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--color-text-primary, #e8e8e8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.005em;
    text-align: center;
  }

  .tag-grid-muted .tag-card {
    opacity: 0.78;
  }
  .tag-grid-muted .tag-card:hover {
    opacity: 1;
  }
</style>
